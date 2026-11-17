# AFRIXA — CARTOGRAPHIE API ET FONCTIONS SERVEUR

**Référence :** main `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70`.  
**Backend observé :** Supabase Edge Functions, SQL functions/triggers, Supabase Auth, PostgREST et Realtime.

## 1. Edge Functions

| Fonction | Appel frontend / déclencheur | Auth / privilèges | Tables / services | État et risques |
|---|---|---|---|---|
| `calculate-scores` | aucun appel frontend trouvé ; déclenchement externe non documenté | client service-role ; handler sans contrôle d'identité, rôle ou secret | `user_interests`, `videos`, `video_scores` | calcul global ; toute invocation autorisée par la passerelle JWT peut déclencher le traitement privilégié ; planification non présente dans le dépôt |
| `check-rate-limit` | appelé par `lib/security.ts` via `useSecurityModeration`, hook non utilisé par les pages principales repérées | valide le JWT via `auth.getUser`, puis RPC service-role | `rate_limits`, `consume_rate_limit` | brique serveur réelle mais intégration applicative incomplète |
| `cleanup-stories` | aucun appel frontend trouvé ; cron externe non documenté | service-role ; handler sans contrôle métier explicite | `stories` | suppression des expirées ; appel privilégié non protégé au niveau du handler |
| `create-cloudflare-upload` | `lib/cloudflare/streamUpload.ts` | vérifie utilisateur ; écrit via service-role | `videos`, Cloudflare Stream | flux upload authentifié ; quotas et configuration à éprouver |
| `complete-cloudflare-upload` | `refreshCloudflareVideoStatus` | vérifie utilisateur et propriétaire de la vidéo | `videos`, Cloudflare API | vérifie le statut provider et met à jour la ligne ; ne fait pas l'approbation éditoriale |
| `delete-cloudflare-upload` | `removeFailedCloudflareUpload` | vérifie utilisateur/propriétaire | `videos`, Cloudflare API | nettoyage d'upload ; tests de cohérence provider/DB requis |
| `create-fedapay-payment` | `lib/fedapay.ts` depuis `AfrixaPayment` | vérifie utilisateur, acheteur, commande et transaction ; service-role pour lecture/transition | `orders`, `payment_transactions`, FedaPay | code checkout réel ; composant `AfrixaPayment` non référencé dans le parcours actif inspecté |
| `verify-fedapay-payment` | helper FedaPay et retour paiement | vérifie utilisateur/acheteur, relit transaction provider | `payment_transactions`, `orders`, `commission_splits` | contrôle montant/devise/statut ; transitions multi-requêtes, splits check-then-insert |
| `fedapay-webhook` | webhook provider ; `verify_jwt=false` dans config | signature FedaPay vérifiée ; service-role | paiement, commande, payout, split | protection par signature présente ; idempotence/transactions et rapprochement à renforcer |
| `release-escrow` | helper `lib/escrow.ts`, aucun appel d'interface trouvé | vérifie l'acheteur ; payout conditionné à `FEDAPAY_PAYOUTS_ENABLED=true` | commandes, transactions, profils, seller_payouts, FedaPay Payouts | bloqué par configuration et non raccordé à OrderDetail ; traitement asynchrone via webhook |
| `get-agora-token` | `useAgoraLive.ts` | valide session utilisateur, rôle host/audience, confidentialité et follow | `live_sessions`, `follows`, Agora token | contrôle d'accès serveur positif ; CORS large, config et scénarios réels à tester |
| `moderate-image` | `lib/googleVision.ts`, utilisé dans `LiveSetup.tsx` | valide utilisateur ; clé Vision côté serveur | Google Cloud Vision | modération image d'une couverture live ; pas de pipeline global ni de file de revue |
| `send-push-notification` | Database Webhook INSERT notifications ; `verify_jwt=false` | secret webhook dédié, service-role et compte de service Firebase | `notifications`, `user_fcm_tokens`, FCM HTTP v1 | envoi réel si configuration ; ne filtre pas selon les préférences catégories |

## 2. Fonctions SQL et triggers

Les migrations définissent notamment :
- `handle_new_user` : crée le profil lors de l'inscription Auth.
- `set_profile_verification_from_auth` / `sync_profile_verification_from_auth` : dérivent les marqueurs de vérification depuis Auth.
- `update_updated_at_column` : timestamp générique.
- `calculate_order_commission` : calcul initial commission commande.
- `enforce_order_checkout_integrity` : source de vérité produit/prix/quantité/statut au checkout ; bloque les modifications client des champs financiers.
- `enforce_payment_transaction_integrity` : création transaction liée à l'ordre, updates réservées au service-role.
- `record_order_creation` / `record_order_status_change` : timeline.
- `enforce_dispute_integrity` : ouvre un litige acheteur éligible et limite l'ajout d'éléments de preuve.
- `enforce_creator_program_integrity` : seuil de followers et protection des champs de niveau.
- `consume_rate_limit` : incrément atomique appelé par Edge Function.
- `update_conversation_on_message` : aperçu et compteurs non lus.
- `sync_comment_counts` / `sync_comment_like_counts` : compteurs commentaires.
- `release_escrow` ancien trigger : retiré par la migration de sécurisation paiement.

La fonction `release_escrow` historique a été supprimée par la migration de paiement ; ne pas la confondre avec l'Edge Function `release-escrow`.

## 3. API PostgREST et Realtime

Le frontend appelle directement Supabase pour les opérations CRUD. Tables les plus sollicitées : `profiles`, `products`, `conversations`, `messages`, `orders`, `notifications`, `live_sessions`, `follows`, `comments`, `video_likes`, `video_saves`, `creator_wallet`, `creator_earnings`.

Realtime est utilisé pour conversations, messages, typing, notifications et commentaires. Les règles RLS doivent donc être correctes à la fois pour les requêtes initiales et les événements Realtime.

Aucun RPC métier de paiement/coins n'est appelé depuis le frontend dans les parcours observés ; seul `consume_rate_limit` est invoqué indirectement par la fonction Edge.

## 4. Intégrations externes

| Service | Usage | Variables/configuration requises | État |
|---|---|---|---|
| Supabase | Auth, DB, Realtime, Edge | URL + clé publique côté client ; secrets serveur côté Edge | dépend de configuration de production |
| FedaPay | checkout XOF, webhook, payout | clés et secrets serveur, webhook, activation Payout | checkout code présent ; payout désactivé par défaut |
| Cloudflare Stream | upload TUS, traitement HLS, suppression | compte, token Stream Write, customer code | code intégré, secrets non vérifiés |
| Agora | live RTC et jetons | App ID/certificate côté serveur | code intégré, compte/config non vérifiés |
| Firebase FCM | push Web | config publique, VAPID, service account et secret webhook côté serveur | code intégré, configuration non vérifiée |
| Firebase Analytics | événements après consentement | Measurement ID et Firebase | code intégré, collecte de production non vérifiée |
| Google Vision | SafeSearch image | clé Vision côté serveur | utilisée pour live cover |
| Google Maps/Places | autocomplétion livraison | clé navigateur restreinte, APIs et billing | optionnelle avec fallback manuel |
| Yango | ouverture d'un deep link | app Yango côté utilisateur | pas d'API transport/tracking observée |
| Stripe | paiements diaspora | aucune intégration identifiée | à intégrer selon README |

## 5. Secrets et configuration

Aucun secret réel n'est reproduit dans ce document. Les noms de variables sont listés uniquement pour préparer l'inventaire d'exploitation :
- client : `VITE_SUPABASE_*`, `VITE_FIREBASE_*`, `VITE_GOOGLE_MAPS_API_KEY` ;
- Edge : `SUPABASE_SERVICE_ROLE_KEY`, `FEDAPAY_*`, `CF_STREAM_*`, `AGORA_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FCM_WEBHOOK_SECRET`, `GOOGLE_VISION_API_KEY`.

Les valeurs réelles, scopes, restrictions, rotation et présence dans les environnements hébergés ne sont pas vérifiables depuis le dépôt.

## 6. Contrôles prioritaires API

1. Ajouter une authentification métier explicite aux fonctions de calcul et nettoyage privilégiées ; distinguer cron signé d'appel utilisateur.
2. Rendre les mutations financières atomiques et idempotentes.
3. Ajouter un ledger unique pour coins, cadeaux, tips et gains.
4. Appliquer blocage, restrictions, préférences et confidentialité dans les services et RLS.
5. Vérifier les limites, payloads, MIME, taille, rate-limit, CORS et logs sans PII.
6. Ajouter des tests Edge Function avec utilisateur anonyme, utilisateur normal, propriétaire, non-propriétaire, admin et webhook invalide.
