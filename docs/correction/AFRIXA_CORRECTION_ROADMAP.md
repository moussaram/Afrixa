# AFRIXA — ROADMAP DE CORRECTION (PHASE 0 → 13)

## 1. Principe

Conserver React/Vite/TypeScript, Supabase, Cloudflare Stream, Agora, FedaPay, Firebase et Google lorsque leur usage est adapté. Corriger d'abord la sécurité et l'intégrité, puis les dépendances backend, puis raccorder le frontend. Ne pas créer de tables avant comparaison du schéma réel et validation métier.

## 2. Ordre des phases et dépendances

| Phase | Domaine | Priorité | Dépend de | Livrable de sortie |
|---|---|---|---|---|
| 00 | Audit technique global et préparation | préalable | aucune | rapports et décisions approuvés |
| 01 | Sécurité, RLS, autorisations, intégrité | critique | 00 | matrices accès, policies corrigées, tests négatifs |
| 02 | Base de données, modèles, backend et types | critique | 01 | schéma canonique, migrations validées, types synchronisés |
| 03 | Authentification et identité | élevée | 01-02 | parcours Auth et profil fiables |
| 04 | Réseau social | élevée | 01-03 | follows, likes, commentaires, blocage persistants |
| 05 | Vidéos, stories, feed et recommandations | élevée | 02-04 | upload→modération→publication→feed |
| 06 | Messagerie et lives | élevée | 01-05 | conversations, médias, RTC, chat live et cadeaux sûrs |
| 07 | Marketplace, boutiques, commandes, stock | élevée | 02-06 | catalogue et cycle de commande réel |
| 08 | Paiements, escrow, wallets, coins | critique financière | 01-02-07 | ledger, checkout, payout, rapprochement |
| 09 | Monétisation créateur, abonnements et publicité | élevée | 08 | revenus, memberships, campagnes et facturation |
| 10 | Administration et modération | élevée | 01-09 | RBAC, console admin, files et audit trail |
| 11 | Frontend et expérience utilisateur | moyenne | 03-10 | écrans raccordés, états erreur/loading/empty |
| 12 | Tests, performance et optimisation | critique release | 01-11 | couverture et tests de charge/sécurité |
| 13 | Déploiement, observabilité et mise en service | critique release | 12 | release contrôlée, rollback, runbooks |

## 3. Priorités immédiates

### P0 — sécurité à traiter avant tout flux financier
- retirer l'accès public aux données sensibles de profils ;
- supprimer les policies d'insertion ouvertes ;
- protéger les soldes et revenus contre les écritures client ;
- interdire la publication vidéo sans modération serveur ;
- protéger les fonctions privilégiées de calcul/nettoyage ;
- verrouiller les participants et préférences de messagerie.

### P1 — cohérence des données
- réconcilier 68 tables et 18 types générés ;
- unifier les modèles de commentaires, préférences et finance ;
- vérifier les FK, contraintes, indexes et triggers ;
- créer un ledger financier seulement après décision sur les tables existantes.

### P2 — rétablir les parcours
- feed, profils, follows, likes, stories ;
- upload, modération, publication ;
- chat et live ;
- marketplace, commandes, FedaPay, payout ;
- Coins, gifts, creator wallet, Premium, ads.

## 4. Garde-fous de livraison

- Chaque phase a un document dédié `phases/PHASE_NN.md`.
- Aucun changement n'est fait sur main directement.
- Une migration inclut rollback/plan de reprise, RLS, contraintes, tests et mise à jour des types.
- Les migrations sont appliquées d'abord sur environnement de test.
- Les opérations financières utilisent transactions SQL/RPC et idempotency keys.
- Un flux ne devient visible dans l'UI qu'après preuve backend.
- Les données mock ne sont retirées qu'après remplacement par une source réelle et testée.
- Les secrets restent dans les gestionnaires de secrets des fournisseurs.
- Les phases ne sont pas déclarées terminées sur la seule base d'un build.

## 5. Portes de validation

**Gate A — sécurité :** aucun utilisateur ne lit/écrit les données d'un autre sans règle explicite ; soldes non modifiables par client.  
**Gate B — données :** migrations reproductibles, FK/contraintes vérifiées, types synchronisés.  
**Gate C — métier :** tests d'intégration pour les parcours positifs/négatifs et états d'erreur.  
**Gate D — release :** build/lint/tests/scan, staging, observabilité, rollback.

