# PHASE 02 — BASE DE DONNÉES, BACKEND ET TYPES

**Priorité :** critique.  
**Prérequis :** Phase 01 validée.

## Objectif
Stabiliser le modèle de données existant et synchroniser les contrats frontend/backend sans créer de tables spéculatives.

## Chantiers
- comparer les 22 migrations main à `information_schema`, contraintes, index, triggers, policies et publication Realtime de staging ;
- établir le catalogue canonique des 68 tables ;
- analyser les doublons `comments/video_comments`, `notification_settings/user_settings`, wallets/coins/transactions ;
- confirmer les relations manquantes et les FK avant ajout ;
- générer les types depuis le schéma réel ;
- formaliser conventions de statut, devise, identifiants, dates et montants entiers XOF ;
- centraliser transactions SQL atomiques et idempotence ;
- documenter migrations, compatibilité, sauvegarde et rollback.

## Tests
Migration sur DB vierge et copie existante, contraintes, FK, concurrence, RLS, types et contrats Edge.

## Critères de sortie
Schéma distant réconcilié, types générés exacts, migrations reproductibles, pas de table ajoutée sans décision validée.
