# PHASE 05 — VIDÉOS, STORIES, FEED ET RECOMMANDATIONS

**Priorité :** élevée.  
**Prérequis :** phases 01 à 04.

## Objectif
Construire le cycle de vie complet média : upload, traitement, modération, publication, diffusion, stories et ranking.

## Chantiers
- sécuriser la création vidéo contre INSERT direct publié ;
- connecter Cloudflare upload, statut, modération, approbation et publication ;
- définir stockage des miniatures, droits et suppressions ;
- remplacer feed mock par requêtes paginées respectant privacy/follows/blocks ;
- brancher likes/saves/comments/watch history et compteurs ;
- connecter stories et expiration/nettoyage sécurisé ;
- rendre le calcul de scores déclenché par une tâche protégée et dimensionné ;
- définir politique de contenus signalés et appels.

## Tests
fichier invalide/trop grand, interruption TUS, vidéo privée/followers/public, tentative publication non modérée, suppression, expiration story, ranking et charge.

## Critères de sortie
Une vidéo n'est visible qu'après contrôle serveur ; feed/stories alimentés par données réelles et règles d'accès vérifiées.
