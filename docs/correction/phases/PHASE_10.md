# PHASE 10 — ADMINISTRATION ET MODÉRATION

**Priorité :** élevée.  
**Prérequis :** phases 01 à 09.

## Objectif
Mettre en place un espace d'administration sécurisé et des workflows de modération, support, signalement, sanctions et audit.

## Chantiers
- définir RBAC et attribution contrôlée des rôles ;
- protéger toutes les opérations admin par Edge Function/RPC et RLS ;
- créer files de signalements et revue humaine ;
- gérer sanctions, appels, durée et historique ;
- modérer vidéos, stories, images, produits, messages et profils ;
- protéger les preuves et données personnelles ;
- gérer réponses support, litiges et escalades ;
- journaliser chaque action admin avec acteur, motif, cible, horodatage et résultat.

## Tests
utilisateur normal tente action admin, modérateur hors périmètre, révocation rôle, action expirée, appel accepté/refusé, journal non modifiable.

## Critères de sortie
Aucune action admin basée sur un rôle client falsifiable ; toutes les décisions sont autorisées et auditables.
