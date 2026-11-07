# Plan base de données — produits Afrixa

## 1. Tables existantes repérées

| Table | Migration | Rôle / limites |
|---|---|---|
| products | 20260521081838... | Catalogue vendeur, stock simple, images text[], Group Buy; aucun type, variante, SKU ou asset numérique. |
| orders | 20260411220545... | Commande mono-produit dénormalisée; product_id sans FK déclarée dans cette migration. |
| order_timeline | 20260411220545... | Historique statut. |
| payment_transactions | 20260523134246..., renommage 20261009140000... | Transactions FedaPay; intégrité renforcée en 20261009120000... |
| commission_splits | 20260523134246... | Répartition; écriture client supprimée par migration sécurité. |
| commissions, seller_payouts, disputes, reviews, notifications | 20260411220545... et migrations ultérieures | Éléments métier existants; vérifier les politiques et transitions avant réutilisation. |

## 2. Principes

Comparer migrations et schéma distant avant toute migration. Contrôler doublons, FK orphelines, statuts et données existantes. Procéder par expansion/backfill/contrainte/retrait, jamais par remplacement destructif. Regénérer src/integrations/supabase/types.ts après changement SQL. Chaque migration aura tests SQL/RLS, plan rollback et validation staging.

## 3. Architecture cible

### Catalogue commun
Étudier l'ajout product_type physical/digital avec backfill validé des anciennes lignes. Ajouter publication_status si brouillon/modération nécessaires, currency si multi-devise, deleted_at ou archivage. Garder stock/unlimited_stock/delivery_delay/delivery_fee pendant transition. Ajouter CHECK price > 0 et stock >= 0 après correction des données.

### Variantes et inventaire
Propositions : product_options, product_variants, inventory_movements immuables, stock_reservations expirables. Définir une seule source de vérité : stock simple ou stock variante; éviter les totaux contradictoires.

### Commandes
Conserver orders comme en-tête; créer order_items avec FK product/variant, seller_id et snapshots nom/prix/devise/quantité/option/image/SKU. Décider panier mono-vendeur ou commande parent + sous-commandes. Les commandes historiques mono-produit seront backfillées en une ligne après analyse des product_id nuls/produits supprimés. Ajouter FK uniquement après traitement des orphelins.

### Numérique
Propositions : digital_product_assets, digital_product_versions, digital_entitlements, digital_download_events; digital_download_tokens facultatif. Aucun lien public de fichier payant dans products.

### Paiements/remboursements
Réutiliser payment_transactions/FedaPay après tests. Étudier unicité transaction-provider/commande, événement webhook idempotent, refunds si aucun modèle existant ne couvre le besoin, liaison remboursement->commande/lignes->révocation entitlement.

## 4. Relations logiques proposées

auth.users/profiles -> products -> media; products -> options -> variants -> reservations/movements.
products numériques -> versions -> assets privés.
orders -> order_items -> réservations physiques ou entitlements numériques.
orders -> payment_transactions -> commission_splits; orders -> order_timeline/disputes/refunds.
entitlements -> download_events.

## 5. Contraintes/index à étudier

Prix positif; promo_price positif et inférieur au prix normal; stock >= 0; type limité; FK vendeur/catégorie; SKU unique selon portée; combinaisons variantes uniques; quantité > 0; snapshots immuables; réservation active idempotente; entitlement unique selon ligne d'achat; indexes seller/status/date, category/status, order_items(order_id,seller_id), entitlements(user_id,status), download_events(entitlement_id,created_at).

## 6. RLS cible

Produits : lecture publique uniquement publiés/actifs; écriture vendeur propriétaire; seller_id immuable.
Variantes : vendeur propriétaire; mouvements sensibles via fonction serveur.
Commandes/lignes : lecture acheteur/vendeur participants; création et transitions métier via fonctions serveur.
Assets payants : aucun accès anonyme ou Storage direct.
Entitlements : SELECT propriétaire; INSERT/UPDATE service role uniquement.
Download events : écriture serveur; lecture propriétaire limitée.
Commissions/refunds : aucune écriture client/vendeur.

## 7. Ordre de migrations futures (non créées)

1. Préflight schéma distant, policies, buckets, données orphelines.
2. product_type et backfill.
3. variantes/inventaire atomique.
4. order_items et backfill des commandes historiques.
5. Storage public/private et métadonnées médias.
6. assets, versions, entitlements et download events.
7. fonctions transactionnelles, RLS, contraintes et indexes.
8. retrait compatibilité après tests.

Aucune migration applicative n'a été créée dans cette mission.
