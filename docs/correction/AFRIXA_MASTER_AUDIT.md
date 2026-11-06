# AFRIXA — AUDIT TECHNIQUE GLOBAL (PHASE 0)

**Date :** 7 novembre 2026  
**Référence auditée :** branche `main`, commit `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70`.  
**Branche documentaire :** `audit/phase-00-global-20261107`, créée depuis ce commit.  
**Périmètre :** architecture, frontend, backend Supabase, migrations, RLS, intégrations, sécurité, données, parcours métier et préparation des corrections.  
**Règle :** aucune modification fonctionnelle n'est autorisée pendant cette phase.

## 1. Conclusion exécutive

Afrixa possède une base technique crédible : application React/Vite/TypeScript, routage, PWA/Capacitor, Supabase Auth/PostgreSQL/Realtime/RLS/Edge Functions, et plusieurs intégrations spécialisées. Ce dépôt ne correspond toutefois pas encore à une plateforme social-commerce entièrement opérationnelle.

Le code juxtapose trois niveaux :
1. des flux réellement connectés (authentification, messagerie, upload Cloudflare, sessions Agora, une partie du checkout FedaPay, lecture/écriture de produits) ;
2. des flux partiels dont le backend existe mais que l'interface ne relie pas, ou dont la validation métier reste incomplète ;
3. des écrans de démonstration reposant sur des tableaux mock, des valeurs statiques, des timers ou des toasts de succès.

**Le risque dominant est l'écart entre l'interface et la vérité serveur**, particulièrement pour les finances, les profils privés, la publication de vidéos et les notifications.

## 2. Architecture réelle observée

| Couche | Technologie / éléments constatés | État |
|---|---|---|
| Application web | React 18, TypeScript, Vite 5, React Router 6 | présent |
| UI | Tailwind CSS, composants shadcn/Radix, Lucide, Sonner | présent |
| État / requêtes | TanStack Query installé, hooks React maison | partiel ; pas de couche métier centralisée uniforme |
| Authentification | Supabase Auth : téléphone/OTP, email/mot de passe, OAuth Google | implémenté côté client ; configuration de production non vérifiée |
| Backend | Supabase PostgreSQL, RLS, Realtime, 13 Edge Functions | présent, couverture fonctionnelle inégale |
| Types | Types Supabase générés | fortement incomplets : 18 tables typées sur 68 tables définies par les migrations main |
| Média vidéo | Cloudflare Stream, upload TUS, HLS | upload et statut présents ; modération/publication incomplètes |
| Live | Agora RTC et génération de jetons côté serveur | transport audio/vidéo présent ; chat/cadeaux/réactions surtout locaux |
| Paiements | FedaPay pour commandes XOF | backend présent ; composant de checkout réel non raccordé au parcours marketplace observé |
| Notifications | Firebase Cloud Messaging | service présent, dépend de secrets/configuration et d'un webhook DB |
| Analytics | Firebase Analytics avec consentement | collecte conditionnelle présente ; analytics métier incomplets |
| Cartographie | Google Places/Maps | autocomplétion présente avec saisie manuelle de secours |
| Modération image | Google Cloud Vision SafeSearch | utilisée sur la couverture des lives ; pas de pipeline global |
| Mobile | Capacitor Android 8 | wrapper Android présent |
| PWA | vite-plugin-pwa, service worker et manifest | présent |

Le README mentionne Stripe pour la diaspora comme « à intégrer » et le chat live comme « à intégrer ». Aucun SDK Stripe ni fonction Stripe n'a été trouvé dans le dépôt inspecté.

## 3. Taille et composition du dépôt

Sur la référence GitHub main :
- 363 fichiers suivis dans l'arbre Git ;
- 49 pages React recensées dans l'archive de travail ;
- 125 composants UI/métier recensés ;
- 20 hooks recensés ;
- 22 migrations SQL sur main ;
- 13 Edge Functions ;
- 18 tables déclarées dans les types Supabase générés ;
- 68 tables distinctes créées par les migrations main.

Les comptes de fichiers frontend proviennent de l'inventaire de l'archive de travail associée au dépôt ; l'arbre GitHub main est la référence pour les commits, migrations et fichiers vérifiés à distance. L'archive locale ne contient pas de dossier `.git`.

## 4. État global des fonctionnalités

| Domaine | État global | Constat principal |
|---|---|---|
| Authentification | partiel/réel | Supabase Auth existe ; mode DEV fournit un utilisateur fictif ; sécurité de compte avancée et gestion des sessions absentes |
| Profils | partiel | profil Auth/DB réel, mais plusieurs vues s'appuient sur des utilisateurs et vidéos fictifs ; profil public expose trop de champs par RLS |
| Feed / découverte | simulé | `Index` et `Discover` consomment `mockVideos`/`mockUsers`, pas un flux de production |
| Likes / favoris / follows | simulé sur main | `useSocialInteractions` utilise des timers et commentaires « replace with real fetch » ; `useFollow` aussi |
| Commentaires | partiel/réel | table `comments`, hook et Realtime présents ; interface conserve un jeu mock pour les identifiants non UUID |
| Stories | simulé/partiel | données UI mock ; schéma et fonction de nettoyage existent, mais création/lecture/visionnage ne sont pas intégralement reliés |
| Messagerie privée | partiel/réel | conversations, messages et Realtime connectés ; règles de confidentialité, blocage, médias et intégrité conversation à renforcer |
| Lives | partiel/réel | Agora et jetons contrôlés côté serveur ; chat, réactions, likes et cadeaux ne sont pas persistés de bout en bout |
| Upload vidéo | partiel/réel | TUS/Cloudflare réel ; vidéo reste en attente de modération et aucun workflow d'approbation/publication complet n'est relié |
| Marketplace | partiel/simulé | boutique vendeur utilise Supabase, mais catalogue principal, boutiques et vidéos shoppables utilisent des mocks |
| Commandes | simulé | pages Orders/OrderDetail affichent des données fictives ; confirmation, litige et avis affichent des toasts sans mutation DB |
| Paiement marketplace | partiel | FedaPay serveur existe ; `AfrixaPayment` n'est pas référencé dans le parcours actif, tandis que `AfrixaPaySheet` simule un succès |
| Livraison | partiel | Google Places et lien profond Yango ; pas de preuve d'intégration transporteur, suivi ou webhook livraison |
| Portefeuille vendeur | bloqué/partiel | fonction payout serveur présente mais désactivée par configuration ; bouton retrait indique indisponible ; solde UI calculé de façon incorrecte |
| Afrixa Coins | absent opérationnel | écran statique, boutons sans action ; tables sans ledger transactionnel sécurisé |
| Cadeaux / tips | simulé/dangereux | cadeaux statiques ; tip peut écrire directement une ligne de revenus sans paiement réel |
| Monétisation créateur | partiel/dangereux | tables et écrans existent ; écritures de revenus et wallet non suffisamment protégées |
| Premium | simulé | écran tarifaire statique, aucun parcours de souscription/renouvellement |
| Publicités | simulé | formulaire sans handler ; tables de campagne/impressions présentes mais pas de cycle de facturation/livraison |
| Recherche | partiel | vidéos, profils, produits et sons interrogés ; challenges retournent un tableau vide |
| Notifications | partiel | DB/Realtime/FCM présents ; fallback mock si erreur ou absence de données, préférences de catégories non appliquées |
| Modération | partiel | signalement/blocage/limites et modération image ont des briques ; console admin et application cohérente des sanctions absentes |
| Administration | absent | aucune route ou RBAC admin identifiable dans l'application inspectée |
| Analytics | partiel | Firebase Analytics sous consentement ; tables analytiques présentes sans pipeline métier complet |
| Paramètres | partiel | page déjà présente ; beaucoup de toggles stockés sans effet réel. Audit détaillé disponible dans le rapport S0 antérieur de la branche de travail précédente, non fusionné dans main |

## 5. Risques majeurs confirmés dans les sources

### Critiques
1. **Exposition de données personnelles :** policy SELECT de `profiles` avec `USING (true)`, alors que la table contient notamment date/lieu de naissance, numéro mobile, identifiants de vérification et informations de profil.
2. **Écriture directe de soldes créateur :** policies `FOR ALL` propriétaire sur `creator_wallet` et `afrixa_coins` autorisent le propriétaire à modifier des champs de solde.
3. **Fausse confirmation de paiement :** `AfrixaPaySheet` affiche un succès après un timer, génère une référence aléatoire et notifie fictivement le vendeur, sans FedaPay ni commande serveur.
4. **Création arbitraire de notifications :** policy historique `System can insert notifications` avec `WITH CHECK (true)` toujours présente dans la chaîne de migrations ; les policies permissives PostgreSQL s'additionnent.
5. **Contournement de modération vidéo :** policies INSERT/UPDATE de `videos` limitées à la propriété de la ligne, sans contrainte serveur empêchant un client d'envoyer directement `is_published=true` ou `moderation_status='approved'`.
6. **Edge Functions privilégiées sans autorisation métier explicite :** `calculate-scores` et `cleanup-stories` utilisent la clé service-role sans contrôle d'identité/rôle/secret dans le handler.

### Élevés
- Les paramètres de confidentialité de profil ne sont pas respectés uniformément ; `profiles` reste lisible publiquement.
- Les politiques de conversations autorisent des mises à jour de la ligne par un participant sans verrouiller explicitement l'identité des deux participants.
- Les réglages `who_can_message`, blocage et restrictions ne sont pas appliqués systématiquement aux parcours.
- Les flux financiers sont répartis en plusieurs requêtes ; certaines opérations et créations de splits ne sont pas transactionnelles.
- Le stock est vérifié avec verrou de lecture lors de la création de commande, mais aucun décrément/réservation atomique n'est observé dans ce trigger.
- Les fonctions de rate-limit sont présentes mais le hook d'application n'est pas utilisé par les parcours observés.
- Les paiements coins, les cadeaux et les abonnements créateur n'ont pas de parcours serveur de débit/crédit complet.

## 6. Incohérences de données

- 68 tables SQL distinctes contre 18 tables dans les types générés.
- `comments` et `video_comments` coexistent ; le hook de commentaires utilise `comments`.
- `creator_wallet`, `afrixa_coins`, `coin_balances`, `transactions`, `coin_purchases` et `coin_transactions` forment plusieurs représentations financières non unifiées.
- `notification_settings` coexiste avec `user_settings.settings`.
- Les tables Premium, coins, fan-club et abonnements ne sont pas reliées à un moteur de paiement opérationnel dans le frontend.
- Plusieurs relations attendues ne sont pas matérialisées par FK dans les migrations, notamment `orders.product_id` et `payment_transactions.order_id`.
- Certaines tables ont des politiques RLS permissives trop larges ou des insertions directes client.

## 7. État Git et préservation

- `main` reste à `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70` au début de cette phase.
- Une branche précédente `fix/afrixa-p1-p8-20261106` et sa PR brouillon #1 sont distinctes et non fusionnées. Elles ne sont pas utilisées comme base de ce rapport.
- La branche actuelle `audit/phase-00-global-20261107` est créée depuis main.
- L'archive locale fournie ne contient pas `.git` ; `git status` local n'est donc pas disponible. L'état distant est contrôlé par les références GitHub.
- Aucun code source, migration ou fichier de configuration n'est modifié dans cette Phase 0.

## 8. Limites de preuve

La cartographie couvre l'arbre du dépôt, les routes/pages et les points d'entrée métier, les hooks/services, les appels Supabase repérables, les 22 migrations, les 13 fonctions Edge et les parcours à risque. Les composants ont fait l'objet d'un inventaire et d'un balayage statique ; une exécution manuelle de chaque bouton/état dans un navigateur et sur Android n'a pas été possible dans cette phase. L'inventaire fonctionnel regroupe donc les actions par parcours métier : il ne constitue pas encore un procès-verbal de clic de chaque contrôle visuel.

Non vérifiable sans accès de production :
- migrations effectivement appliquées et éventuels objets créés manuellement ;
- policies RLS actives dans la base distante et privilèges SQL effectifs ;
- secrets et variables d'environnement réels ;
- statut des comptes FedaPay, capacité payout et webhooks configurés ;
- comptes Firebase/Cloudflare/Agora/Google et restrictions API ;
- cron/scheduler externe des fonctions de calcul et nettoyage ;
- volumes, erreurs, latences, données réelles et traces de paiement ;
- comportement sur appareils réels et tests utilisateurs.

Le rapport ne révèle aucun secret ni identifiant sensible de projet.

## 9. Décision d'architecture recommandée

Conserver la stack actuelle. Ne pas réécrire l'application et ne pas créer de tables spéculatives. Les corrections doivent d'abord sécuriser les accès et la vérité financière, puis synchroniser les types et le schéma, puis rétablir les parcours métiers dans l'ordre du roadmap. Chaque nouvelle table éventuelle devra être justifiée par une lacune prouvée, un modèle métier validé, des relations, contraintes, RLS et tests.

## 10. Documents associés

- [Inventaire fonctionnel](AFRIXA_FEATURES_INVENTORY.md)
- [Cartographie base de données](AFRIXA_DATABASE_MAP.md)
- [Cartographie API](AFRIXA_API_MAP.md)
- [Audit sécurité](AFRIXA_SECURITY_AUDIT.md)
- [Roadmap](AFRIXA_CORRECTION_ROADMAP.md)
- [Avancement](AFRIXA_PROGRESS.md)
- [Rapport de tests](AFRIXA_TEST_REPORT.md)
- [Phases 00 à 13](phases/PHASE_00.md)

**Statut Phase 0 :** audit documentaire préparé ; aucune correction fonctionnelle exécutée.
