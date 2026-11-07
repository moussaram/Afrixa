# Roadmap — système produits Afrixa

Plan uniquement : aucune fonctionnalité, migration ou configuration n'a été modifiée.

Règles : branche dédiée par phase, petites PR, tests avant fusion, aucun déploiement sans validation. Ne pas fusionner PR #1/#2 pour ce chantier. OuiGoo/Wigo, Yango, livraison vendeur, transporteurs, webhooks logistiques et calcul frais sont exclus.

## P0 — Audit
- Objectif : baseline code + Supabase distant + config.
- Fichiers : MyShop, marketplace components, Orders, OrderDetail, SellerSales, AfrixaPayment, migrations commerce, Edge Functions FedaPay, types.
- Dépendances : accès lecture staging, migrations appliquées, comptes de test.
- Travaux : comparer schéma, RLS, buckets, données, points d'entrée et paiement.
- Risques : dérive migrations/production.
- Tests : inventaire SQL, build/lint/types, tests existants, parcours sandbox.
- Acceptation : preuves et baseline approuvées, inconnues étiquetées.

## P1 — Architecture
- Objectif : séparation physique/numérique, commande/lignes, panier, paiements, compatibilité.
- Fichiers : types marketplace, types Supabase, migrations planifiées et contrats.
- Dépendances : P0 et décisions propriétaire.
- Travaux : ADR, machine d'état, schéma logique, backfill et compatibilité Group Buy.
- Risques : commandes historiques et flux shoppable.
- Tests : contrats, fixtures migration.
- Acceptation : modèle approuvé, rollback et aucun doublon.

## P2 — Produits physiques
- Objectif : formulaire, catalogue réel, upload images, variantes et inventaire.
- Fichiers : MyShop, MarketplaceContent, ProductCard, ProductBottomSheet, types, SQL/fonctions.
- Dépendances : P1, catégories et stockage validés.
- Travaux : CRUD vendeur, médias, SKU, mouvements et réservation atomique.
- Risques : compatibilité stock, survente, fichiers orphelins.
- Tests : RLS A/B, prix, variantes, dernière unité concurrente, upload invalide.
- Acceptation : parcours persistant, aucun mock, stock cohérent, historique préservé.

## P3 — Produits numériques
- Objectif : formulaire, upload sécurisé et versions.
- Fichiers : futurs écrans, Edge Functions upload/validation, Storage policies, migrations.
- Dépendances : P1 et Storage confirmé.
- Travaux : bucket privé, aperçu public séparé, quarantaine, MIME/taille/hash, assets/versions.
- Risques : exposition fichier, malware, coût.
- Tests : accès anonyme/cross-user, fichiers falsifiés, quotas, reprise et nettoyage.
- Acceptation : fichiers payants non publics, ownership serveur.

## P4 — Commandes physiques
- Objectif : checkout et traitement physique fiable.
- Fichiers : AfrixaPayment, fedapay.ts, Edge Functions, Orders, OrderDetail, SellerSales, schéma orders.
- Dépendances : P2, P1, FedaPay sandbox.
- Travaux : panier selon modèle, order_items snapshots, réservation/consommation, timeline réelle.
- Risques : double paiement, survente, état divergent.
- Tests : approved/declined/pending, webhook dupliqué, callback falsifié, timeout, annulation.
- Acceptation : jamais payé sans preuve serveur; transition unique; stock cohérent.

## P5 — Commandes numériques
- Objectif : accès après paiement vérifié.
- Fichiers : Edge Functions paiement/download, entitlements, bibliothèque client.
- Dépendances : P3 et paiement P4.
- Travaux : entitlement idempotent, contrôle download, URL signée courte/proxy, historique et révocation.
- Risques : téléchargement non autorisé.
- Tests : pending/failed, webhook rejoué, cross-user, lien expiré, refund/quota.
- Acceptation : seuls paiements approved côté serveur donnent accès.

## P6 — Interfaces
- Objectif : vendeur/client/admin reliés aux services.
- Fichiers : pages actuelles, composants marketplace, routes, locales.
- Dépendances : P2-P5.
- Travaux : formulaires par type, listes, édition, commandes, bibliothèque, modération.
- Risques : actions UI factices et autorisations front-only.
- Tests : parcours par rôle, responsive, accessibilité, réseau faible.
- Acceptation : données persistées et aucun faux état.

## P7 — Sécurité
- Objectif : durcissement transversal.
- Fichiers : migrations, policies, Edge Functions, upload, checkout, download.
- Dépendances : fonctionnalités disponibles en staging; contrôles intégrés dès P2/P3.
- Travaux : revue RLS, idempotence, limites, logs, remboursements, stockage et secrets.
- Risques : régression permissions/fuite.
- Tests : matrice négative A/B, concurrence, replay webhook, fuzz upload.
- Acceptation : aucun test critique échoué, preuves et approbation sécurité.

## P8 — Tests et validation
- Objectif : certification des parcours.
- Fichiers : tests unitaires/intégration/e2e, rapports QA.
- Dépendances : P0-P7.
- Travaux : SQL, RLS, paiement sandbox, upload/download, E2E physique/numérique, Android/PWA, restauration/rollback.
- Risques : écart staging/production et indisponibilité fournisseur.
- Tests : suite automatisée et parcours multi-rôles.
- Acceptation : anomalies P0/P1 fermées, résultats reproductibles, validation propriétaire.

## Dépendances

P0 -> P1 -> P2 et P3 en parallèle -> P4 dépend P2 -> P5 dépend P3 et paiement fiable -> P6 -> P7 transversal -> P8. Sécurité intégrée dès le départ.

## Exclusions logistiques

Adresse, origine vendeur, préparation et expédition sont relevées. Aucun fournisseur OuiGoo/Wigo, Yango, transporteur, webhook livraison ou calcul de frais n'est conçu ou intégré.
