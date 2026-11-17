# PHASE 00 — AUDIT TECHNIQUE GLOBAL ET PRÉPARATION

**État :** audit documentaire réalisé ; validation attendue.  
**Base de référence :** main `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70`.

## Objectif
Établir la carte vérifiable de l'architecture, des fonctionnalités, des tables, des APIs, des risques, des dépendances et des tests avant toute correction.

## Périmètre
Frontend, routes, composants, hooks, contextes, services, intégrations, 22 migrations, 13 Edge Functions, fonctions SQL/triggers, policies RLS, types générés, configuration et scripts.

## Résultats
- Architecture et état des fonctionnalités : `../AFRIXA_MASTER_AUDIT.md`.
- Matrice fonctionnelle : `../AFRIXA_FEATURES_INVENTORY.md`.
- Schéma : `../AFRIXA_DATABASE_MAP.md`.
- APIs : `../AFRIXA_API_MAP.md`.
- Sécurité : `../AFRIXA_SECURITY_AUDIT.md`.
- Roadmap : `../AFRIXA_CORRECTION_ROADMAP.md`.
- Tests : `../AFRIXA_TEST_REPORT.md`.

## Règles
Aucun fichier source, migration, secret ou paramètre applicatif n'est modifié. Les tables spécifiées mais non retrouvées ne sont pas créées. Les différences entre dépôt et production sont explicitement laissées à vérifier.

## Critères de sortie
- rapports relus et validés ;
- périmètre des phases accepté ;
- accès Supabase staging disponible pour l'étape suivante ;
- décision de source de vérité pour les systèmes dupliqués ;
- aucune correction fonctionnelle engagée avant validation écrite.

## Dépendances
Aucune phase fonctionnelle ne doit précéder la validation de cette Phase 00.
