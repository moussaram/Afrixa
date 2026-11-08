# Afrixa Delivery — plan UI/UX

## 1. État des interfaces existantes

| Espace | Fichier | État constaté |
|---|---|---|
| Paiement client | src/components/payment/AfrixaPayment.tsx | Checkout FedaPay avec adresse Google Places, sans choix de prestataire identifié |
| Ancien paiement | src/components/payment/AfrixaPaySheet.tsx | Parcours prototype, paiement simulé |
| Choix Yango | src/components/payment/YangoDeliveryStep.tsx | UI prototype, prix/ETA codés en dur, option retrait |
| Lien Yango | src/components/payment/yango.ts | Génère un lien externe de navigation, pas une réservation |
| Commandes client | src/pages/Orders.tsx | Données mock locales |
| Détail commande | src/pages/OrderDetail.tsx | Données et timeline mock locales |
| Ventes vendeur | src/pages/SellerSales.tsx | Données mock et changements d'état locaux |
| Boutique | src/pages/MyShop.tsx | Lecture/ajout partiel de produits |

Aucune modification d'interface n'a été effectuée.

## 2. Checkout client

Après adresse et avant paiement, présenter uniquement les options réellement disponibles pour tous les articles concernés.

Carte de livraison :
- nom du mode ;
- fournisseur ou vendeur ;
- prix confirmé ;
- délai estimé ou « non communiqué » ;
- zone couverte ;
- conditions importantes ;
- badge indisponible si le mode ne peut pas être sélectionné.

Ne pas afficher de prix ou ETA fixe qui n'est pas issu d'un devis valide ou d'une règle vendeur validée.

Affichage financier :
- sous-total produits ;
- frais de livraison ;
- taxes/commissions éventuelles séparées ;
- total à payer.

Le checkout doit revalider le devis côté serveur avant de créer la commande et le paiement.

## 3. Suivi client

Sur le détail de commande :
- statut de commande ;
- statut de paiement ;
- statut de préparation ;
- statut de livraison ;
- nom du fournisseur ;
- référence de suivi ;
- estimation de livraison ;
- dernier événement et horodatage ;
- lien de suivi si URL officielle validée ;
- signalement d'un problème ;
- confirmation de réception selon le mécanisme retenu.

Ne pas afficher les données privées du coursier au-delà des informations nécessaires.

## 4. Espace vendeur

### Paramètres

Sections à prévoir :
- adresse et contact de collecte ;
- activation livraison vendeur ;
- villes et zones ;
- tarifs fixes ou par zone ;
- seuil de livraison gratuite ;
- délais estimés ;
- horaires et jours ;
- conditions et restrictions.

### Gestion des commandes

Vue par statut :
- nouvelles commandes payées ;
- préparation ;
- prêtes ;
- remises au livreur ;
- livraisons en cours ;
- livrées ;
- incidents/litiges.

Actions :
- accepter/refuser selon règles ;
- commencer préparation ;
- marquer prête ;
- confirmer remise ;
- fournir référence externe facultative ;
- signaler une impossibilité ;
- consulter le suivi.

Les actions doivent appeler le backend et être contrôlées par rôle. Ne pas simplement modifier le state React.

## 5. Administration Afrixa

Écrans proposés :
- providers et activation par pays/zone ;
- état d'accès et santé des intégrations ;
- liste des livraisons ;
- détail et timeline ;
- erreurs API et tentatives ;
- événements webhook ;
- réconciliation manuelle ;
- litiges et preuves ;
- journal des actions administratives.

Les secrets ne doivent jamais être affichés dans l'interface admin. L'admin doit voir « configuré/non configuré », date de dernière rotation et statut de connexion, pas la valeur des clés.

## 6. États visuels

Prévoir :
- calcul du tarif ;
- indisponibilité de zone ;
- devis expiré ;
- création en cours ;
- confirmation fournisseur ;
- collecte en attente ;
- coursier affecté ;
- colis collecté ;
- en transit ;
- livré ;
- échec ;
- annulation ;
- incident ;
- litige.

Distinguer une demande envoyée, une demande acceptée et une livraison réellement effectuée.

## 7. Accessibilité et résilience

- formulaire d'adresse utilisable au clavier ;
- saisie manuelle si la carte est indisponible ;
- affichage clair des unités et de la devise XOF ;
- erreurs compréhensibles ;
- aucune donnée perdue après rafraîchissement ;
- chargement et réessai explicites ;
- adaptation mobile ;
- état hors ligne ;
- contraste suffisant ;
- confirmation avant annulation.

## 8. Notifications

Notifications client :
- paiement confirmé ;
- vendeur en préparation ;
- livraison créée ;
- collecte effectuée ;
- en transit ;
- livraison échouée ;
- livrée ;
- litige mis à jour.

Notifications vendeur :
- nouvelle commande payée ;
- client a choisi son mode ;
- échec de création ;
- livreur assigné ;
- incident ou litige.

Notifications admin :
- provider en erreur ;
- webhook invalide ;
- événements bloqués ;
- livraisons sans mise à jour au-delà du seuil opérationnel.

## 9. Critères UX

- L'utilisateur sait qui livre.
- Le prix est exact et confirmé avant paiement.
- Une option indisponible ne peut pas être sélectionnée.
- Le client comprend les différences entre paiement et livraison.
- Le vendeur ne peut pas falsifier les états.
- L'administration peut diagnostiquer une intégration sans exposer de secret.
