# PHASE 13 — DÉPLOIEMENT, OBSERVABILITÉ ET MISE EN SERVICE

**Priorité :** release contrôlée.  
**Prérequis :** Phase 12 validée.

## Objectif
Déployer les versions frontend, migrations, Edge Functions et intégrations de manière coordonnée, observable et réversible.

## Chantiers
- inventorier les environnements dev/staging/prod et leurs secrets ;
- vérifier domaines, redirect URLs, webhooks, CORS, restrictions API et providers ;
- appliquer migrations dans un ordre contrôlé avec sauvegarde et plan rollback ;
- déployer Edge Functions et vérifier leurs versions ;
- configurer tâches planifiées, webhooks et alertes ;
- ajouter observabilité : erreurs, latence, paiements, payouts, files de modération, upload et push ;
- définir runbooks incidents et procédures de rapprochement financier ;
- effectuer un canary limité puis élargir progressivement ;
- valider application web, PWA et Android signé.

## Tests
smoke tests post-deploy, paiement sandbox puis test réel autorisé, rollback, rotation secrets, webhook indisponible, reprise des files et vérification de sauvegarde.

## Critères de sortie
Version déployée identifiée, migrations confirmées, alertes opérationnelles, rollback testé, propriétaires d'incident désignés et approbation explicite de release.
