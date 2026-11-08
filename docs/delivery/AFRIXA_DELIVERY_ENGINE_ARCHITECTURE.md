# Afrixa Delivery — architecture du moteur central

## 1. Principes

Afrixa Delivery est un domaine métier autonome entre le checkout, les commandes, les paiements et les prestataires logistiques.

Principes structurants :
- Afrixa reste propriétaire de l'état métier de la commande.
- Chaque transporteur est isolé dans un adaptateur.
- Aucun format API fournisseur ne remonte dans le frontend ou les tables génériques.
- Le mode vendeur est un provider interne, pas une exception.
- Le tarif est confirmé avant paiement et figé dans le snapshot.
- La création d'expédition est idempotente.
- Le suivi repose sur des événements vérifiés et historisés.
- Les capacités inconnues d'un provider ne sont jamais simulées.

## 2. Vue logique

Checkout / panier
→ Order Orchestrator
→ Delivery Quote Service
→ Provider Registry
→ OuiGoo Adapter | Yango Adapter | Seller Delivery Adapter
→ Provider API ou workflow vendeur

Événements entrants
→ Webhook Gateway / Polling Worker
→ Signature + Idempotence + Normalisation
→ Delivery State Machine
→ Order/Payment Policy
→ Notifications + Timeline + Support

## 3. Modules

### Delivery Provider Registry

Registre serveur des fournisseurs :
- code interne ;
- nom affiché ;
- état global ;
- pays/zones autorisés ;
- capacités déclarées ;
- mode de facturation ;
- date de vérification ;
- statut d'accès partenaire.

Les clés API ne sont jamais stockées dans des colonnes lisibles par les clients. Utiliser les secrets gérés par l'environnement d'exécution.

### Quote Service

Entrée normalisée :
- origine ;
- destination ;
- type de colis ;
- dimensions/poids si connus ;
- commande ou panier concerné ;
- vendeur(s) ;
- devise.

Sortie :
- quote id ;
- provider ;
- prix et devise ;
- frais détaillés si disponibles ;
- ETA ou intervalle ;
- zone desservie ;
- conditions ;
- expiration ;
- données d'audit.

Le service doit retourner « indisponible » lorsqu'aucun devis fiable n'existe. Un montant de démonstration ne doit jamais être assimilé à un devis.

### Delivery Orchestrator

Responsabilités :
- associer un devis à une commande ;
- vérifier paiement/état de commande ;
- empêcher les doubles créations ;
- envoyer la requête à l'adaptateur ;
- conserver la référence externe ;
- gérer les erreurs temporaires/permanentes ;
- déclencher la réconciliation ;
- publier les événements métier.

### Provider Adapter Contract

Contrat interne proposé :

- capabilities()
- checkAvailability(input)
- quote(input)
- createShipment(input, idempotencyKey)
- getShipment(externalReference)
- cancelShipment(externalReference, reason)
- verifyWebhook(headers, rawBody)
- normalizeProviderEvent(payload)

Chaque méthode peut être non prise en charge. L'adaptateur doit retourner un résultat explicite, pas une réussite fictive.

### Adapters

- OuiGooAdapter : à implémenter après validation des endpoints officiels détaillés.
- YangoAdapter : désactivé tant que l'accès B2B Bénin/Cotonou n'est pas confirmé.
- SellerDeliveryAdapter : workflow interne et configuration par boutique.

## 4. Déroulement nominal

1. Le client valide un panier physique.
2. Le backend groupe les lignes par vendeur.
3. Il récupère les origines et les adresses de destination.
4. Il interroge les modes activés et couverts.
5. Il produit un devis par sous-commande/expédition.
6. Le client choisit une option disponible et accepte les frais.
7. Le backend vérifie le prix et crée les snapshots.
8. Le paiement est initialisé sur le montant global validé.
9. Après confirmation serveur du paiement, le système crée les expéditions selon les règles contractuelles.
10. Les références et réponses sont stockées.
11. Les webhooks ou contrôles périodiques mettent à jour l'état.
12. Les notifications sont envoyées à partir des événements métier.

La politique de création avant/après paiement doit être confirmée selon les règles de réservation du fournisseur. Si le devis expire avant paiement, il faut recalculer et demander une nouvelle confirmation.

## 5. Commande et expédition multi-vendeur

Une commande panier peut contenir plusieurs vendeurs. Le modèle recommandé est :
- une commande parent correspondant à l'intention d'achat globale ;
- une sous-commande par vendeur pour paiement/commission/fulfillment selon la stratégie financière retenue ;
- une ou plusieurs expéditions par sous-commande ;
- une expédition pouvant contenir plusieurs lignes compatibles.

Le modèle actuel orders semble mono-produit/mono-vendeur. La transition vers ce modèle est une décision majeure et ne doit pas être faite par simple ajout d'un provider_id à orders.

## 6. Séparation des états

Conserver des domaines indépendants :
- order_status ;
- payment_status ;
- fulfillment_status ;
- delivery_status.

Exemples :
- paiement confirmé mais préparation non commencée ;
- commande prête mais aucun coursier affecté ;
- livraison créée mais collecte non effectuée ;
- livraison échouée alors que paiement reste confirmé ;
- commande livrée mais litige ouvert.

Une demande API acceptée ne signifie pas que le colis est collecté ou livré.

## 7. Résilience

- idempotency key interne stable par expédition ;
- unique constraint sur provider + idempotency key ;
- retry exponentiel uniquement pour erreurs transitoires ;
- dead-letter queue pour échecs non résolus ;
- timeout borné ;
- circuit breaker par provider ;
- réconciliation périodique via getShipment si webhook manquant ;
- signature et timestamp des webhooks ;
- stockage du payload expurgé et du hash pour audit ;
- déduplication par event id ;
- journal des transitions.

Ne pas répéter une création si le résultat précédent est ambigu sans vérifier d'abord si le provider a créé le colis.

## 8. Notifications

Le moteur publie des événements métier normalisés :
- delivery.quote_confirmed ;
- delivery.created ;
- delivery.pickup_assigned ;
- delivery.picked_up ;
- delivery.in_transit ;
- delivery.delivered ;
- delivery.failed ;
- delivery.cancelled ;
- delivery.issue_reported.

Les notifications push/email sont des consommateurs de ces événements. Elles ne doivent pas être la source de vérité.

## 9. Administration

L'administration peut :
- activer/désactiver un provider par pays/zone ;
- vérifier son statut d'accès ;
- consulter les erreurs et tentatives ;
- rechercher une expédition par référence ;
- relancer une réconciliation ;
- gérer les litiges selon des permissions ;
- auditer les changements.

Toute action administrative doit être journalisée.

## 10. Décisions à obtenir

- Modèle de panier et commande parent/sous-commandes.
- Paiement global ou par vendeur.
- Prise en charge des commandes multi-colis.
- Réservation transporteur avant ou après paiement.
- Politique de remboursement/annulation.
- Preuve de livraison minimale.
- Responsabilité des frais en cas d'échec.
- Pays de lancement et règles fiscales/monétaires.

## 11. Non-objectifs de cette phase

Aucune API réelle, fonction Edge, migration, interface ou notification logistique n'a été créée.
