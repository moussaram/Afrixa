# Afrixa Delivery — plan d'évolution de la base de données

## 1. État existant identifié

Structures repérées dans les migrations/types consultés :

### products
Champs utiles existants : seller_id, city, country, delivery_delay, delivery_fee. Ces champs décrivent des informations simples au niveau produit, pas une configuration complète de livraison.

### orders
Champs utiles : buyer_id, seller_id, product_id, quantity, prix, commission, payment_reference, status, delivery_address, buyer_phone, buyer_note, delivery_lat, delivery_lng.

La commande actuelle est orientée mono-produit/mono-vendeur dans le code consulté.

### order_timeline
Conserve order_id, status, message, created_at. Utile comme historique métier de commande, mais insuffisant pour porter les événements techniques détaillés d'un prestataire.

### disputes
Existe dans la migration initiale pour les litiges. Son adéquation avec les litiges de livraison et les preuves doit être réexaminée.

### notifications
Existe déjà et est utilisée par useNotifications. Réutiliser le système générique, en ajoutant des événements de livraison au moment approprié.

### Coordonnées
La migration 20261010120000_order_delivery_coordinates.sql ajoute delivery_lat et delivery_lng à orders avec une contrainte de paire.

Aucun modèle delivery/shipment/provider/webhook log dédié n'a été identifié dans les migrations consultées. Ce constat doit être vérifié sur le schéma distant avant conception définitive.

## 2. Principes de modélisation

- Ne pas mettre tous les champs logistiques dans orders.
- Séparer devis, expédition, événements et configuration.
- Utiliser des identifiants internes UUID.
- Garder provider_reference distinct de l'ID interne.
- Conserver un snapshot immuable du tarif et des adresses utilisés.
- Ne jamais stocker les secrets fournisseurs dans PostgreSQL accessible à l'application.
- Prévoir multi-vendeur et multi-expédition.
- Utiliser des contraintes uniques pour l'idempotence.

## 3. Entités candidates

Les noms ci-dessous sont des propositions, pas des tables existantes ni des migrations créées.

### delivery_providers
- id
- code (ouigoo, yango, seller)
- display_name
- enabled
- access_status
- supported_countries
- capabilities JSON contrôlé ou table de capacités
- configuration non secrète
- verified_at
- created_at, updated_at

Ne pas stocker de token dans configuration.

### seller_delivery_settings
- id
- seller_id / shop_id
- enabled
- pickup_location_id
- default_preparation_minutes
- policy_text
- created_at, updated_at

### seller_delivery_zones
- id
- settings_id
- country_code
- city
- zone_code ou géométrie contrôlée
- enabled

Éviter de comparer des noms de quartiers libres comme unique vérité géographique.

### seller_delivery_rates
- id
- zone_id
- pricing_type (flat, threshold_free, negotiated si validé)
- amount_minor
- currency
- free_threshold_minor nullable
- min/max weight si requis
- valid_from, valid_until

### pickup_locations
- id
- owner_id
- label
- address
- latitude, longitude
- contact_name
- contact_phone
- is_default
- active

Les coordonnées et contacts doivent être accessibles uniquement aux rôles concernés.

### delivery_quotes
- id
- order/cart reference
- provider_id
- zone/availability
- amount_minor
- currency
- eta_min/eta_max
- provider_quote_reference
- expires_at
- input_snapshot_hash
- status
- created_at

### deliveries
- id
- order_id ou fulfillment_id
- provider_id
- seller_id
- status
- provider_reference
- idempotency_key
- pickup_snapshot
- recipient_snapshot
- parcel_snapshot
- quote_id
- shipping_amount_minor
- currency
- tracking_url
- eta
- created_at, updated_at

Pour les commandes multi-vendeur, deliveries doit se rattacher à une entité fulfillment/sub_order, pas supposer que order_id suffit.

### delivery_events
- id
- delivery_id
- provider_event_id nullable
- source (provider_webhook, polling, seller, admin, customer)
- event_type
- normalized_status
- occurred_at
- received_at
- payload_hash
- safe_payload
- processed_at
- processing_status

Contrainte unique sur provider_event_id + provider ou autre clé de déduplication stable.

### delivery_webhook_receipts
- id
- provider_id
- event_key
- signature_valid
- received_at
- processed_at
- outcome
- payload_hash

Ne conserver le corps brut que si nécessaire et avec politique de rétention, chiffrement et minimisation.

### delivery_attempts
- id
- delivery_id
- operation
- attempt_number
- outcome
- provider_http_status
- error_code
- latency_ms
- created_at

Aucun token, secret, adresse complète ou numéro de téléphone ne doit être journalisé.

### delivery_proofs
- id
- delivery_id
- proof_type
- storage_path privé
- captured_at
- submitted_by
- verification_status
- expires_at

Les fichiers doivent être dans un bucket privé, avec règles d'accès et URLs temporaires.

## 4. Relations recommandées

- provider 1—N deliveries.
- seller settings 1—N zones.
- zone 1—N rates.
- delivery 1—N events.
- delivery 1—N attempts.
- delivery 0—N proofs.
- quote 0—N deliveries selon le modèle retenu, idéalement quote consommé une fois.
- fulfillment 1—N deliveries.

La relation entre commandes existantes, commande parent et sous-commandes doit être décidée avant migration.

## 5. RLS proposée

- Client : SELECT uniquement les livraisons associées à ses commandes.
- Vendeur : SELECT et actions métier sur les livraisons associées à ses fulfillments.
- Admin : accès selon rôle explicite et journalisé.
- Provider webhook : ne pas utiliser une policy ouverte. Passer par une fonction serveur qui vérifie la signature et applique une mutation contrôlée.
- delivery_events : lecture restreinte aux participants ; insertion réservée au backend.
- delivery_attempts et webhook_receipts : admin/service uniquement.
- delivery_proofs : lecture limitée aux participants et accès fichier via URL signée temporaire.

Les politiques doivent être testées avec plusieurs utilisateurs et ne doivent pas reposer uniquement sur le masquage frontend.

## 6. Contraintes et intégrité

- CHECK montant >= 0.
- devise ISO contrôlée.
- lat/lng toutes deux nulles ou toutes deux présentes, et bornes géographiques.
- unique provider_reference lorsque non null.
- unique idempotency_key dans son scope provider.
- quantité/poids positifs.
- dates cohérentes.
- transitions de statut contrôlées par fonction serveur.
- snapshots non modifiables par le client.
- FK avec politique ON DELETE explicite ; éviter de supprimer l'historique logistique avec la commande.

## 7. Questions de conception

1. Une commande globale et plusieurs fulfillments ou plusieurs commandes dès le checkout ?
2. Le paiement FedaPay est-il global ou séparé par vendeur ?
3. Le tarif est-il calculé par sous-commande ou par colis ?
4. Comment répartir une commande en plusieurs colis ?
5. Où résident les adresses de collecte et adresses enregistrées des clients ?
6. Quel est le mécanisme de preuve et de litige ?
7. Quelle rétention pour les événements et données personnelles ?

## 8. Plan de migration futur

Aucune migration n'a été créée.

Ordre futur conseillé :
1. résoudre le modèle panier/commande/fulfillment ;
2. confirmer le schéma réel et les policies existantes ;
3. créer les entités providers/settings/zones/rates ;
4. créer quotes et deliveries ;
5. créer events, attempts et webhook receipts ;
6. ajouter preuves privées ;
7. mettre à jour types générés ;
8. ajouter contraintes, index, RLS et tests ;
9. valider en staging.

Toute migration devra être séparée, réversible lorsque possible, testée sur staging et accompagnée d'un plan de retour arrière.
