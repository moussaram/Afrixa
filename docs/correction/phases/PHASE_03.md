# PHASE 03 — AUTHENTIFICATION ET IDENTITÉ

**Priorité :** élevée.  
**Prérequis :** phases 01 et 02.

## Objectif
Rendre inscription, OTP, connexion, OAuth, profil, récupération de compte et sessions fiables en production.

## Chantiers
- vérifier SMS/Twilio, SMTP, CAPTCHA, rate limits et redirections OAuth ;
- différencier clairement DEV_MODE et environnement de production ;
- sécuriser username, téléphone, email, date de naissance et complétion du profil ;
- synchroniser les données Auth et `profiles` ;
- définir gestion des appareils, sessions, changement de mot de passe, email/téléphone, MFA et suppression/export de compte ;
- protéger les champs personnels par RLS/colonnes ;
- créer des parcours d'erreur et reprise.

## Tests
OTP expiré/incorrect, compte existant, email non confirmé, OAuth callback, session renouvelée/révoquée, changement de téléphone, MFA et accès profil cross-user.

## Critères de sortie
Tous les parcours Auth testés sur staging, aucun faux utilisateur en build production, profil et données privées protégés.
