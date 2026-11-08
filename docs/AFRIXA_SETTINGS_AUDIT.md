# AFRIXA — Audit S0 des paramètres

**Date :** 6 novembre 2026  
**Périmètre :** S0 uniquement. **Aucune priorité S1 à S9 exécutée.**  
**Branche inspectée :** `fix/afrixa-p1-p8-20261106`.

## 1. Synthèse

La page `src/pages/Settings.tsx` existe déjà avec 12 sections. Elle ne doit pas être recréée. Les paramètres se répartissent entre :
- actions réellement reliées à Supabase/Auth/Firebase ;
- toggles React persistés dans `user_settings.settings`, mais sans effet métier relié ;
- lignes statiques et actions qui affichent seulement un toast ;
- fonctionnalités absentes des migrations/types locaux.

La persistance d'un booléen ne prouve jamais que le comportement produit correspondant est appliqué.

## 2. Sources inspectées et état Git

Fichiers inspectés : `Settings.tsx`, `usePersistedSettings.ts`, `SettingsItem.tsx`, `SettingsSection.tsx`, `AuthContext.tsx`, `useAuth.ts`, `auth.ts`, client/types Supabase, configuration Firebase, `messaging.ts`, `analytics.ts`, `.env.example`, `package.json`, 22 migrations SQL et l'inventaire des 13 fonctions Edge. Les fonctions push et les parcours FedaPay ont été examinés pour distinguer les services existants des fonctions de paramètres.

**Git :**
- L'archive extraite ne contient pas de dossier `.git`. `git status --short` y échoue avec `fatal: not a git repository`.
- Vérification des références distantes : `main` = `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70` ; branche de travail = `66c45432b04bcace59273f3e960b89ef19923f56`.
- La branche de travail est en avance de 8 commits, en retard de 0 sur `main`. La PR brouillon #1 est ouverte et non fusionnée.
- La comparaison distante montre six fichiers déjà modifiés/ajoutés sur cette branche avant S0. Ils sont préservés : le présent audit est ajouté comme nouveau fichier, sans remplacement d'un fichier existant.
- L'état de modifications non commitées sur un ordinateur local ne peut pas être déduit de l'archive ou de l'API GitHub.

**Limite Supabase :** les migrations et types versionnés ont été inspectés, mais aucune connexion SQL authentifiée à la base distante n'était disponible. L'état réellement appliqué des migrations, policies et secrets de production n'est pas confirmé.

## 3. Inventaire — compte et profil

| Paramètre | Source | Comportement actuel | État |
|---|---|---|---|
| Nom, prénom, deuxième prénom | `profiles` | Formulaire éditable, UPDATE Supabase puis `refreshProfile()`. Validation métier limitée. | réel |
| Date de naissance | `profiles.date_naissance` | Envoyée dans l'UPDATE, non affichée dans le récapitulatif. | partiel |
| Lieu de naissance | `profiles.lieu_naissance` | Chargé et sauvegardé dans `profiles`. | réel |
| Profession | `profiles.profession` | Chargée et sauvegardée dans `profiles`. | réel |
| Bio | `profiles.bio` | Chargée et sauvegardée ; validation de longueur absente. | partiel |
| Nationalité | `profiles.nationalite`, `nationalite_flag`, catalogue local | Sélection locale puis UPDATE Supabase. | réel |
| Photo de profil | Aucun upload Storage dans ce contrôle | Toast « Modifier la photo de profil », sans upload. | placeholder |
| Nom d'utilisateur | `profiles.username` pour affichage | Toast seulement, aucun formulaire/UPDATE/unicité. | placeholder |
| Lien vers site web | Aucun champ utilisé | Toast seulement. | placeholder |
| Email | `user.email` pour affichage | Toast seulement, aucun flux `auth.updateUser`. | placeholder |
| Numéro de téléphone | `profiles.numero_mobile` pour affichage | Toast seulement, aucun parcours OTP. | placeholder |
| Mot de passe | Supabase Auth non appelé | Toast seulement, aucun changement de mot de passe. | placeholder |
| Vérification en deux étapes | Booléen React puis JSONB | Toggle sauvegardé, sans enrôlement MFA ni challenge serveur. | placeholder |
| Comptes liés | Valeur statique « Google » | Toast seulement, aucun gestionnaire d'identités liées. | placeholder |
| « Mes infos » | Route `/settings/my-info` | Navigation vers une page dédiée. | partiel |
| Compte créateur | Route `/creators/program` | Navigation ; ne change pas le type de compte dans ce composant. | partiel |
| Compte professionnel | Route `/boost` | Navigation ; ne change pas le type de compte dans ce composant. | partiel |
| Télécharger/exporter mes données | Profil + snapshot React | Copie un JSON limité dans le presse-papiers ; pas d'archive complète serveur. | partiel |
| Désactiver le compte | Dialogue et texte de confirmation local | Affiche « demande enregistrée pour 30 jours » sans requête serveur ni enregistrement. | placeholder |
| Supprimer le compte | Dialogue et texte de confirmation local | Affiche « suppression programmée » sans demande persistée ni suppression Auth/DB. | placeholder |
| Se déconnecter | Supabase Auth | Appelle `signOut()`, retire le token push si possible et redirige. La suppression de token passe par `any`. | réel |

## 4. Inventaire — confidentialité

| Paramètre | Source | Comportement actuel | État |
|---|---|---|---|
| Compte privé | `privateAccount` dans JSONB ; colonne `profiles.is_private` existante | Toggle persisté dans JSONB, mais la colonne profil n'est pas mise à jour ici. | partiel |
| Qui peut voir les vidéos | Valeur statique « Tout le monde » | Aucun menu ni sauvegarde ; pas de lien avec `is_private`. | placeholder |
| Qui peut envoyer des messages | Valeur statique « Amis » ; colonne `profiles.who_can_message` existante | La colonne existe en migration, mais le contrôle ne la lit ni ne l'écrit. | placeholder |
| Autoriser les Duos | `allowDuets` JSONB ; colonne `profiles.allow_duet` existante | Toggle sauvegardé dans JSONB, sans synchronisation de la colonne ni application serveur prouvée. | partiel |
| Autoriser les Stitchs | `allowStitchs` JSONB ; colonne `profiles.allow_stitch` existante | Même écart que Duos. | partiel |
| Autoriser les téléchargements | `allowDownloads` JSONB | Toggle sauvegardé ; aucune application serveur ou colonne dédiée constatée. | partiel |
| Qui peut commenter | Valeur statique « Tout le monde » ; colonne `profiles.who_can_comment` existante | Pas de menu ; colonne existante non utilisée par ce contrôle. | placeholder |
| Qui peut mentionner | Valeur statique « Tout le monde » | Aucun menu ni champ correspondant identifié dans les migrations consultées. | placeholder |
| Filtrer spam/offensif | `filterComments` JSONB ; table globale `banned_words` | Toggle persisté, sans branchement constaté vers le filtrage des commentaires. | partiel |
| Mots-clés filtrés | Toast | « Gérer les mots-clés » affiche un toast ; pas de liste personnelle/CRUD. `banned_words` est un dictionnaire global. | placeholder |
| Comptes bloqués | Valeur fixe « 0 » ; table `user_blocks` existante | Pas de lecture de table ni de liste ; compteur non calculé. | placeholder |
| Comptes restreints | Valeur fixe « 0 » | Pas de gestionnaire relié à ce contrôle. | placeholder |
| Comptes masqués | Valeur fixe « 0 » | Pas de liste ou modèle relié identifié. | placeholder |
| Consentement analytics | `getAnalyticsConsent()`, `setAnalyticsConsent()`, clé locale et Firebase Analytics | Active/désactive réellement Analytics si Firebase est configuré et pris en charge ; consentement stocké localement, pas dans le profil. | partiel |

## 5. Inventaire — notifications

| Paramètre | Source | Comportement actuel | État |
|---|---|---|---|
| Push sur cet appareil | Firebase Messaging, permission navigateur, `user_fcm_tokens` | Demande la permission, enregistre/supprime le token. Dépend de HTTPS, service worker, navigateur et variables Firebase. | bloqué par configuration |
| État du push | Requête `user_fcm_tokens` dans Settings | Lecture réelle, mais via `(supabase as any)` ; table absente des types générés consultés. | partiel |
| Ne pas déranger | `doNotDisturb` JSONB | Toggle et persistance ; aucun filtre ou horaire de notification relié. | partiel |
| Notifications J'aime | `notifyLikes` JSONB | Toggle/persistance uniquement ; aucun filtrage serveur constaté. | partiel |
| Notifications commentaires | `notifyComments` JSONB | Toggle/persistance uniquement. | partiel |
| Notifications nouveaux abonnés | `notifyFollowers` JSONB | Toggle/persistance uniquement. | partiel |
| Notifications mentions | `notifyMentions` JSONB | Toggle/persistance uniquement. | partiel |
| Notifications messages directs | `notifyMessages` JSONB | Toggle/persistance uniquement. | partiel |
| Notifications nouvelles vidéos | `notifyNewVideos` JSONB | Toggle/persistance uniquement. | partiel |
| Fréquence email | Valeur statique « Hebdo » | Aucun menu de fréquence ni service d'envoi relié. | placeholder |

La fonction Edge `send-push-notification` traite les événements INSERT de `notifications`, lit les notifications et tokens, puis appelle FCM. Elle vérifie un secret de webhook et dépend de `FCM_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` et d'un identifiant de projet Firebase. Elle ne lit pas les préférences `notifyLikes`, `notifyComments`, `notifyFollowers`, `notifyMentions`, `notifyMessages`, `notifyNewVideos` ou `doNotDisturb`. Le canal push et les préférences de catégories ne sont donc pas équivalents.

## 6. Inventaire — contenu, affichage et bien-être

| Paramètre | Source | Comportement actuel | État |
|---|---|---|---|
| Lecture automatique | `autoPlay` JSONB | Persistance ; aucune consommation retrouvée dans les lecteurs inspectés. | partiel |
| Économie de données | `dataSaver` JSONB | Persistance ; aucun réglage qualité/débit relié. | partiel |
| HD uniquement sur Wi-Fi | `hdOnWifi` JSONB | Persistance ; aucune vérification réseau/qualité reliée. | partiel |
| Sous-titres automatiques | `autoSubtitles` JSONB | Persistance ; aucun lancement automatique relié. | partiel |
| Mode sombre | `darkMode` JSONB | Persistance sans changement global de thème dans cette page. Dépendance `next-themes` présente, mais aucun provider de thème identifié dans le parcours inspecté. | partiel |
| Taille du texte | Valeur statique « Moyen » | Aucun sélecteur ni effet. | placeholder |
| Langues de contenu | Valeur statique « Français » | Aucun sélecteur/filtrage relié. | placeholder |
| Sujets d'intérêt | Navigation générique | Aucun écran ou stockage relié à ce contrôle. | placeholder |
| Limite quotidienne d'écran | Valeur statique « Non définie » | Pas de choix ni de suivi de limite. | placeholder |
| Rappels de pause | `screenTimeReminder` JSONB | Persistance, sans planificateur ni déclencheur. | partiel |
| Tableau de bord activité | Toast | Toast informatif seulement. | placeholder |
| Rappel heure de coucher | `sleepReminder` JSONB | Persistance, sans horaire ni planificateur. | partiel |
| Supervision familiale | Navigation générique | Aucun parcours relié depuis cette ligne. | placeholder |

## 7. Inventaire — créateur, accessibilité, langue, stockage, sécurité, support et légal

| Paramètre | Source | Comportement actuel | État |
|---|---|---|---|
| Vue d'ensemble / performance / abonnés créateur | Route `/creators/studio` | Les trois lignes naviguent vers la même destination ; aucun réglage modifié. | partiel |
| Fonds créateurs / cadeaux Live / informations bancaires | Route `/creators/wallet` | Navigation vers wallet ; aucun paramètre financier modifié ici. | partiel |
| Effets favoris | Navigation générique | Aucun gestionnaire relié. | placeholder |
| Sons enregistrés | Navigation générique | Aucun gestionnaire relié. | placeholder |
| Brouillons | Valeur statique « 3 » | Compteur non calculé. | placeholder |
| Contraste élevé | `highContrast` JSONB + classe DOM | Classe `high-contrast` appliquée/retirée ; aucune règle CSS correspondante retrouvée dans `src`. | partiel |
| Réduire les animations | `reducedMotion` JSONB + classe DOM | Classe `reduce-motion` appliquée/retirée ; aucune règle CSS correspondante retrouvée dans `src`. | partiel |
| Taille des sous-titres | Valeur statique « Moyen » | Aucun sélecteur ni effet sur le lecteur. | placeholder |
| Langue de l'application | Valeur statique « Français » | Aucun changement de langue ; i18next est une dépendance, mais ce contrôle ne l'appelle pas. | placeholder |
| Région | Valeur statique « Niger » | Aucune lecture système ni persistance depuis cette ligne. | placeholder |
| Format de l'heure | Valeur statique « 24h » | Aucune sélection/application. | placeholder |
| Taille du cache | Somme des clés/valeurs localStorage | Mesure tout localStorage, pas seulement le cache Afrixa, Cache Storage ou IndexedDB. | partiel |
| Vider le cache Afrixa | Clés localStorage préfixées `afrixa:` | Supprime réellement certaines clés locales, mais pas Cache Storage, IndexedDB, fichiers téléchargés ou caches service worker. | partiel |
| Vidéos téléchargées | Valeur statique « 3 vidéos » | Aucun inventaire de téléchargements. | placeholder |
| Précharger les vidéos | Inversion de `dataSaver` | Change le booléen d'économie de données ; aucun préchargement effectif relié. | partiel |
| Appareils connectés | Valeur statique « 2 » ; table `login_history` existante | Aucun inventaire de sessions/appareils lu par ce contrôle. | placeholder |
| Emails de sécurité | `securityEmails` JSONB | Toggle/persistance uniquement ; aucun service email ne lit ce réglage dans le parcours inspecté. | partiel |
| Permissions caméra/micro/photos/localisation | Valeurs statiques « Autorisé » / « Jamais » | Aucun appel API navigateur/Capacitor pour obtenir l'état réel de l'OS. | placeholder |
| Signaler un problème | Aucun gestionnaire attaché | Ligne sans navigation/action. | placeholder |
| Consignes communautaires | Aucun gestionnaire attaché | Ligne sans navigation/action. | placeholder |
| Aide & Support / Contacter / Commentaires | Route `/help-support` | Navigation vers le centre d'aide. | réel |
| Message rapide au support | État React `supportMessage` | Valide le texte, l'efface et affiche un toast ; aucun INSERT/API/fonction serveur. | placeholder |
| Conditions, confidentialité, consignes, licences, mentions légales | Aucune destination attachée | Lignes d'interface sans navigation/action. | placeholder |
| Version | Valeur statique « 2.0.0 » | Codée en dur dans la page et le pied de page. | placeholder |
| Recherche de paramètres | Index local de 12 sections | Filtre des mots-clés codés en dur et ouvre l'accordéon correspondant. | réel |
| Raccourci « Audit confidentialité » | État local des accordéons | Ouvre les sections confidentialité/sécurité et affiche un toast ; ce n'est pas un audit automatisé. | partiel |

## 8. Persistance et schéma Supabase

### Table `public.user_settings`

La migration `20261017100000_user_settings.sql` crée `user_id` (PK et FK vers `auth.users`), `settings` JSONB objet et `updated_at`. RLS est activée avec policies SELECT/INSERT/UPDATE limitées à `auth.uid() = user_id`. C'est une source réelle de stockage pour les toggles qui passent par le hook, pas une preuve d'application métier.

### Problèmes du hook actuel

1. `usePersistedSettings.ts` écrit dans `localStorage` sous `afrixa:user-settings:v1`, tandis que `Settings.tsx` lit et réécrit la même clé : doublon de persistance.
2. La clé locale est globale, non isolée par `user.id` : risque de réutilisation des préférences d'un compte sur un autre appareil/compte.
3. En cas d'erreur de lecture Supabase, le hook fixe tout de même `hydrated=true`, puis peut écrire les valeurs courantes. Une erreur de lecture ne bloque donc pas la sauvegarde.
4. Si le JSONB contient une valeur non booléenne, `toBooleanSettings()` rejette l'objet entier ; le hook peut ensuite réécrire la forme booléenne et écraser les autres clés.
5. Chaque sauvegarde automatique affiche un toast de succès.
6. Le hook est limité aux booléens et n'a pas de contrat distinct pour chaînes, nombres, listes ou horaires.

Ces éléments sont des constats destinés à S1 ; aucune correction S1 n'est effectuée ici.

### Schéma et types

Tables/colonnes existantes utiles : `user_settings`, `profiles.is_private`, `profiles.who_can_comment`, `profiles.who_can_message`, `profiles.allow_duet`, `profiles.allow_stitch`, `user_blocks`, `follow_requests`, `banned_words`, `user_fcm_tokens`, `login_history`, ainsi que plusieurs tables créateur/wallet/analytics.

Les types générés consultés contiennent `profiles` et `user_settings`, mais pas `user_fcm_tokens`, alors que Settings/AuthContext/messaging l'utilisent via `any` ou type local. Les types générés ne reflètent pas tout le schéma migré.

### Tables des spécifications non retrouvées dans les migrations locales ni dans les types consultés

| Table | Migrations locales | Types générés | État |
|---|---|---|---|
| `akili_subscriptions` | non retrouvée | non retrouvée | absent |
| `diaspora_profiles` | non retrouvée | non retrouvée | absent |
| `user_category_affinity` | non retrouvée | non retrouvée | absent |
| `notification_preferences` | non retrouvée | non retrouvée | absent |
| `pay_later_plans` | non retrouvée | non retrouvée | absent |
| `creator_settings` | non retrouvée | non retrouvée | absent |
| `akili_usage` | non retrouvée | non retrouvée | absent |
| `akili_generated_videos` | non retrouvée | non retrouvée | absent |
| `virality_reports` | non retrouvée | non retrouvée | absent |

« Absent » signifie absent des migrations locales et types inspectés, pas nécessairement absent de la base distante non accessible. Aucune de ces tables n'a été créée.

## 9. Auth, fonctions serveur et configuration

- `AuthContext.tsx` utilise Supabase Auth hors développement. En mode `import.meta.env.DEV`, il fournit un utilisateur/session/profil fictifs ; un test en mode dev ne prouve donc pas le fonctionnement avec un vrai compte.
- Le client Supabase lit `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Firebase dépend des variables `VITE_FIREBASE_*`; le push Web nécessite aussi `VITE_FIREBASE_VAPID_KEY`. `.env.example` ne contient que des valeurs fictives. La configuration réellement déployée n'a pas été vérifiée.
- Treize fonctions Edge sont présentes. La fonction directement liée aux paramètres est `send-push-notification`; elle ne lit pas les préférences de catégories. Aucune fonction dédiée à MFA, changement d'email/téléphone/mot de passe, export complet, désactivation/suppression ou application des préférences de confidentialité n'a été identifiée.
- Les fonctions FedaPay existantes concernent le paiement des commandes ; elles ne constituent pas un système d'abonnement Akili. Le fournisseur autorisé pour ce produit reste à confirmer avant une priorité ultérieure.

## 10. Build, lint et tests

Scripts présents dans `package.json` : `build` = `vite build`, `lint` = `eslint .`. Aucun script `test` n'est déclaré.

Commandes lancées dans l'archive extraite :
- `npm run build` : **échec** — `sh: 1: vite: not found`.
- `npm run lint` : **échec** — `sh: 1: eslint: not found`.

Node disponible : `v22.16.0`. Les dépendances sont incomplètes ; `node_modules/.bin/vite` et `node_modules/.bin/eslint` sont absents. Aucun build/lint positif ni test automatisé ne peut être annoncé.

## 11. Fichiers modifiés pendant S0

| Fichier | Action |
|---|---|
| `docs/AFRIXA_SETTINGS_AUDIT.md` | Création du présent rapport uniquement |

Aucun composant, hook, type, fichier de configuration ou migration SQL n'a été modifié. Aucune migration n'a été exécutée sur Supabase.

## 12. Rapport de livraison

- **PRIORITÉ :** S0 — audit de référence.
- **STATUT :** inspection du dépôt terminée ; état Git local et schéma Supabase distant non vérifiables depuis l'archive/API utilisée.
- **FICHIERS LUS :** page Paramètres, hook, composants, Auth, types/client Supabase, migrations, fonctions Edge pertinentes, configuration et package.json.
- **FICHIERS MODIFIÉS :** `docs/AFRIXA_SETTINGS_AUDIT.md` uniquement.
- **MIGRATIONS AJOUTÉES :** aucune.
- **CONFIGURATION REQUISE :** vérifier les variables Supabase/Firebase déjà référencées dans `.env.example` et les secrets serveur push ; aucune valeur secrète n'est reproduite.
- **COMPORTEMENT AVANT :** mélange d'états React, localStorage global, JSONB Supabase, actions réelles et placeholders.
- **COMPORTEMENT APRÈS :** aucun comportement applicatif modifié ; les contrôles sont documentés dans ce rapport.
- **TESTS EXÉCUTÉS :** build échoué (`vite: not found`) ; lint échoué (`eslint: not found`) ; aucun script test déclaré.
- **RISQUES RESTANTS :** fuite/réutilisation locale entre comptes, sauvegarde après erreur de lecture, préférences non appliquées côté serveur, schéma distant non vérifié, dépendances de build/lint manquantes.
- **VALIDATION ATTENDUE :** validation explicite de S0 avant S1 à S9.

**Arrêt :** aucune priorité S1 à S9 n'a été exécutée.
