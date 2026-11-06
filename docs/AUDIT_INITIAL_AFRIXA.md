# Afrixa — Audit initial P0

**Date de l'audit :** 6 novembre 2026  
**Dépôt :** `moussaram/Afrixa`  
**Branche source inspectée :** `main`  
**Commit source :** `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70` — `Connect comments panel to realtime data`  
**Branche de livraison du rapport :** `audit/p0-initial-20261106`  
**Périmètre :** audit statique du contenu GitHub de la branche source. Aucune fonctionnalité métier n'a été modifiée.

> **Limite d'exécution :** le dépôt n'a pas pu être cloné dans l'environnement d'audit (résolution réseau de `github.com` indisponible). Le rapport repose donc sur la lecture des fichiers versionnés via GitHub. Aucun `git status` local, `npm install`, build, lint, test, migration Supabase ou test de production n'a pu être exécuté. Ces résultats sont indiqués comme non exécutés, jamais comme réussis.

## 1. État Git et préservation

- La branche distante `main` a été lue sans modification.
- HEAD observé : `c2c7b1d`.
- Une branche indépendante `audit/p0-initial-20261106` a été créée depuis exactement ce commit.
- Le présent rapport est le seul fichier ajouté sur cette branche.
- Aucun fichier métier, migration SQL, type, configuration ou fonctionnalité n'a été modifié.
- Les changements locaux non commités sur le téléphone/ordinateur de développement ne sont pas visibles via GitHub. Ils n'ont donc été ni inspectés ni écrasés. Avant tout travail local ultérieur, exécuter `git status --short` et conserver les changements existants.

## 2. Architecture observée

### Frontend et application

- React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui/Radix.
- Navigation React Router, chargement paresseux des pages.
- TanStack Query est installé et le provider est présent.
- Capacitor Android 8, PWA via `vite-plugin-pwa`.
- Supabase JS 2.98 : Auth, PostgreSQL, Realtime et Edge Functions.
- Firebase : configuration web, Analytics et FCM.
- Cloudflare Stream : upload TUS et lecture HLS.
- FedaPay : checkout XOF, vérification et webhook côté Edge Functions.
- Agora RTC : tokens de live délivrés côté serveur.
- Google Maps/Places et Google Cloud Vision.

### Entrées structurantes lues

`package.json`, `README.md`, `.env.example`, `.gitignore`, `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `tsconfig.app.json`, `supabase/config.toml`, `supabase/functions/.env.example`, `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, les types applicatifs et les principaux hooks/pages listés plus bas.

### Scripts déclarés

| Script | Commande | Présence |
|---|---|---|
| dev | `vite` | Oui |
| build | `vite build` | Oui |
| build:dev | `vite build --mode development` | Oui |
| lint | `eslint .` | Oui |
| preview | `vite preview` | Oui |
| android:sync | build puis `cap sync android` | Oui |
| android:debug | build/sync puis `gradlew.bat assembleDebug` | Oui |
| test | — | **Absent** |
| test:e2e | — | **Absent** |

Le dépôt ne déclare aucun script de test unitaire ou E2E dans `package.json`. L'existence de quelques tests Android instrumentés ne constitue pas une suite de tests React/Supabase.

### Configuration TypeScript

Les configurations observées désactivent plusieurs contrôles stricts : `strict: false`, `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. Cela ne prouve pas une erreur de compilation, mais réduit la capacité du compilateur à détecter les erreurs de types et de nullabilité.

## 3. Cartographie des pages et des données

| Page / zone | Source observée | État P0 |
|---|---|---|
| Accueil `Index.tsx` | `mockVideos` | Démonstration ; actions like/comment/share/save journalisées dans la console |
| Découverte `Discover.tsx` | `mockVideos`, `mockUsers`, catégories et hashtags locaux | Données de démonstration |
| Profil `Profile.tsx` | `mockVideos`, `mockConversations` | Contenu et compteur de conversations simulés |
| Profil public `UserProfile.tsx` | `mockUsers`, `mockVideos` | Profils/contenus simulés ; follow hook temporisé |
| Stories `StoriesRail.tsx` | `mockUsers` | Rail de stories basé sur utilisateurs fictifs |
| Marketplace `MarketplaceContent.tsx` | `mockProducts`, `mockShops`, `mockShoppableVideos` | Catalogue de démonstration |
| Ma boutique `MyShop.tsx` | Supabase `products` avec fallback sur `mockProducts` | Mixte ; fallback de démonstration à clarifier |
| Commandes `Orders.tsx` | tableau `mockOrders` local | Aucune lecture Supabase visible dans la page |
| Détail commande `OrderDetail.tsx` | `mockOrder` local | État local simulé |
| Achats groupés `GroupBuyList.tsx` | `mockGroupBuys` | Données simulées |
| Messagerie `Messages.tsx`, `Chat.tsx` | hooks Supabase, Realtime | Connectée à la base ; limites relevées dans la section 6 |
| Notifications | hook Supabase avec fallback `mockNotifications` | Mixte ; erreur ou liste vide provoque un fallback fictif |
| Lives | `live_sessions`, Edge Function Agora | Parcours serveur présent ; chat live encore décrit comme à intégrer dans README |
| Upload vidéo | Edge Functions Cloudflare + TUS | Flux serveur présent, état de traitement à vérifier en environnement réel |
| Portefeuille vendeur | `seller_payouts`, `orders`, `profiles` | Données de base présentes ; retrait manuel explicitement indisponible |
| Studio créateur | tables analytics et earnings | Requêtes présentes, plusieurs usages de `any` |
| Aide/support | `help_messages` | Écriture Supabase observée |
| Authentification | Supabase Auth + profil | Parcours réel en mode non-DEV ; mode DEV substitue un utilisateur et une session fictifs |

Cette cartographie porte sur les fichiers examinés et le code versionné. Elle ne confirme pas que les tables existent actuellement dans le projet Supabase distant ni que toutes les routes fonctionnent en production.

## 4. Mocks et actions simulées confirmés

| Fichier | Constat |
|---|---|
| `src/contexts/AuthContext.tsx` | `DEV_MODE` fournit un faux utilisateur, une fausse session et un faux profil ; le listener Auth est sauté en développement |
| `src/pages/Index.tsx` | flux basé sur `mockVideos` ; quatre actions affichent uniquement des messages `console.log` |
| `src/pages/Discover.tsx` | vidéos et utilisateurs issus de `mockData` |
| `src/pages/Profile.tsx` | vidéos et conversations fictives |
| `src/pages/UserProfile.tsx` | utilisateurs et vidéos fictifs |
| `src/components/stories/StoriesRail.tsx` | utilisateurs fictifs |
| `src/components/marketplace/MarketplaceContent.tsx` | produits, boutiques et vidéos commerciales fictifs |
| `src/pages/MyShop.tsx` | fallback sur des produits fictifs si la requête réelle échoue ou renvoie vide |
| `src/pages/Orders.tsx` | tableau local `mockOrders` |
| `src/pages/OrderDetail.tsx` | objet local `mockOrder` |
| `src/components/groupbuy/GroupBuyList.tsx` | `mockGroupBuys` |
| `src/hooks/useNotifications.ts` | fallback vers `mockNotifications` lorsque l'utilisateur est absent, lorsque la requête échoue ou lorsqu'elle ne renvoie aucune ligne |
| `src/hooks/useSocialInteractions.ts` | like/save/follow mis à jour localement puis terminés par `setTimeout`; aucun appel Supabase dans ce hook |
| `src/components/payment/AfrixaPaySheet.tsx` | `handlePay` simule un paiement confirmé après 3 secondes et génère un numéro de commande aléatoire |
| `src/pages/Boost.tsx` | sélection sur `mockVideos` et délai artificiel avant progression |
| `src/pages/creators/ChallengesPage.tsx` | au moins deux identifiants de challenges de démonstration |
| `src/components/video/VideoCard.tsx` | importe `currentUser` depuis les données fictives |

Les temporisations d'interface (animations, gestes, feedback visuel) ne sont pas automatiquement des défauts. Elles doivent être distinguées des temporisations qui prétendent représenter une opération serveur.

## 5. Schéma SQL et types TypeScript

### Migrations présentes

Les 22 migrations versionnées sont, dans leur ordre lexical :

1. `20260307131636_952ebfd9-b460-4862-b6fe-23797bae02bc.sql`
2. `20260411220545_ccee20d7-dd97-4ef4-b162-22d6c37e52ba.sql`
3. `20260411220556_26795bd8-27d7-4ee6-a493-6eee0ebc92e4.sql`
4. `20260521081838_e52bdda3-a352-4c0e-a8a3-4fe73e871726.sql`
5. `20260523134246_d3995088-a7c3-42bb-b6dd-7db30f1c95a8.sql`
6. `20260525043057_d18c8967-69e1-4e8f-a961-ce5b654c610a.sql`
7. `20260526031000_afrixa_core_social_commerce.sql`
8. `20260528090000_creator_features.sql`
9. `20260528103000_security_moderation.sql`
10. `20260528120000_user_onboarding.sql`
11. `20260528130000_afrixa_2_core_chantiers.sql`
12. `20261009120000_secure_payment_integrations.sql`
13. `20261009140000_migrate_fedapay.sql`
14. `20261010100000_cloudflare_stream.sql`
15. `20261010120000_order_delivery_coordinates.sql`
16. `20261010140000_agora_live_setup.sql`
17. `20261017100000_user_settings.sql`
18. `20261017110000_creator_program_integrity.sql`
19. `20261017120000_dispute_integrity.sql`
20. `20261017130000_auth_derived_profile_verification.sql`
21. `20261017140000_atomic_rate_limits.sql`
22. `20261017150000_comment_engagement_counts.sql`

Les migrations créent ou modifient notamment les domaines suivants : profils, commandes, timeline, commissions, versements, litiges, avis, notifications, produits, transactions de paiement, conversations/messages/présence, vidéos, follows, likes, saves, commentaires, lives, monnaies virtuelles, tokens FCM, fonctionnalités créateurs, modération, onboarding, stories, historique de visionnage, intérêts, scores, publicités, abonnements premium, paramètres utilisateur et compteurs d'engagement.

### Écart de couverture des types

Le fichier `src/integrations/supabase/types.ts` déclare 18 tables : `live_sessions`, `commission_splits`, `commissions`, `conversations`, `disputes`, `help_messages`, `messages`, `notifications`, `order_timeline`, `orders`, `payment_transactions`, `products`, `profiles`, `reviews`, `seller_payouts`, `typing_indicators`, `user_presence`, `user_settings`.

Les migrations introduisent aussi de nombreuses tables absentes de ce fichier, notamment `videos`, `follows`, `video_likes`, `video_saves`, `video_comments`, `creator_program`, `creator_earnings`, `creator_wallet`, `stories`, `comments`, `comment_likes`, `user_interests`, `video_scores`, `premium_subscriptions`, `coin_purchases`, `coin_transactions`, etc.

**Risque élevé de dérive du schéma TypeScript.** Le code contourne cette lacune avec `supabase as any` dans plusieurs hooks/pages (revenus créateurs, challenges, séries, analytics). Cela retire une partie du contrôle statique. Il faut régénérer les types depuis le schéma réellement retenu, après avoir confirmé l'état des migrations appliquées, et non inventer manuellement les noms.

### Point de cohérence à examiner en P1/P2

La migration `20261009120000_secure_payment_integrations.sql` fait référence aux anciennes colonnes `flutterwave_ref`, `flutterwave_tx_id`, `flutterwave_response`. La migration suivante `20261009140000_migrate_fedapay.sql` renomme ces colonnes en `fedapay_ref`, `fedapay_transaction_id`, `fedapay_response` et recrée le trigger correspondant. Le code Edge Functions actuel utilise les noms FedaPay. Cette séquence peut être cohérente si les migrations sont appliquées dans l'ordre complet ; l'état réel de la base n'est pas accessible ici et doit être vérifié avant toute modification.

## 6. Edge Functions et services privilégiés

Fonctions trouvées dans `supabase/functions` :

- `calculate-scores`
- `check-rate-limit`
- `cleanup-stories`
- `complete-cloudflare-upload`
- `create-cloudflare-upload`
- `create-fedapay-payment`
- `delete-cloudflare-upload`
- `fedapay-webhook`
- `get-agora-token`
- `moderate-image`
- `release-escrow`
- `send-push-notification`
- `verify-fedapay-payment`
- partagées : `_shared/cloudflare.ts`, `_shared/fedapay.ts`.

### Observations positives

- `create-fedapay-payment` vérifie l'utilisateur via `auth.getUser()`, charge la commande côté serveur et vérifie l'acheteur, le statut, le montant et la référence.
- `verify-fedapay-payment` relit la transaction chez FedaPay et compare statut, montant, devise et propriétaire de la commande.
- `fedapay-webhook` vérifie une signature HMAC, limite la taille du corps, puis relit l'état de la transaction chez FedaPay.
- `release-escrow` vérifie un drapeau de configuration désactivé par défaut, l'identité, la commande livrée, l'escrow et les coordonnées vendeur.
- Les opérations Cloudflare d'upload, complétion et suppression vérifient l'identité et la propriété de la vidéo.
- `get-agora-token` vérifie l'utilisateur, le live, le rôle hôte/spectateur et la confidentialité/abonnement avant de générer un token.
- `check-rate-limit` authentifie l'utilisateur puis appelle la fonction SQL atomique avec le rôle de service.
- `send-push-notification` exige un secret webhook et relit la notification avant d'envoyer les pushs.
- Les secrets de prestataires sont lus via `Deno.env` dans les fonctions serveur. Aucun secret serveur n'a été recopié dans ce rapport.

### Risques ou questions à traiter après validation P0

1. **Élevé — endpoints privilégiés de maintenance :** `calculate-scores/index.ts` et `cleanup-stories/index.ts` créent un client avec `SUPABASE_SERVICE_ROLE_KEY` et ne vérifient pas eux-mêmes un JWT utilisateur, un rôle de service ou un secret de tâche. Dans `supabase/config.toml`, seuls `fedapay-webhook` et `send-push-notification` ont explicitement `verify_jwt = false`; les deux fonctions de maintenance héritent donc du contrôle gateway par défaut. Il faut confirmer leur mode de déclenchement et vérifier que seuls des appels de tâche autorisés peuvent les invoquer. Un JWT utilisateur valide ne doit jamais suffire à autoriser une opération globale avec privilèges service.
2. **Moyen/élevé — calcul des scores :** la fonction charge tous les intérêts utilisateur et jusqu'à 500 vidéos publiées, puis calcule le produit cartésien utilisateur × vidéo en mémoire et fait un upsert en une fois. Risque de charge/temps/mémoire lorsque la base grandit ; absence de pagination par lot observée.
3. **Moyen — nettoyage des stories :** suppression globale des stories expirées via un client service-role ; absence de contrôle applicatif du déclencheur à l'intérieur de la fonction.
4. **Moyen — journaux :** plusieurs fonctions journalisent des objets d'erreur complets. Les valeurs de secrets ne sont pas imprimées dans le rapport ; les journaux doivent néanmoins être revus pour éviter données utilisateur ou payloads sensibles.
5. **Moyen — CORS :** `get-agora-token` et `moderate-image` utilisent `Access-Control-Allow-Origin: *`. L'authentification reste nécessaire dans le code examiné, mais une politique d'origine plus stricte est à évaluer.
6. **Moyen — configuration :** le projet distant Supabase, les secrets effectivement définis, les fonctions déployées et les migrations appliquées ne sont pas vérifiables depuis les seuls fichiers versionnés.

## 7. Hooks et zones de logique à surveiller

| Fichier | Observation P0 |
|---|---|
| `useSocialInteractions.ts` | états optimistes et timers seulement ; pas de persistance Supabase |
| `useNotifications.ts` | fallback fictif sur erreur ou liste vide ; écritures mark-read sans traitement des erreurs |
| `useChatMessages.ts` | lecture sans pagination ; rapprochement des messages optimistes par contenu/auteur pouvant confondre deux messages identiques ; erreurs de mark-read/delete non remontées |
| `useConversations.ts` | lecture et création réelles ; gestion concurrente du get-or-create à vérifier |
| `AuthContext.tsx` | mode DEV simulé ; lecture profil avec `select('*')` ; erreur de chargement profil non exposée |
| `useCreatorEarnings.ts`, `useChallenge.ts`, `useSeries.ts` | usages de `any` pour tables non couvertes par les types |
| `useRealtimeComments.ts` | requêtes réelles sur `comments` et `comment_likes`, états loading/error présents |
| `useAgoraLive.ts` | appel serveur de token et renouvellement ; parcours média à tester sur appareils réels |

## 8. Variables d'environnement — noms uniquement

### Frontend publiques déclarées dans `.env.example`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_VAPID_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`

### Secrets/configuration Edge Functions référencés

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FEDAPAY_API_BASE_URL`, `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET`, `FEDAPAY_PAYOUTS_ENABLED`, `AFRIXA_PUBLIC_URL`
- `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FCM_WEBHOOK_SECRET`
- `CF_STREAM_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, `CF_STREAM_CUSTOMER_CODE`
- `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`
- `GOOGLE_VISION_API_KEY)

Ce relevé confirme seulement les noms présents dans les fichiers versionnés, pas leur présence ni leur validité dans les environnements. Aucune valeur de secret n'est affichée.

## 9. Vérifications exécutées

| Vérification | Résultat |
|---|---|
| Lecture branche/commit GitHub | Effectuée ; HEAD `c2c7b1d` |
| Arborescence Git récursive | Effectuée ; 363 fichiers, arbre non tronqué |
| Lecture de `package.json` et configs | Effectuée |
| Lecture des types TypeScript | Effectuée |
| Lecture des 22 migrations SQL | Effectuée |
| Lecture des Edge Functions et fichiers partagés | Effectuée |
| Inspection statique des pages/hooks principaux | Effectuée |
| `git status --short` local | **Non exécuté** : aucun checkout local accessible |
| `git clone` | Échec avant clonage : résolution DNS de `github.com` indisponible |
| `npm install` | **Non exécuté** |
| `npm run build` | **Non exécuté** |
| `npm run lint` | **Non exécuté** |
| `npm test` | **Non exécuté** ; script absent |
| Test des migrations sur Supabase | **Non exécuté** |
| Test E2E / mobile / paiement réel | **Non exécuté** |

Aucun résultat de build, lint ou test ne peut donc être qualifié de réussi ou d'échoué.

## 10. Registre des risques P0

| Niveau | Risque constaté | Fichiers de preuve / zone |
|---|---|---|
| Élevé | Fonctions de maintenance avec client service-role sans authentification/autorisation applicative explicite | `supabase/functions/calculate-scores/index.ts`, `cleanup-stories/index.ts`, `supabase/config.toml` |
| Élevé | Paiement simulé pouvant afficher « Paiement confirmé » après délai | `src/components/payment/AfrixaPaySheet.tsx` |
| Élevé | Parcours commandes/checkout de démonstration exposés dans les pages principales | `Orders.tsx`, `OrderDetail.tsx`, `Index.tsx`, `MarketplaceContent.tsx` |
| Élevé | Types Supabase incomplets par rapport aux migrations ; contournement par `any` | `src/integrations/supabase/types.ts`, hooks et pages créateurs |
| Moyen/élevé | Mode DEV simule un utilisateur et saute les listeners Auth | `src/contexts/AuthContext.tsx` |
| Moyen/élevé | Interactions like/save/follow sans persistance dans le hook central | `src/hooks/useSocialInteractions.ts` |
| Moyen/élevé | Fallbacks de mocks qui masquent les erreurs backend comme si des données existaient | `useNotifications.ts`, `MyShop.tsx` |
| Moyen | Messagerie sans pagination, erreurs de mutation incomplètement gérées, rapprochement optimiste fragile | `useChatMessages.ts` |
| Moyen | Calcul de scores en mémoire avec produit cartésien | `calculate-scores/index.ts` |
| Moyen | Aucune suite de tests applicatifs déclarée dans les scripts | `package.json` |
| Moyen | Contrôles TypeScript permissifs et types incomplets | `tsconfig*.json`, `src/integrations/supabase/types.ts` |
| Faible à moyen | Origines CORS génériques pour certaines fonctions | `get-agora-token`, `moderate-image` |

Les niveaux expriment une priorité d'investigation statique, pas une preuve d'exploitation en production.

## 11. Fichiers à examiner/corriger lors des priorités suivantes

### À traiter en priorité P1 — paiements et commandes

- `src/components/payment/AfrixaPaySheet.tsx`
- `src/components/payment/AfrixaPayment.tsx`
- `src/hooks/useAfrixaPayment.ts`
- `src/lib/fedapay.ts`
- `supabase/functions/create-fedapay-payment/index.ts`
- `supabase/functions/verify-fedapay-payment/index.ts`
- `supabase/functions/fedapay-webhook/index.ts`
- `supabase/functions/release-escrow/index.ts`
- migrations `20261009120000_secure_payment_integrations.sql` et `20261009140000_migrate_fedapay.sql`
- `src/pages/Orders.tsx`, `src/pages/OrderDetail.tsx`, `src/pages/SellerSales.tsx`

### À traiter en priorité P2 — sécurité, RLS, Edge Functions et secrets

- `supabase/config.toml`
- `supabase/functions/calculate-scores/index.ts`
- `supabase/functions/cleanup-stories/index.ts`
- `supabase/functions/check-rate-limit/index.ts`
- `supabase/functions/send-push-notification/index.ts`
- migrations de sécurité/modération et d'intégrité du 9 au 17 octobre
- `src/integrations/supabase/types.ts`
- `src/integrations/supabase/client.ts`
- `src/contexts/AuthContext.tsx`
- `src/lib/security.ts`

### P3/P4 — interactions et données réelles

- `src/hooks/useSocialInteractions.ts`
- `src/pages/Index.tsx`
- `src/pages/Discover.tsx`
- `src/pages/Profile.tsx`
- `src/pages/UserProfile.tsx`
- `src/components/stories/StoriesRail.tsx`
- `src/components/marketplace/MarketplaceContent.tsx`
- `src/pages/MyShop.tsx`
- `src/pages/Orders.tsx`
- `src/pages/OrderDetail.tsx`
- `src/components/groupbuy/GroupBuyList.tsx`
- `src/hooks/useNotifications.ts`

### P6/P7 — messagerie, médias et live

- `src/hooks/useChatMessages.ts`
- `src/hooks/useConversations.ts`
- `src/hooks/useRealtimeComments.ts`
- `src/components/live/LiveChat.tsx`
- `src/hooks/useAgoraLive.ts`
- Edge Functions Cloudflare, Agora, Vision et FCM.

## 12. Conclusion P0 et critères de sortie

**Statut P0 : audit statique substantiel réalisé, mais vérifications exécutables bloquées par l'absence de checkout local et l'indisponibilité réseau de clonage.**

Ce que l'audit établit :
- Le dépôt contient une architecture réelle avec de nombreux flux Supabase et Edge Functions déjà implémentés ; Afrixa ne doit pas être réécrit.
- Plusieurs écrans principaux restent alimentés par des mocks ou des actions locales.
- Le flux FedaPay serveur existe et contient des contrôles importants ; un autre composant de paiement simule encore un succès.
- Le fichier de types Supabase ne reflète pas l'ensemble des tables créées par les migrations.
- Deux fonctions privilégiées de maintenance nécessitent une vérification d'autorisation avant tout déploiement de confiance.
- Les migrations sont présentes dans le dépôt, mais leur application effective et l'état de la base distante restent inconnus.

**Actions requises pour clôturer complètement P0 :**
1. Sur l'environnement qui contient le vrai dépôt, fournir le résultat de `git status --short` avant toute modification.
2. Exécuter les scripts existants après installation contrôlée des dépendances : `npm install`, `npm run build`, `npm run lint`.
3. Vérifier les migrations et les fonctions dans un projet Supabase de test, sans exécuter de migration destructive en production.
4. Générer les types depuis le schéma Supabase de référence et comparer avec le fichier versionné.
5. Confirmer le mode d'appel prévu des tâches `calculate-scores` et `cleanup-stories`.

**Arrêt demandé :** aucune priorité P1 à P8 n'a été commencée. Attendre la validation explicite de l'utilisateur avant toute correction métier.
