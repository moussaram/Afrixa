# Afrixa — état actuel du système produits

Périmètre : dépôt moussaram/Afrixa, main au commit c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70. Arbre GitHub complet consulté (486 entrées, non tronqué). Audit statique uniquement : aucune connexion Supabase distante, aucun test navigateur ni achat réel.

## 1. Conclusion

Afrixa possède une fondation de commerce physique partielle : table products, interface boutique vendeur, commandes, paiements FedaPay, commissions/escrow et champs de livraison. Ce n'est pas encore un parcours de commerce complet démontré. Le catalogue public est alimenté par mocks; le formulaire vendeur ne téléverse pas les images et ne permet pas d'éditer réellement; les pages de commandes et ventes utilisent des données statiques. Le stock est vérifié à la création de commande mais n'est pas réservé ni décrémenté atomiquement.

Aucun système de produit numérique n'a été identifié : ni modèle de fichier payant, ni bucket privé produit, ni entitlement, ni bibliothèque de téléchargements.

## 2. Inventaire des fonctionnalités

| Domaine | Emplacement | État observé |
|---|---|---|
| Marketplace | src/pages/Marketplace.tsx, src/components/marketplace/MarketplaceContent.tsx | Placeholder : mocks produits, boutiques et vidéos. |
| Cartes | ProductCard.tsx, ShopCard.tsx | Présentation de mocks; callback produit non relié dans MarketplaceContent; bouton Voir sans action propre. |
| Catégories | src/data/mockMarketplace.ts, MarketplaceContent.tsx | Codées en dur; bug potentiel d'accent/slugs : electronique ne correspond pas à électronique. |
| Boutique | src/pages/MyShop.tsx | Partiel : lit les produits actifs du vendeur et peut insérer une ligne Supabase; fallback mock si liste vide. |
| Formulaire | MyShop.tsx | Partiel : nom, description, prix, stock, catégorie, ville, pays. Bloc photo décoratif, pas d'upload. |
| Édition | MyShop.tsx | Non opérationnel : bouton crayon sans handler. |
| Désactivation | MyShop.tsx | Partiel : update is_active=false pour produit distant; retrait local des mocks. |
| Stock | products.stock, unlimited_stock, trigger SQL | Partiel : contrôle de quantité au checkout, pas de consommation/réservation atomique. |
| Variantes/SKU | migrations, src/types/marketplace.ts | Non trouvé. |
| Panier | pages, composants, migrations | Pas de panier multi-lignes/persistant identifié. Achat direct. |
| Commandes client | src/pages/Orders.tsx, OrderDetail.tsx | Placeholder : données statiques et transitions locales. |
| Ventes vendeur | src/pages/SellerSales.tsx | Placeholder : données statiques et mutations locales. |
| Paiement réel | AfrixaPayment.tsx, src/lib/fedapay.ts, Edge Functions | Implémentation serveur présente dans le code; production/configuration non vérifiées. |
| Paiement simulé | AfrixaPaySheet.tsx sur main | Placeholder dangereux : timer puis toast « paiement confirmé » sans transaction. |
| Livraison | orders.delivery_address/lat/lng, YangoDeliveryStep.tsx, yango.ts | Prototype/champs présents; transporteurs exclus de cette mission. |
| Produits numériques | pages, types, migrations, Edge Functions | Non trouvé. |
| Administration produits | pages et composants parcourus | Interface dédiée non trouvée. |

## 3. Schéma existant

### products
Migration : supabase/migrations/20260521081838_e52bdda3-a352-4c0e-a8a3-4fe73e871726.sql.
Champs : id, seller_id, name, description, category, price, promo_price, stock, unlimited_stock, images text[], city, country, delivery_delay, delivery_fee, paramètres Group Buy, is_featured, compteurs, is_active, dates.
RLS : lecture produits actifs ou propriétaire; insertion si auth.uid() = seller_id; update/delete propriétaire. Pas de type de produit, variante, SKU, FK catégorie ni contraintes métier fortes visibles dans cette migration.

### orders et paiement
Migration orders : supabase/migrations/20260411220545_ccee20d7-dd97-4ef4-b162-22d6c37e52ba.sql.
Une commande porte un seul product_id, nom/image copiés, quantité et prix, commissions, opérateur, téléphone, adresse, statut, référence et escrow. Pas de FK product_id déclarée dans cette migration. order_timeline garde les statuts.
payment_transactions est créée en 20260523134246... puis renommée vers FedaPay par 20261009140000_migrate_fedapay.sql.
La migration 20261009120000_secure_payment_integrations.sql ajoute enforce_order_checkout_integrity : l'acheteur doit être authentifié, le produit actif est relu, l'achat de son propre produit est interdit, prix/nom/image/commission sont recalculés et le stock est contrôlé avec FOR SHARE. La fonction ne décrémente pas le stock.
La même migration rend les mises à jour des transactions serveur uniquement et supprime l'ancien trigger d'escrow à la livraison.

### Paiement
AfrixaPayment crée order, transaction, puis appelle create-fedapay-payment.
verify-fedapay-payment relit l'objet FedaPay et compare identifiant, statut approved, montant, devise et acheteur avant de confirmer la commande et créer un split.
fedapay-webhook vérifie la signature et relit aussi la transaction auprès du fournisseur.
Ce sont des protections présentes dans le code, pas une preuve de configuration réelle ou de fonctionnement en production.

## 4. Fichiers et stockage

products.images est un tableau de chaînes; le formulaire n'envoie pas d'image. MyShop utilise Picsum comme image après insertion. Les médias Cloudflare Stream existants sont destinés aux vidéos sociales, pas aux fichiers de produits.
Aucun bucket Storage ni policy de stockage produit n'a été trouvé dans les migrations parcourues. Pas de séparation public/privé pour fichiers numériques.

## 5. Parcours UI existants

- MarketplaceContent affiche mockProducts/mockShops/mockShoppableVideos et ne lit pas Supabase.
- MyShop lit products par seller_id et insère des champs simples. Les statistiques sont statiques. Le bouton d'édition est inerte.
- Orders, OrderDetail et SellerSales ne lisent pas la base dans les fichiers examinés.
- ProductBottomSheet peut ouvrir AfrixaPayment, mais son raccordement depuis le catalogue doit être confirmé par point d'entrée.
- AfrixaPaySheet sur main simule le succès. Dans la PR #1 ouverte, le parcours concerné est explicitement signalé comme indisponible; PR #1 n'est pas fusionnée.

## 6. Écarts principaux

1. Catalogue public non connecté aux données métier.
2. Formulaire incomplet, aucun upload image, édition absente.
3. Pas de séparation physical/digital.
4. Pas de variantes, SKU ou journal d'inventaire.
5. Pas de panier multi-lignes.
6. Stock non consommé/réservé atomiquement.
7. Pages commandes et ventes fictives.
8. Parcours de paiement simulé encore présent sur main.
9. Aucun stockage privé, droit ou téléchargement numérique.
10. Pas d'administration produit/catégorie identifiée.
11. Schéma distant et policies réellement appliquées non vérifiés.

## 7. Limites de preuve

Le dépôt ne révèle pas le schéma Supabase réellement appliqué, les données, les buckets, les secrets ni la configuration FedaPay/webhook. Aucun build, lint, test SQL/RLS ou test navigateur n'a été exécuté pendant cette mission. Une présence de code n'est jamais assimilée à un fonctionnement production.

## 8. Fichiers clés

src/pages/MyShop.tsx; src/components/marketplace/*; src/pages/Marketplace.tsx; src/pages/Orders.tsx; src/pages/OrderDetail.tsx; src/pages/SellerSales.tsx; src/components/payment/AfrixaPayment.tsx; src/lib/fedapay.ts; supabase/functions/create-fedapay-payment/index.ts; verify-fedapay-payment/index.ts; fedapay-webhook/index.ts; migrations 20260521081838..., 20260411220545..., 20261009120000..., 20261009140000....
