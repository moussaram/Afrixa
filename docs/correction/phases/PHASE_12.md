# PHASE 12 — TESTS, PERFORMANCE ET OPTIMISATION

**Priorité :** critique avant release.  
**Prérequis :** phases 01 à 11.

## Objectif
Établir une preuve reproductible de qualité, sécurité, performance et résilience.

## Chantiers
- ajouter tests unitaires, composants, intégration, E2E et Edge Functions ;
- ajouter tests RLS cross-user et migration ;
- tester paiements et webhooks en sandbox avec rejouabilité ;
- analyser dépendances, secrets, SAST et vulnérabilités ;
- mesurer feed, recherche, upload, chat, live et marketplace ;
- optimiser index, pagination, cache et tâches de calcul ;
- vérifier limites de concurrence et charge sur opérations financières ;
- corriger warnings TypeScript/ESLint et augmenter strictness progressivement ;
- établir budgets performance et couverture.

## Tests
CI complète, migration vierge/existante, scénarios de charge, test de reprise après panne provider, audit de sécurité automatisé et manuel.

## Critères de sortie
Build, lint, tests et scans passent sur commit exact ; résultats archivés ; risques résiduels acceptés explicitement.
