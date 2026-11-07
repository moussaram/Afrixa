# Afrixa Delivery — spécification Seller Delivery

## 1. Objectif

Permettre à chaque boutique d'organiser sa propre livraison lorsque OuiGoo ou Yango ne sont pas disponibles, ou lorsque le vendeur préfère gérer le transport.

Seller Delivery doit être un mode natif du moteur Afrixa Delivery, pas un simple texte libre dans la commande.

## 2. Configuration du vendeur

### Profil logistique de la boutique

Données à prévoir :
- vendeur propriétaire ;
- adresse principale de collecte ;
- coordonnées GPS facultatives mais recommandées ;
- contact opérationnel ;
- jours et heures de préparation ;
- rayon ou zones desservies ;
- pays, ville, quartiers et codes/identifiants de zone ;
- modes de remise acceptés ;
- délai estimé par zone ;
- règles de livraison gratuite ;
- conditions de colis et restrictions.

L'adresse de collecte doit être un attribut de la boutique ou du profil logistique, pas être déduite automatiquement du champ city/country du produit.

### Activation

Le vendeur peut :
- activer/désactiver la livraison personnelle ;
- définir les zones desservies ;
- définir un tarif fixe ;
- définir des tarifs par zone ;
- définir un tarif gratuit au-delà d'un seuil de panier ;
- définir un délai estimé ;
- fournir des conditions et consignes.

Le système doit refuser un tarif négatif, une zone invalide, un délai incohérent et une configuration sans adresse de collecte lorsque celle-ci est requise.

## 3. Modèle tarifaire

Modes à étudier :

1. Tarif fixe par boutique : un montant unique pour toutes les zones desservies.
2. Tarif par zone : montant associé à une zone géographique explicite.
3. Livraison gratuite sous condition : seuil de panier, catégorie ou campagne, si la règle est validée par le propriétaire.
4. Tarif négocié : à éviter au checkout automatique, sauf si le client accepte explicitement un montant final avant paiement.

La réponse de tarification doit retourner :
- currency ;
- base amount ;
- zone appliquée ;
- conditions appliquées ;
- estimated delivery window ;
- quote reference ;
- quote expiry ;
- source du prix (seller configuration).

Le backend calcule le total et stocke un snapshot immuable dans la commande. Le frontend ne décide jamais du montant final.

## 4. Parcours vendeur

1. Le vendeur configure adresse de collecte, zones, tarifs et délais.
2. Une commande payée est visible dans ses commandes à traiter.
3. Le vendeur accepte ou refuse selon la politique Afrixa validée.
4. Il marque la commande en préparation.
5. Il indique « prête à remettre ».
6. Il confirme la prise en charge ou l'expédition.
7. Il peut fournir une référence externe facultative (transporteur tiers) et une URL de suivi validée.
8. Il renseigne l'estimation de livraison.
9. Il confirme la remise au client via le mécanisme prévu.
10. Le système conserve l'historique et informe le client.

Le vendeur ne doit pas pouvoir se déclarer lui-même comme acheteur ni modifier le prix payé.

## 5. Confirmation de livraison et preuve

Options à évaluer :
- confirmation du client dans son compte ;
- code OTP de remise, généré côté serveur et à usage unique ;
- signature ou accusé de réception, si le produit le permet ;
- photo de preuve, uniquement avec règles de confidentialité et consentement ;
- preuve externe documentée.

Recommandation initiale : confirmation client ou code OTP à usage unique. Le code ne doit être généré que lorsque la commande est en état de remise, expirer, être limité en tentatives et ne jamais être stocké en clair.

Un statut vendeur « livré » doit devenir un événement « livraison déclarée par vendeur » et non immédiatement un statut final irréversible. Le système doit prévoir un délai de contestation et une procédure de litige validée par Afrixa.

## 6. Parcours client

Le client voit :
- mode « Livraison par la boutique » ;
- nom de la boutique ;
- zone couverte ;
- frais calculés ;
- délai estimé ;
- conditions ;
- date estimée si disponible.

Après paiement :
- statut de préparation ;
- date de remise au livreur/vendeur ;
- informations de suivi facultatives ;
- estimation actualisée ;
- bouton de signalement d'un problème ;
- confirmation de réception.

Les informations personnelles du vendeur et du client doivent être limitées au strict nécessaire.

## 7. Règles métier

- Un vendeur ne peut gérer que les livraisons des commandes qui lui appartiennent.
- Le tarif utilisé au checkout est figé pour cette commande.
- Une modification ultérieure du tarif vendeur ne change pas les commandes déjà payées.
- Le vendeur ne peut pas remplacer arbitrairement un fournisseur après paiement.
- Une zone hors couverture doit rendre Seller Delivery indisponible.
- Un vendeur désactivé ne doit pas faire disparaître les livraisons déjà engagées.
- Un retard ou échec doit créer un événement et une possibilité de support.
- Les remboursements restent régis par le système de paiement et la politique de litige, pas par le seul statut de livraison.

## 8. Cas particuliers

- Adresse incomplète : demander correction avant paiement.
- Zone non desservie : ne pas proposer Seller Delivery.
- Produit volumineux : vérifier capacité/conditions du vendeur.
- Plusieurs produits du même vendeur : agréger si les contraintes logistiques sont compatibles.
- Plusieurs vendeurs : créer des expéditions séparées par vendeur.
- Vendeur indisponible après paiement : alerter le support, appliquer la politique d'annulation/remboursement.
- Client absent : conserver un statut de tentative échouée et les instructions de nouvelle tentative.

## 9. Données candidates

À confirmer après audit final du schéma :
- seller_delivery_settings ;
- seller_delivery_zones ;
- seller_delivery_rates ;
- pickup_locations ;
- delivery_quotes ;
- deliveries ;
- delivery_events ;
- delivery_proof metadata.

Ne pas créer toutes ces tables automatiquement. Les entités communes peuvent couvrir plusieurs providers et la configuration vendeur peut être normalisée selon le nombre de boutiques par compte.

## 10. Sécurité

- Toutes les mutations de statut sont contrôlées côté serveur.
- RLS limite les commandes et livraisons aux acheteurs, vendeurs concernés et administrateurs autorisés.
- Les vendeurs ne peuvent pas écrire des événements fournisseur.
- Les preuves sont dans un stockage privé, accès restreint et URLs temporaires.
- Les adresses et numéros ne sont jamais inclus dans les journaux publics.
- Les tarifs sont calculés et validés côté backend.
- Les événements sont horodatés et append-only lorsque possible.

## 11. Critères d'acceptation futurs

- Le vendeur peut activer/configurer Seller Delivery.
- Les zones et tarifs sont validés côté serveur.
- Le checkout affiche un devis déterministe.
- Le montant total payé correspond au snapshot.
- Le vendeur ne voit que ses commandes.
- Les statuts suivent des transitions autorisées.
- Le client reçoit les notifications attendues.
- La preuve de livraison est vérifiable.
- Le litige bloque les transitions incompatibles.
- Les cas multi-vendeur créent des expéditions indépendantes.

Aucun écran ni code n'a été modifié dans cette spécification.
