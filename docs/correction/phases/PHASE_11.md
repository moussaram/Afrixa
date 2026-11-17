# PHASE 11 — FRONTEND ET EXPÉRIENCE UTILISATEUR

**Priorité :** moyenne, après sécurisation backend.  
**Prérequis :** phases 03 à 10.

## Objectif
Raccorder les écrans existants aux contrats réels sans recréer inutilement les pages ni supprimer de fonctionnalités.

## Chantiers
- remplacer les mocks par les services validés domaine par domaine ;
- supprimer les faux succès et toasts qui prétendent confirmer une mutation non persistée ;
- gérer loading, empty, error, retry, offline et permissions ;
- unifier formulaires avec Zod/React Hook Form ;
- harmoniser navigation, états de compte et permissions ;
- brancher paramètres, langue, thème, accessibilité et stockage ;
- optimiser médias, cache, pagination, virtualisation et accessibilité mobile ;
- conserver les fonctionnalités réelles et migrer progressivement les mocks.

## Tests
tests composants, navigation profonde, états offline, petit écran, lecteur vidéo, formulaires, erreurs API, lecteur d'écran et clavier.

## Critères de sortie
Chaque bouton métier a un effet serveur documenté ou est clairement désactivé ; aucun faux succès ni donnée fictive présentée comme réelle.
