# PHASE 01 — SÉCURITÉ, AUTORISATIONS ET INTÉGRITÉ

**Priorité :** critique.  
**Prérequis :** Phase 00 validée.

## Objectif
Fermer les accès cross-user, protéger PII, soldes, transactions, publication vidéo, fonctions privilégiées et opérations sensibles avant d'étendre les fonctionnalités.

## Chantiers
1. Revoir grants et policies de `profiles`, notifications, finance, vidéos, conversations, typing, présence, memberships et tables créateur.
2. Définir matrice rôles : utilisateur, acheteur, vendeur, créateur, support, modérateur, admin et service.
3. Introduire une séparation public/privé des champs de profil.
4. Réserver les changements de soldes, statuts financiers, modération et publication au serveur.
5. Protéger calculate-scores/cleanup-stories par identité de tâche.
6. Appliquer blocs, restrictions et paramètres de confidentialité aux lectures/écritures.
7. Contrôler rate limiting, validation payload, CORS et logs.

## Fichiers/systèmes candidats
Migrations RLS, Edge Functions, `src/lib/security.ts`, hooks sécurité, fonctions de profils, conversations, upload et paiements. Aucun fichier ne doit être changé sans vérification de la base appliquée.

## Tests obligatoires
Anon/A/B/propriétaire/non-propriétaire, spoofing user_id, insert/update/delete, JWT invalide, secret webhook invalide, replay, abus rate-limit et publication directe vidéo.

## Critères de sortie
Aucune lecture/écriture non autorisée ; soldes et publication non modifiables par le client ; tests RLS/Edge réussis sur staging ; plan rollback documenté.
