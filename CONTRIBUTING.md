# Contribuer à Afrixa

Ce document définit le déroulement minimal pour toute modification du dépôt. Les règles produit et techniques de référence sont dans [docs/AFRIXA_PROJECT_RULES_PART_I.md](docs/AFRIXA_PROJECT_RULES_PART_I.md).

## Avant de commencer

1. Lire les règles générales et les documents d'audit du domaine concerné.
2. Examiner la branche par défaut, les branches de remédiation et les PR ouvertes afin d'éviter les doublons ou les conflits.
3. Définir un périmètre court, les fichiers concernés, les risques et les critères d'acceptation.
4. Vérifier que les secrets et données réels ne sont pas nécessaires au développement local.

## Branches et commits

- Ne pas développer directement sur `main`.
- Utiliser une branche descriptive : `fix/<domaine>-<objectif>`, `feat/<domaine>-<objectif>` ou `docs/<sujet>`.
- Garder les changements cohérents et limités. Ne pas mélanger une refonte sans rapport avec la correction.
- Écrire des messages de commit descriptifs, par exemple `fix(auth): enforce account recovery permissions`.
- Ne pas force-push, supprimer une branche ou réécrire l'historique partagé sans accord explicite.
- Ne pas fusionner une PR ni déployer en production sans autorisation explicite.

## Modifications Supabase

- Toute modification de schéma est livrée dans une migration versionnée sous `supabase/migrations/`.
- Vérifier les contraintes, index, triggers, fonctions, permissions et politiques RLS correspondants.
- Tester les politiques avec plusieurs identités et rôles ; un test avec le seul compte administrateur ne suffit pas.
- Ne jamais appliquer automatiquement une migration à la base distante de production.
- Mettre à jour les types Supabase et les tests associés.
- Documenter les étapes manuelles et les éventuels backfills.

## Modifications frontend et API

- Le frontend ne doit pas être source de vérité pour les droits, prix, soldes, paiements, commissions ou transitions de commande.
- Les opérations privilégiées et les appels externes passent par le serveur.
- Prévoir les états chargement, erreur, vide, succès et accès refusé.
- Ne pas conserver de mocks dans les parcours utilisateurs présentés comme réels.

## Vérifications avant push

Exécuter les commandes disponibles et adaptées au changement :

```sh
npm ci
npm run lint
npm run build
```

Ajouter les tests unitaires, d'intégration, RLS ou E2E pertinents lorsqu'ils existent ou doivent être créés. Si une commande ne peut pas être exécutée, le signaler sans déclarer la validation réussie.

Avant le push :
- examiner `git diff --check` et le diff complet ;
- vérifier qu'aucun secret, fichier local, dump ou donnée personnelle n'est inclus ;
- vérifier que la documentation décrit fidèlement l'état réel ;
- noter les tests exécutés, leurs résultats et les blocages.

## Pull request

Chaque PR doit indiquer :
- le problème corrigé et le périmètre ;
- les changements importants ;
- les migrations et configurations nécessaires ;
- les risques et compatibilités ;
- les tests réellement exécutés ;
- ce qui reste bloqué et pourquoi.

Une PR doit rester en brouillon tant que des validations staging, des accès externes ou des décisions métier indispensables manquent.
