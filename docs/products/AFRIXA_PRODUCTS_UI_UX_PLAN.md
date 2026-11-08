# Plan UI/UX — produits physiques et numériques

## 1. Interfaces existantes

| Interface | Fichier | État |
|---|---|---|
| Marketplace | Marketplace.tsx, MarketplaceContent.tsx | Catalogue mock, catégories en dur. |
| ProductCard | ProductCard.tsx | Carte de présentation; callback optionnel non relié par parent; bouton Voir sans handler propre. |
| ProductBottomSheet | ProductBottomSheet.tsx | Peut lancer AfrixaPayment; raccordement à vérifier. |
| Boutique vendeur | MyShop.tsx | Lecture/insertion partielle Supabase; image placeholder, stats fictives, édition inerte. |
| Commandes client | Orders.tsx, OrderDetail.tsx | Mocks et transitions locales. |
| Ventes vendeur | SellerSales.tsx | Mocks et mutations locales. |
| Paiement | AfrixaPayment.tsx | Checkout FedaPay serveur dans le code, configuration non vérifiée. |
| Autre paiement | AfrixaPaySheet.tsx | Simulation sur main; PR #1 bloque le parcours groupé. |

Pas d'écran Mes achats numériques, formulaire fichier payant ou console admin produits repéré.

## 2. Espace vendeur cible

Accueil : statistiques réelles, produits actifs/brouillons, stock faible, commandes payées, ventes physiques et numériques.
Ajout : choix obligatoire Physical ou Digital. Formulaire physique séparé (médias, variantes, stock, SKU, livraison indicative). Formulaire numérique séparé (fichier principal, aperçu, version, validation, licence).
Mes produits : filtres type/statut/catégorie/stock, édition, aperçu, désactivation, archivage et historique.
Commandes : onglet physique (préparation/expédition/litiges) et numérique (droits, téléchargements, remboursements/révocations).

## 3. Espace client cible

Catalogue avec filtres type/catégorie et étiquette claire. Fiche physique : variantes, stock, localisation et informations de livraison. Fiche numérique : formats, taille, version, aperçu, licence/compatibilité.
Panier et checkout : adresse requise uniquement pour ligne physique; prix et disponibilité revalidés côté serveur. Décider si panier mixte et multi-vendeurs sont autorisés.
Historique : Mes commandes physiques avec timeline; Mes achats numériques avec droits actifs, version achetée, téléchargement et historique. Pas de download si paiement non vérifié, refund ou entitlement révoqué.

## 4. Administration cible

Aucun espace admin produit dédié trouvé. Prévoir contrôle rôle serveur pour catégories, attributs, revue produits/vendeurs/médias, fichiers numériques, suspensions, litiges, remboursements et audit trail. Actions sensibles via Edge Functions/procédures privilégiées, jamais par rôle front modifiable.

## 5. UX et résilience

Mobile-first, sauvegarde brouillon, upload reprenable, erreurs explicites, validation par étapes, aperçu fichier, prix/devise lisibles, stock non ambigu, aucun faux état payé/vendu/téléchargé, traductions FR/EN via src/locales.

## 6. Routes indicatives (non existantes à ce stade)

/shop/products/new?type=physical
/shop/products/new?type=digital
/shop/products/:id/edit
/shop/orders/physical
/shop/orders/digital
/orders/physical
/library/digital
/admin/marketplace/products
/admin/marketplace/categories

Ces routes sont des propositions. Cartographier le routeur réel avant toute modification.
