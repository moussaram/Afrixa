# Afrixa — ordre 7 : parcours complet de test

Date de préparation : 9 novembre 2026  
Branche de travail : `fix/afrixa-order-7-e2e-20261109`  
Base : `fix/afrixa-order-6-public-profiles-20261109`

## Objectif

Valider le parcours d'un nouvel utilisateur depuis la création de compte jusqu'à une utilisation normale de l'application, y compris les accès multi-comptes et la récupération de session.

## Préconditions staging

- [ ] Projet Supabase Afrixa actif et accessible.
- [ ] Toutes les migrations présentes dans la branche sont appliquées et leur statut est vérifié.
- [ ] Variables frontend `VITE_SUPABASE_URL` et clé publishable/anon du staging configurées ; aucune clé service-role dans le navigateur.
- [ ] Fournisseur SMS Supabase configuré (ou numéros de test explicitement prévus par Supabase).
- [ ] Google OAuth redirect URLs et callback `/auth/callback` configurés si le test Google est activé.
- [ ] Domaine staging et redirect URLs de récupération du mot de passe configurés.
- [ ] Trois comptes de test contrôlés : utilisateur A, utilisateur B et compte anonyme.
- [ ] Pas de données réelles ou de clients dans le staging.

## Scénarios de bout en bout

| ID | Parcours | Résultat attendu |
|---|---|---|
| AUTH-01 | Ouvrir Afrixa sans session | Redirection vers `/auth/login`; aucune page privée accessible. |
| AUTH-02 | Créer un compte avec téléphone et identité requise | Validation des champs; Supabase Auth crée l'utilisateur; OTP SMS envoyé; aucun mot de passe stocké dans le profil. |
| AUTH-03 | Vérifier un OTP valide | Session établie; profil unique créé/complété; numéro vérifié dérivé de Supabase Auth; navigation vers Afrixa. |
| AUTH-04 | OTP invalide/expiré | Message clair; aucun profil complété artificiellement; possibilité de renvoyer un code après délai. |
| AUTH-05 | Répéter l'inscription avec le même numéro | Pas de compte/profil dupliqué; erreur contrôlée. |
| AUTH-06 | Connexion par téléphone puis déconnexion | Connexion correcte; données de compte chargées; logout supprime la session locale et redirige vers login. |
| AUTH-07 | Connexion par email (si activée) | Email normalisé; authentification correcte et erreurs génériques en cas d'échec. |
| AUTH-08 | OAuth Google | Callback valide; profil existant chargé ou formulaire de profil incomplet présenté; retour login sur échec OAuth. |
| AUTH-09 | Récupération mot de passe email et téléphone | Lien/OTP lié au compte; mot de passe modifiable; ancien mot de passe refusé; session de récupération traitée sans fuite de compte. |
| PROFILE-01 | Charger le profil après inscription et après actualisation | Une ligne `profiles` correspond à l'ID Auth; données persistantes; aucun profil fictif. |
| PROFILE-02 | Compléter les champs obligatoires | `inscription_complete` devient vrai uniquement si nom, prénom, date/lieu de naissance et profession sont fournis. |
| PROFILE-03 | Modifier puis recharger les paramètres | Champs autorisés sauvegardés; numéro et indicateurs de vérification restent serveur/Auth gérés. |
| ONB-01 | Compléter les 5 étapes d'onboarding | Progression et intérêts persistés; abonnements sélectionnés réellement enregistrés; fin vers le fil. |
| ONB-02 | Reprendre après fermeture/refresh | L'étape enregistrée est restaurée sans perte de sélection. |
| FEED-01 | Fil sans vidéos et fil avec vidéos autorisées | Empty state / vidéos affichées; erreurs récupérables; pagination ne duplique pas les lignes. |
| SOCIAL-01 | A suit le profil public B | Relation persistée, compteurs mis à jour après rechargement, vidéo visible selon politique d'accès. |
| SOCIAL-02 | A demande à suivre le profil privé B | Demande pending créée; bio/vidéos/statistiques privées non exposées à A. |
| SOCIAL-03 | B accepte ou refuse | Acceptation crée le lien follow; refus ne crée pas le lien; A ne peut pas modifier la décision de B. |
| SOCIAL-04 | A et B se bloquent | Carte et interactions interdites dans les deux sens selon les politiques. |
| SECURITY-01 | A lit/modifie directement le profil privé de B via Data API | SELECT/UPDATE/INSERT refusé ou aucune ligne accessible; aucune colonne de téléphone, vérification ou naissance divulguée. |
| SECURITY-02 | Utilisateur anonyme consulte les profils | Seules les cartes publiques minimales sont visibles. |
| SECURITY-03 | Client tente de changer numéro ou flags de vérification | Refus par permissions/trigger; Auth reste la source de vérité. |
| SESSION-01 | Rafraîchir une page puis ouvrir un autre onglet | Session restaurée correctement; profil cohérent; pas de redirection prématurée. |
| SESSION-02 | Session expirée / réseau indisponible | Message récupérable; pas de boucle de navigation ni écran bloqué. |

## Tests techniques à exécuter

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. Vérifier le statut GitHub Actions de cette branche.
5. Sur Supabase staging : exécuter les tests multi-rôles (anon, A, B) pour chaque scénario SECURITY.
6. Vérifier les journaux Auth/API/Postgres en cas d'échec, en supprimant ou masquant tout OTP, token, téléphone ou email des rapports.

## Défauts trouvés pendant la revue du code

- **Suggestions de créateurs sous RLS** : l'onboarding interrogeait la table privée `profiles` pour obtenir les profils d'autres utilisateurs. Avec les politiques propriétaire-seulement, la requête ne peut pas fournir les créateurs attendus. La branche ordre 7 la redirige vers `public_profiles` et limite les suggestions aux comptes publics.
- **Validation réelle non terminée** : le projet Supabase `Afrixa` (`kxxwdiyloplkoyperwty`) apparaît actuellement `INACTIVE`. Les requêtes de base ont retourné « Database is possibly not accessible at the moment ». Aucun projet n'a été réveillé et aucune migration distante n'a été exécutée.

## Statut des preuves

- [x] Revue des principaux fichiers Auth, profil, onboarding et politiques RLS.
- [x] Correction du point de récupération des créateurs qui contredisait RLS.
- [ ] Lint/build de cette branche (CI).
- [ ] Parcours Auth SMS réel avec comptes de staging.
- [ ] Tests de confidentialité multi-comptes sur la base.
- [ ] Parcours OAuth, récupération, session et fonctionnalités sociales sur staging.

**Ne pas annoncer l'ordre 7 comme validé en production avant que les cases de staging soient exécutées et que les résultats soient consignés.**
