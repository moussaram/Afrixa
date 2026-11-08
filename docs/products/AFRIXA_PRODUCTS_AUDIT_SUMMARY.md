# Synthèse — audit produits physiques et numériques Afrixa

## Conclusion

La fondation physique est partielle, pas un commerce complet démontré. products et MyShop existent; le catalogue public, les commandes et les ventes restent largement mockés. Le formulaire ne téléverse pas les images et n'édite pas les produits. Le stock est contrôlé mais non réservé/décrémenté atomiquement. Un flux FedaPay serveur est présent, mais un composant AfrixaPaySheet simule encore un succès sur main.

Le système numérique est absent des sources/migrations parcourues : aucun fichier payant privé, droit d'accès, délivrance ou historique de téléchargement.

## Ce qui a été examiné

- Arbre GitHub complet : 486 entrées, main SHA c2c7b1dd...
- Marketplace, MyShop, Orders, OrderDetail, SellerSales.
- Composants marketplace, paiement, mocks et types.
- Types Supabase générés.
- Migrations produits, commandes, paiement, coordonnées livraison et litiges.
- Edge Functions FedaPay checkout, verify, webhook et helper.
- README/scripts et PR #1 comparée séparément.
- PR #1 est draft/non fusionnée; son code ne doit pas être confondu avec main.

## Présent dans le dépôt

Table products avec nom/description/prix/catégorie/stock/stock illimité/images text[]/localisation/délai/frais/Group Buy; boutique vendeur lit et insère des produits simples; RLS produits; orders/timeline/litiges/commissions/paiements; contrôle serveur prix et stock à l'insertion; Edge Functions FedaPay; adresse et coordonnées de livraison.

## Insuffisances majeures

1. Catalogue public fictif et catégories en dur.
2. Formulaire incomplet, upload absent, édition inerte.
3. Pas de type physique/numérique, variantes ou SKU.
4. Pas de panier multi-lignes.
5. Stock sans réservation atomique.
6. Pages client/vendeur de commandes en mocks.
7. Paiement simulé encore présent sur main.
8. Aucun stockage numérique privé, entitlement ou téléchargement.
9. Administration produit/catégorie non trouvée.
10. Schéma Supabase distant et policies réelles non vérifiés.

## Décisions à obtenir

- Panier multi-produits : une commande par vendeur ou commande parent/sous-commandes?
- Panier mixte physique/numérique autorisé?
- XOF seulement ou multi-devise?
- Politique annulation, remboursement, retour physique, chargeback numérique?
- Accès aux mises à jour futures des fichiers?
- Quotas de téléchargement et durée des liens?
- Variantes obligatoires par catégorie?
- Catégories contrôlées par Afrixa ou libres?
- Réservation stock au début paiement, expiration, remise en stock?
- Formats, tailles maximales, modération et droits de distribution?

## Risques

Survente; faux succès; exposition future de fichiers payants; doubles traitements webhook/verify sans idempotence DB; perte d'historique si suppression physique; dérive entre migrations et schéma Supabase distant.

## Prochaine action

Valider cette étude, puis exécuter P0 staging : comparer schéma, RLS, buckets et migrations appliquées; examiner les données historiques; tester FedaPay sandbox. Définir P1 et obtenir approbation avant tout changement fonctionnel.

## État

- [x] Audit statique et inventaire des principaux flux.
- [x] Spécifications physique et numérique.
- [x] Plan DB, sécurité, UI/UX et roadmap P0-P8.
- [ ] Vérification Supabase distant/Storage.
- [ ] Build/lint/tests et staging.
- [ ] Validation propriétaire.
- [ ] Aucune implémentation fonctionnelle.

## Hors périmètre

OuiGoo/Wigo, Yango, livraison vendeur, API transporteurs, webhooks logistiques et calcul automatique des frais sont exclus. Les besoins d'adresse et de préparation sont seulement relevés.
