# Afrixa Delivery — état actuel du dépôt

**Type :** audit statique du dépôt GitHub  
**Référence examinée :** snapshot de main au commit c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70  
**Date de l'audit :** 7 novembre 2026  
**Statut :** constats statiques uniquement — aucun test distant ou parcours navigateur exécuté

## 1. Synthèse

Afrixa possède déjà des éléments de livraison dispersés dans le parcours de paiement et les commandes, mais aucun moteur central Afrixa Delivery ni intégration serveur OuiGoo/Yango n'a été identifié dans le snapshot examiné.

Le code Yango existant est un parcours d'interface qui construit un lien externe vers ya.cc/maps. Il ne constitue pas une intégration API de livraison. Le formulaire affiche des estimations fixes et le parcours AfrixaPaySheet simule le paiement avec un délai local. Un autre parcours, AfrixaPayment, utilise le flux FedaPay serveur et les coordonnées Google Places, mais ne présente pas le même sélecteur de livraison.

Le système vendeur et les écrans de commandes contiennent des prototypes locaux/mock. La base possède des champs d'adresse et de coordonnées de livraison, mais pas de modèle de livraison autonome identifié dans les types et migrations consultés.

## 2. Périmètre et limites

Fichiers et migrations inspectés dans le dépôt, notamment :

- src/components/payment/AfrixaPaySheet.tsx
- src/components/payment/AfrixaPayment.tsx
- src/components/payment/YangoDeliveryStep.tsx
- src/components/payment/yango.ts
- src/hooks/useAfrixaPayment.ts
- src/pages/MyShop.tsx
- src/pages/Orders.tsx
- src/pages/OrderDetail.tsx
- src/pages/SellerSales.tsx
- src/hooks/useNotifications.ts
- src/integrations/supabase/types.ts
- migrations de orders, products, paiement sécurisé et coordonnées de livraison.

L'audit ne prouve pas l'état d'un projet Supabase distant, de ses données, policies ou fonctions effectivement déployées. Les chemins sont ceux de la version examinée et doivent être revalidés sur le commit choisi avant implémentation.

## 3. Boutiques et produits physiques

### MyShop

Chemin : src/pages/MyShop.tsx

La page :
- lit les produits Supabase du vendeur courant lorsque l'utilisateur est connecté ;
- filtre par seller_id et is_active ;
- insère un produit avec nom, description, catégorie, prix, stock, ville et pays ;
- utilise un fallback mock lorsque la liste distante est vide ou que l'utilisateur n'est pas connecté ;
- présente des statistiques codées en dur ;
- ne montre pas dans le flux examiné de configuration vendeur complète de livraison par zone, de créneaux, ni de tarifs multiples.

Les champs d'adresse de boutique/point de collecte ne sont pas établis par cette page. La ville et le pays du produit ne remplacent pas une adresse de collecte géocodée.

### Table products

Migration repérée : supabase/migrations/20260521081838_e52bdda3-a352-4c0e-a8a3-4fe73e871726.sql

Champs de livraison existants :
- city
- country
- delivery_delay
- delivery_fee

Ces champs sont attachés au produit. Ils ne constituent pas un système de tarifs de livraison par zone ou par prestataire. Aucune configuration structurée de modes OuiGoo, Yango et vendeur n'a été identifiée dans la structure consultée.

## 4. Panier et commande

Aucun panier multi-vendeur persistant ni modèle de panier central n'a été identifié dans les recherches ciblées du dépôt. Le parcours AfrixaPayment reçoit un seul produit, une quantité et un vendeur. Le modèle order examiné contient un seul product_id et un seul seller_id.

Conséquence architecturale : une commande actuelle semble modélisée comme une ligne d'achat par commande. Le panier multi-vendeur et la séparation en sous-commandes/expéditions doivent être vérifiés plus largement avant de décider comment les implémenter. Ne pas supposer qu'une commande multi-vendeur existe.

## 5. Commandes et statuts

Migration initiale repérée : supabase/migrations/20260411220545_ccee20d7-dd97-4ef4-b162-22d6c37e52ba.sql

La table orders comporte notamment :
- buyer_id, seller_id, product_id ;
- product_name, product_image ;
- quantity, unit_price, total_price ;
- commission_rate, commission_amount, seller_amount ;
- payment_operator, buyer_phone, delivery_address, buyer_note ;
- status, payment_reference, escrow_released, dispute_reason ;
- created_at, updated_at.

La table order_timeline conserve un statut et un message par événement, avec order_id. Elle ne contient pas, dans la migration examinée, un identifiant d'expédition ou un statut fournisseur indépendant.

La migration 20261010120000_order_delivery_coordinates.sql ajoute delivery_lat et delivery_lng avec une contrainte imposant que les deux coordonnées soient nulles ensemble.

La migration 20261009120000_secure_payment_integrations.sql définit enforce_order_checkout_integrity. Elle contrôle des champs de commande, le produit actif, le vendeur, la quantité et certaines transitions. Cette fonction ne constitue pas un moteur de livraison.

## 6. Paiement et checkout

### AfrixaPayment

Chemin : src/components/payment/AfrixaPayment.tsx

Le parcours examiné :
- récupère l'utilisateur connecté ;
- utilise l'autocomplétion Google Places pour l'adresse et les coordonnées ;
- crée une commande et une ligne payment_transactions ;
- appelle createFedaPayCheckout(order.id) ;
- redirige vers le checkout FedaPay.

Le flux ne présente pas dans le fichier examiné de choix fournisseur OuiGoo/Yango/livraison vendeur. Les frais de livraison ne sont pas ajoutés à la base du calcul total de ce composant.

### useAfrixaPayment

Chemin : src/hooks/useAfrixaPayment.ts

Ce hook crée également une commande et une transaction en utilisant le client Supabase. Il calcule le total à partir du prix unitaire et de la quantité. Il ne reçoit pas de mode de livraison ni de frais de livraison dans InitPaymentData.

### AfrixaPaySheet

Chemin : src/components/payment/AfrixaPaySheet.tsx

Ce parcours importe YangoDeliveryStep et buildYangoDeepLink, mais simule la confirmation de paiement avec setTimeout. Il ne doit pas être considéré comme un paiement réel ou une intégration fournisseur opérationnelle.

## 7. Yango existant

Chemins :
- src/components/payment/YangoDeliveryStep.tsx
- src/components/payment/yango.ts
- src/components/payment/AfrixaPaySheet.tsx
- src/pages/OrderDetail.tsx

YangoDeliveryStep propose deux options : Yango et retrait en main propre. Le composant affiche un délai « 20 - 45 min » et un prix « 500 - 1 500 FCFA » codés en dur. Le type DeliveryMethod est limité à yango | pickup.

yango.ts construit un lien ya.cc/maps avec les adresses de départ et d'arrivée. Le composant ouvre ce lien externe après le parcours de confirmation. Aucun appel HTTP à une API B2B Yango, aucune clé serveur, réservation, référence de livraison, webhook ou synchronisation de statut n'a été identifié dans ces fichiers.

Le statut Yango présenté dans OrderDetail est alimenté par un objet mock local. L'écran ne prouve pas une livraison réellement réservée ou suivie.

## 8. Interfaces vendeur et client

- src/pages/Orders.tsx : liste d'exemples mock locaux, filtrage local, navigation vers détail.
- src/pages/OrderDetail.tsx : commande mock, timeline locale, confirmation de réception et litige en state local.
- src/pages/SellerSales.tsx : commandes mock, transitions en state local, saisie de trackingNumber visible dans l'état du composant mais aucun flux serveur établi dans l'extrait audité.
- src/pages/MyShop.tsx : lecture/ajout partiel des produits, fallback mock.

Ces écrans ne peuvent pas être considérés comme des interfaces de livraison opérationnelles de bout en bout.

## 9. Notifications

Chemin : src/hooks/useNotifications.ts

Le hook lit public.notifications par user_id, s'abonne aux changements Realtime et met à jour le statut lu. Il utilise des données mock en l'absence de session, en cas d'erreur ou lorsque la liste est vide. La fonction send-push-notification existe dans le dépôt.

Aucune intégration de notification déclenchée par des événements de transporteur n'a été identifiée dans le périmètre examiné.

## 10. Classification de l'état

| Capacité | État constaté |
|---|---|
| Adresse de livraison texte | Partielle |
| Coordonnées client | Partielle, migration dédiée |
| Adresse structurée du vendeur | Non établie dans le parcours audité |
| Tarif de livraison produit | Champ existant, usage global non vérifié |
| Tarif par zone vendeur | Absent dans le schéma consulté |
| Choix Yango | Prototype UI |
| API Yango Delivery | Absente dans les fichiers recherchés |
| API OuiGoo | Absente dans les fichiers recherchés |
| Livraison vendeur | Partielle/prototype dans les écrans vendeur |
| Référence d'expédition | Absente du modèle orders consulté |
| Événements de livraison | Absents du modèle consulté |
| Suivi fournisseur | Absent |
| Preuve de livraison | Non établie |
| Litiges | Table et UI partielle, parcours réel non prouvé |
| Notifications génériques | Partielle, infrastructure existante |
| Commandes multi-vendeur | Non établie |
| Panier multi-vendeur persistant | Non identifié |

## 11. Risques prioritaires

1. Confusion entre un lien vers l'application Yango et une réservation API.
2. Prix/délais Yango codés en dur affichés comme des informations réelles.
3. Frais de livraison absents du total FedaPay examiné.
4. Absence d'entité de livraison indépendante de la commande.
5. Écrans de commandes et vendeur majoritairement mock.
6. Commande mono-produit/mono-vendeur incompatible directement avec plusieurs expéditions sans orchestration.
7. Adresse de collecte vendeur insuffisamment modélisée dans les parcours consultés.
8. Absence de preuve d'idempotence, de webhooks et de synchronisation transporteur.

## 12. Conclusion

L'état actuel justifie une conception centralisée Afrixa Delivery. La première étape de développement ne doit pas être l'appel direct à OuiGoo ou Yango depuis le frontend. Il faut d'abord clarifier le modèle de commande et de panier, les adresses de collecte, la séparation commande/paiement/livraison et les règles tarifaires.

Aucun code, schéma distant ou déploiement n'a été modifié dans cet audit.
