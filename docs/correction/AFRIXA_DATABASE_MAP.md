# AFRIXA — CARTOGRAPHIE DE LA BASE DE DONNÉES

**Référence :** 22 migrations présentes sur main ; schéma local versionné, non équivalent à une preuve d'état de production.  
**Types générés main :** 18 tables. **Tables distinctes définies par migrations :** 68.

## 1. Vue générale

PostgreSQL/Supabase est la source de données centrale. Les migrations créent 68 tables métier. Les types générés ne couvrent que `live_sessions`, `commission_splits`, `commissions`, `conversations`, `disputes`, `help_messages`, `messages`, `notifications`, `order_timeline`, `orders`, `payment_transactions`, `products`, `profiles`, `reviews`, `seller_payouts`, `typing_indicators`, `user_presence`, `user_settings`.

**Écart : 50 tables migrées non représentées dans les types main.** Plusieurs accès contournent le typage avec `as any`.

## 2. Inventaire des tables par domaine

### Identité, préférences et sécurité

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `profiles` | identité et profil | `user_id → auth.users` | SELECT public expose aussi les champs personnels |
| `user_settings` | préférences JSONB | `user_id → auth.users` | RLS propriétaire ; doublon avec préférences spécifiques |
| `user_onboarding` | progression onboarding | `user_id → auth.users` | type généré absent |
| `login_history` | historique de connexion | `user_id → auth.users` | INSERT propriétaire permet de déclarer ses propres entrées ; pas de collecte serveur attestée |
| `user_presence` | présence et dernière activité | `user_id → auth.users` | SELECT public |
| `user_fcm_tokens` | installations push | `user_id → auth.users` | utilisé via any/type local, absent des types |
| `notification_settings` | préférences de catégories | `user_id → auth.users` | pas relié à l'envoi push observé |
| `rate_limits` | compteurs par action | `user_id → auth.users` | clients autorisés à écrire leurs propres lignes ; fonction RPC distincte |
| `moderation_actions` | sanctions/restrictions | `user_id/admin_id → auth.users` | pas de RBAC admin opérationnel identifié |
| `banned_words` | dictionnaire de mots interdits | — | lecture publique ; jeu initial très limité |
| `content_reports` | signalements | `reporter_id/reviewed_by → auth.users` | pas de console de traitement |
| `user_blocks` | blocages | `blocker_id/blocked_id → auth.users` | existence ne prouve pas application sur toutes les requêtes |
| `follow_requests` | demandes d'abonnement privé | requester/target → auth.users | le hook follow utilise plutôt `follows` directement |

### Réseau social, vidéos, stories et recommandations

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `videos` | métadonnées vidéo et état de publication | `user_id → auth.users`; replay/live et produit référencés par autres tables | policies d'insert/update n'imposent pas l'approbation serveur |
| `follows` | abonnements | follower/following → auth.users | lecture publique ; demandes privées pas intégrées uniformément |
| `video_likes` | likes vidéo | vidéo + utilisateur | sur main, hook frontend simulé |
| `video_saves` | sauvegardes privées | vidéo + utilisateur | sur main, hook frontend simulé |
| `video_comments` | ancienne table de commentaires vidéo | video/user/parent | doublon fonctionnel avec `comments`, peu/pas consommée |
| `comments` | commentaires utilisés par hook | video/user/parent | Realtime et compteurs ; types générés absents |
| `comment_likes` | likes commentaires | comment/user | utilisé par hook |
| `comment_mentions` | mentions | comment/user mentionné | SELECT public |
| `stories` | stories temporaires | user → auth.users | RLS ne modélise pas les règles de profil privé |
| `story_views` | vues de stories | story/viewer | pas de workflow UI réel démontré |
| `user_interests` | intérêts recommandation | user → auth.users | source du calcul de scores |
| `video_scores` | scores personnalisés | video/user | calcul via fonction Edge ; planification non présente dans le dépôt |
| `video_watch_history` | historique de visionnage | video/user | politique propriétaire |
| `sounds` | catalogue audio | creator/source video éventuels | catalogue UI en partie local |

### Messagerie et présence

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `conversations` | conversations 1:1 | participant_1/2 → auth.users | UPDATE participant insuffisamment verrouillé |
| `messages` | messages texte/média | conversation, sender, product | Realtime réel ; média non validé de bout en bout |
| `typing_indicators` | frappe en cours | conversation/user | policy n'impose pas explicitement user_id = auth.uid() |

### Marketplace, commandes et paiements

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `products` | catalogue vendeur | seller_id logique | stock/prix contraints partiellement ; FK vendeur à confirmer |
| `orders` | commandes | order_timeline/disputes/reviews ; product_id sans FK explicite dans migration initiale | trigger protège valeurs de checkout ; stock non réservé atomiquement |
| `order_timeline` | historique de statut | order_id → orders | insertible par participants selon policy |
| `commissions` | commissions historiques | order_id → orders | policy insert initiale supprimée par migration sécurité |
| `seller_payouts` | versements vendeur | order_id → orders ; seller_id | payout protégé par Edge Function et flag désactivé |
| `disputes` | litiges | order_id → orders | trigger d'intégrité renforcé |
| `reviews` | avis | order_id → orders | policy ne prouve pas à elle seule éligibilité/unique review |
| `payment_transactions` | transactions FedaPay | order_id logique, FK absente dans migration de création | trigger serveur protège update ; colonne provider migrée de Flutterwave à FedaPay |
| `commission_splits` | répartition commission | transaction_id → payment_transactions | index non unique sur transaction_id ; création par check-then-insert |
| `help_messages` | demandes support | user_id logique | types présents |

### Coins, cadeaux et monétisation créateur

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `coin_balances` | solde coins | user_id → auth.users | insertion propriétaire peut définir un solde initial ; pas de ledger transactionnel sécurisé |
| `transactions` | transactions financières génériques | user_id → auth.users | INSERT propriétaire sans validation serveur des montants/statuts |
| `coin_purchases` | achats de coins | user_id → auth.users | INSERT propriétaire, aucune confirmation provider branchée |
| `coin_transactions` | journal coins | user_id → auth.users | lecture propriétaire, flux d'écriture non implémenté |
| `afrixa_coins` | ancien solde coins | user_id → auth.users | policy propriétaire FOR ALL : écriture directe du solde |
| `virtual_gifts` | catalogue cadeaux | — | valeurs statiques/table ; catalogue UI local |
| `gift_transactions` | transferts cadeaux | sender/receiver, live/gift | insertion sender sans débit atomique du solde |
| `creator_program` | programme créateur | user_id → auth.users | trigger contrôle seuil et champs protégés |
| `creator_earnings` | revenus créateur | user/video | INSERT propriétaire autorisé ; aucune preuve paiement pour tip |
| `creator_wallet` | portefeuille créateur | user_id → auth.users | policy propriétaire FOR ALL permet de modifier les soldes |
| `video_analytics` | agrégats vidéo | video/user | pipeline de remplissage non complet |
| `profile_analytics` | agrégats profil | user | pipeline non complet |
| `collab_requests` | demandes collaboration | sender/receiver/video | update des participants à encadrer |
| `collab_videos` | collaboration vidéo | video et créateurs | modèle de partage revenus à valider |
| `challenges` | défis | — | données et modération à valider |
| `challenge_submissions` | participations | challenge/user/video | lecture publique et votes à sécuriser |
| `series` | séries créateur | creator | table déclarée dans deux migrations ; la seconde `IF NOT EXISTS` ne modifie pas la première |
| `series_episodes` | épisodes | series/video | accès payant non relié |
| `series_subscriptions` | abonnements séries | series/user | utilisateur peut s'inscrire sans paiement |
| `spotlights` | mises en avant | user/video | UI mock |
| `fan_clubs` | clubs de fans | creator | memberships non liées au paiement |
| `fan_club_memberships` | membres et périodes | club/user | INSERT propriétaire sans preuve paiement |
| `super_notifications` | alertes créateur prioritaires | follower/creator | écriture propriétaire permettant de créer des relations arbitraires |

### Publicité et abonnement Premium

| Table | Rôle | Relations importantes | État / vigilance |
|---|---|---|---|
| `ad_campaigns` | campagnes annonceur | — | UI formulaire non raccordée |
| `ad_impressions` | impressions/clics | campaign/user | insertion client, user_id nullable ; métriques falsifiables |
| `premium_subscriptions` | abonnements Premium | user_id → auth.users | lecture propriétaire ; aucun checkout/webhook relié |

## 3. Relations principales

- `auth.users` → `profiles`, `user_settings`, `user_onboarding`, `user_fcm_tokens`, présence, historique, intérêts, follows, messages et plusieurs tables métier.
- `videos` → likes, saves, comments, watch history, analytics, scores, épisodes, participations, stories indirectes et sessions live via replay.
- `conversations` → messages et typing indicators.
- `products` → commandes et produit épinglé en live.
- `orders` → timeline, disputes, reviews, transactions de paiement et versements.
- `payment_transactions` → commission_splits.
- `fan_clubs` → fan_club_memberships.
- `series` → episodes et subscriptions.
- Plusieurs colonnes d'identifiants sont logiques sans FK déclarée ; l'intégrité applicative doit être contrôlée.

## 4. Migrations main

1. `20260307131636_...` — profils et trigger de création.
2. `20260411220545_...` — commandes, timeline, commissions, payout, disputes, reviews, notifications.
3. `20260411220556_...` — notification insert.
4. `20260521081838_...` — produits et support.
5. `20260523134246_...` — transactions paiement et commission splits.
6. `20260525043057_...` — conversations, messages, typing, presence.
7. `20260526031000_afrixa_core_social_commerce.sql` — vidéos, follows, likes, saves, comments, live, coins, tokens push.
8. `20260528090000_creator_features.sql` — programme et fonctionnalités créateur.
9. `20260528103000_security_moderation.sql` — sécurité, sanctions, signalements, blocages.
10. `20260528120000_user_onboarding.sql` — onboarding.
11. `20260528130000_afrixa_2_core_chantiers.sql` — sons, stories, intérêts, pubs, premium, coins et commentaires.
12. `20261009120000_secure_payment_integrations.sql` — garde-fous checkout et paiement.
13. `20261009140000_migrate_fedapay.sql` — renommage Flutterwave vers FedaPay et contraintes opérateurs.
14. `20261010100000_cloudflare_stream.sql` — statut Cloudflare et confidentialité vidéo.
15. `20261010120000_order_delivery_coordinates.sql` — coordonnées livraison.
16. `20261010140000_agora_live_setup.sql` — configuration live Agora.
17. `20261017100000_user_settings.sql` — préférences JSONB.
18. `20261017110000_creator_program_integrity.sql` — intégrité programme créateur.
19. `20261017120000_dispute_integrity.sql` — intégrité litiges.
20. `20261017130000_auth_derived_profile_verification.sql` — vérification dérivée Auth.
21. `20261017140000_atomic_rate_limits.sql` — RPC de limite atomique.
22. `20261017150000_comment_engagement_counts.sql` — compteurs commentaires.

## 5. Problèmes de schéma à traiter avant toute nouvelle table

1. Régénérer les types depuis le schéma réellement appliqué, après réconciliation migration par migration.
2. Déterminer la source de vérité pour les likes/follows/commentaires/stories.
3. Décider un modèle unique de ledger pour coins, cadeaux, tips, revenus et retraits.
4. Décider si `notification_settings` ou `user_settings` est la source de préférences.
5. Ajouter/valider les FK et contraintes uniquement après audit des données existantes.
6. Examiner les migrations idempotentes, ordre de déploiement et divergences production.
7. Ne créer aucune table mentionnée dans une spécification tant que le besoin, les colonnes, les contraintes, RLS, RPC/Edge et tests ne sont pas approuvés.

## 6. Vérifications production requises

Comparer `supabase migration list`/l'historique distant, `information_schema`, `pg_policies`, contraintes, index, fonctions, triggers, grants et publications Realtime. Cette vérification nécessite un accès Supabase autorisé qui n'était pas disponible pendant la Phase 0.
