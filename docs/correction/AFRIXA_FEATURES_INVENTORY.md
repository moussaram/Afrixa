# AFRIXA — INVENTAIRE DES FONCTIONNALITÉS

**Référence :** main `c2c7b1dd0d38a8f38277b6ea943381f8b8f43c70`.  
**Convention d'état :** opérationnel = flux relié de bout en bout sous réserve de configuration ; partiel = une partie réelle existe ; simulé = UI/mock/timer/toast sans effet métier réel ; défectueux = effet réel mais règle ou intégrité incorrecte ; absent = pas de flux identifié ; bloqué configuration = dépendance/secrets/activation non vérifiés ou désactivés.

| Fonctionnalité | Frontend principal | Backend / tables | Services externes | État | Insuffisances / dépendances | Corrections et tests de validation |
|---|---|---|---|---|---|---|
| Inscription téléphone | `pages/auth/Register.tsx`, `VerifyOTP.tsx` | Supabase Auth, `profiles` | SMS configuré dans Supabase/Twilio | partiel/réel | configuration SMS, CAPTCHA et limites production non vérifiées | tests OTP, anti-abus, numéro déjà utilisé, expiration |
| Connexion email/téléphone | `Login.tsx` | Supabase Auth | OAuth Google | réel sous configuration | mode DEV simule l'utilisateur en développement | tests sessions, erreurs, refresh, OAuth redirect |
| Profil initial | `CompleteProfile.tsx`, `MyInfo.tsx` | `profiles`, trigger `handle_new_user` | Supabase | partiel | validation et parcours de complétion à éprouver | tests unicité username, profil incomplet, RLS |
| Mot de passe oublié | `ForgotPassword.tsx`, `ResetPassword.tsx` | Supabase Auth | Email/SMS Auth | partiel/réel | configuration SMTP/SMS non vérifiée | tests liens/OTP, expiration, réutilisation |
| Gestion MFA / appareils / suppression compte | `Settings.tsx` | pas de flux serveur complet identifié | — | absent/simulé | toasts/dialogues locaux ; pas de gestion MFA ni suppression persistée | définir parcours Auth/administratif, tests sécurité et effacement |
| Feed « Pour vous » | `Index.tsx`, `VideoCard.tsx` | `videos`, `video_scores` existent mais feed UI utilise mock | Cloudflare HLS | simulé | `mockVideos`; pas de requête feed branchée | tests pagination, confidentialité, ranking, absence de données |
| Feed « Abonnements » | `Index.tsx` | `follows`, `videos` | — | simulé | filtre des vidéos fictives | tests feed followers et blocage |
| Découverte / tendances | `Discover.tsx` | `videos`, `profiles`, `user_interests` | — | simulé | utilisateurs/vidéos/hashtags fictifs | tests requêtes réelles et classement |
| Profils publics | `Profile.tsx`, `UserProfile.tsx` | `profiles`, `videos`, `follows` | — | partiel/simulé | données de profil/vidéos mock ; RLS profil trop permissive | tests profil privé/public et champs exposés |
| Like vidéo | `VideoCard.tsx`, `useSocialInteractions.ts` | `video_likes` existe | — | simulé sur main | hook main ne fait que modifier l'état et timer | test DB idempotent, compteur, rollback |
| Favoris vidéo | `VideoCard.tsx` | `video_saves` existe | — | simulé sur main | aucun upsert/delete dans hook main | tests sauvegarde privée et persistance |
| Follow/unfollow | `UserProfile.tsx`, `VideoCard.tsx`, hook | `follows`, `follow_requests` | — | simulé sur main | hook timer ; pas de flux privé/request relié | tests follow, unfollow, self-follow, compte privé |
| Commentaires vidéo | `CommentsPanel.tsx`, `useRealtimeComments.ts` | `comments`, `comment_likes`, profils | Supabase Realtime | partiel/réel | jeu mock pour identifiants non UUID ; RLS/mentions/blocage à revoir | tests création, suppression, likes, réponses, RLS, realtime |
| Stories | `StoriesRail.tsx`, `StoryViewer.tsx` | `stories`, `story_views` | stockage média non établi | simulé/partiel | rail mock ; pas de CRUD/lecture réel prouvé | tests expiration, visibilité, vues, nettoyage et stockage |
| Upload vidéo | `AdvancedVideoUpload.tsx` | `videos`, fonctions Cloudflare | Cloudflare Stream/TUS | partiel/réel | upload et statut réels ; modération vidéo/publication non raccordées | tests limites, reprise, propriété, échec provider, publication contrôlée |
| Effets / filtres / son | `EffectsPanel.tsx`, `SoundLibrary.tsx`, `PostEditor.tsx` | `sounds` existe | — | simulé/partiel | catalogue d'effets/sons local ; transformation finale non garantie | tests rendu média, licence/stockage et sélection |
| Recherche | `SearchAdvanced.tsx`, `lib/search.ts` | `videos`, `profiles`, `products`, `sounds`, index `search_vector` | — | partiel/réel | challenges renvoient `[]`; recherche locale history | tests accents, injection filtre, pagination, visibilité |
| Messagerie liste | `Messages.tsx`, `useConversations.ts` | `conversations`, `profiles` | Supabase Realtime | réel partiel | policy UPDATE participants trop large ; `who_can_message` non appliqué | tests isolation, doublons, comptes bloqués/privés |
| Chat texte | `Chat.tsx`, `useChatMessages.ts` | `messages`, trigger conversation | Supabase Realtime | réel partiel | vérification d'erreurs/read state, médias et statut de livraison à valider | tests envoyer, lire, supprimer, double message, accès tiers |
| Pièces jointes chat | `ChatInput.tsx` | aucun stockage complet établi | — | partiel/placeholder | URL/gestion média non démontrées de bout en bout | tests upload, accès signé, type/taille, suppression |
| Indicateur de frappe | `useTypingIndicator.ts` | `typing_indicators` | Supabase Realtime | partiel | policy ne contraint pas clairement `user_id` à l'appelant | test anti-usurpation |
| Présence | `usePresence.ts` | `user_presence` | Realtime | partiel | lecture publique de présence/last_seen | tests opt-in, privacy, nettoyage offline |
| Live audio/vidéo | `LiveSetup.tsx`, `LiveBroadcast.tsx`, `LiveViewer.tsx`, `useAgoraLive.ts` | `live_sessions`, `get-agora-token` | Agora RTC | réel partiel | token/role contrôlés ; configuration et renouvellement réels à valider | tests host/audience, privé/followers, expiration, multi-device |
| Chat live / réactions / likes | composants live et pages live | état React local, pas de persistance complète | Agora transport uniquement | simulé | messages/réactions/likes locaux | tests multi-clients et persistance |
| Cadeaux live | `VirtualGifts`, `GiftAnimation`, panneaux live | `virtual_gifts`, `gift_transactions`, coins | aucun paiement coins sécurisé | simulé/dangereux | cadeaux statiques ; pas de débit/crédit atomique | ledger serveur, tests solde et anti-rejeu |
| Boutique vendeur | `MyShop.tsx` | `products` | Supabase | réel partiel | fallback mock ; formulaire média/photo incomplet | tests CRUD, propriétaire, stock, images |
| Catalogue marketplace | `MarketplaceContent.tsx`, `ProductCard.tsx` | `products` existe | — | simulé | mockProducts/mockShops/mockShoppableVideos | tests filtres, tri, disponibilité, seller isolation |
| Vidéos shoppables | `ShoppableVideoCard`, `ProductBottomSheet` | relation produit-vidéo non prouvée | — | simulé | données produit codées en dur dans VideoCard | tests liens réels vidéo/produit et achat |
| Achat produit | `AfrixaPaySheet`, `AfrixaPayment` | `orders`, `payment_transactions` | FedaPay | simulé dans le parcours actif / backend partiel | `AfrixaPaySheet` simule le paiement ; `AfrixaPayment` n'est pas référencé par le parcours courant | intégrer un seul checkout serveur ; tests sandbox et idempotence |
| Achat groupé | `GroupBuy.tsx`, composants groupbuy | colonnes produit group-buy ; pas de table participants identifiée | — | simulé | mockGroupBuys ; paiement associé fake | définir modèle participants, seuils, expiration, stock, remboursement |
| Liste / détail commandes | `Orders.tsx`, `OrderDetail.tsx` | `orders`, `order_timeline`, `disputes`, `reviews` | — | simulé | mock orders ; confirmations/litiges/avis ne sont que des toasts | tests lifecycle, rôles buyer/seller, transitions et timeline |
| Checkout FedaPay | `AfrixaPayment.tsx`, `useAfrixaPayment.ts` | `orders`, `payment_transactions`, `commission_splits` | FedaPay | partiel, composant non raccordé | create/verify server existent ; état production inconnu | connecter UI réelle, sandbox, webhook signature, double callback |
| Escrow / payout vendeur | `SellerWallet.tsx`, `lib/escrow.ts` | `seller_payouts`, `payment_transactions`, `orders` | FedaPay Payouts | bloqué par configuration / non raccordé | flag payout false par défaut ; helper non référencé ; retrait manuel indisponible | habilitation FedaPay, rapprochement, tests payout webhook |
| Portefeuille vendeur | `SellerWallet.tsx` | commandes et seller_payouts | FedaPay | défectueux/partiel | solde disponible calculé à partir des payouts déjà envoyés ; ce n'est pas un solde disponible à retirer | définir ledger et requête serveur cohérente |
| Afrixa Coins | `Coins.tsx` | `coin_balances`, `transactions`, `coin_purchases`, `coin_transactions` | FedaPay non raccordé | simulé/absent | boutons sans handler ; pas de confirmation fournisseur ni crédit | créer parcours achat et ledger atomique après validation |
| Pourboires créateurs | `CreatorTipButton.tsx` | `creator_earnings` | aucun paiement réel | défectueux/simulé | tente un INSERT de revenu confirmé avec user_id du créateur ; la policy propriétaire peut le refuser si le donneur est un autre utilisateur ; aucun débit ni paiement n'est effectué | débit réel, autorisation, ledger et webhook |
| Programme créateur | `CreatorProgramPage.tsx` | `creator_program`, trigger intégrité | — | partiel | trigger seuil followers existe ; statut et processus de vérification à compléter | tests seuils, transitions, fraude followers |
| Wallet / gains créateur | `CreatorWalletPage.tsx`, `useCreatorEarnings.ts` | `creator_wallet`, `creator_earnings` | payout non intégré | partiel/dangereux | accès direct au wallet par policy propriétaire FOR ALL ; revenus insérables par propriétaire | ledger serveur, RLS read-only, tests anti-altération |
| Fan clubs / abonnements | pages creators | `fan_clubs`, `fan_club_memberships` | FedaPay non raccordé | partiel/simulé | insert membership possible côté utilisateur sans paiement ; abonnement pas facturé | checkout abonnement, webhooks, renouvellement/révocation |
| Séries / épisodes | pages creators | `series`, `series_episodes`, `series_subscriptions` | — | partiel | accès/abonnement pas lié à paiement ; types absents | tests accès contenu et cohérence compteur |
| Challenges / collabs / spotlight | pages creators | tables correspondantes ; spotlight UI mock | — | partiel/simulé | permissions et résultats/votes non complets ; spotlight mock | tests workflow et anti-fraude |
| Publicités | `AdsManager.tsx`, `AdCard.tsx`, `Boost.tsx` | `ad_campaigns`, `ad_impressions` | paiement annonceur absent | simulé | formulaire sans handler, campagnes mock, facturation et reporting absents | workflow annonceur/admin, budget atomique, impressions vérifiées |
| Premium | `Premium.tsx` | `premium_subscriptions`, colonnes profil premium | paiement absent | simulé | bouton souscrire sans action | abonnements et webhooks, renouvellement, expiration |
| Notifications in-app | `Notifications.tsx`, `useNotifications.ts` | `notifications` | Realtime | partiel | fallback mock si requête échoue ou si résultat vide | distinguer vide/erreur ; tests ownership et realtime |
| Push | `messaging.ts`, Paramètres | `user_fcm_tokens`, Edge push | Firebase FCM | bloqué configuration/partiel | secrets et webhook non vérifiés ; préférences catégories non appliquées | tests device, token rotation, invalid token, consentement |
| Analytics | `firebase/analytics.ts`, pages | Firebase + `video_analytics`, `profile_analytics` | Firebase Analytics | partiel | tables métiers non alimentées de manière complète | tests consentement et agrégation |
| Signalements / blocages | `security.ts`, dialogs, hook | `content_reports`, `user_blocks`, `moderation_actions` | — | partiel | hook de sécurité non consommé dans le parcours principal ; blocage non filtrant | tests signalement, blocage, effet sur toutes requêtes |
| Modération image | `LiveSetup.tsx`, `googleVision.ts` | `moderate-image` | Google Vision | partiel | couverture live uniquement ; pas de revue humaine intégrée | tests catégories, faux positifs, file de revue |
| Administration | aucune route admin identifiée | tables moderation/content_reports | — | absent | pas de RBAC ni console admin identifiés | concevoir rôles et console après sécurité |
| Support | `HelpSupport.tsx`, `Settings.tsx` | `help_messages` | — | partiel | message rapide Paramètres simulé ; flux HelpSupport à tester | tests création, réponse, confidentialité |
| Paramètres utilisateur | `Settings.tsx`, hook | `user_settings`, `profiles`, tokens FCM | Firebase | partiel | plusieurs réglages sans effet ; rapport S0 dédié à consolider | tests par réglage, persistance par compte et effet réel |
| PWA / Android | `vite.config.ts`, `sw.ts`, `capacitor.config.ts` | — | Capacitor | présent | build Android et permissions runtime non testés | tests Android release, offline, liens profonds, permissions |

## 2. Dépendances transversales

- Le feed dépend de la publication vidéo, de la confidentialité, des follows, du ranking et de la modération.
- Les achats dépendent de produits réels, stock atomique, identité vendeur, commandes, checkout, webhook, ledger, escrow, litiges et payout.
- Les Coins dépendent d'un ledger immuable, d'une preuve de paiement, d'un débit atomique et d'une politique de remboursement.
- Les cadeaux/tips dépendent des Coins et du portefeuille créateur ; ils ne doivent pas écrire directement un revenu.
- Les fan clubs et séries payantes dépendent du paiement récurrent ou d'un mécanisme d'accès contrôlé.
- Les notifications dépendent des événements métier et des préférences utilisateur.
- L'administration dépend d'un modèle de rôles sécurisé avant toute interface admin.
- Les blocages, profils privés et sanctions doivent être appliqués dans toutes les requêtes et fonctions, pas seulement dans l'UI.

## 3. Règle de validation

Une fonctionnalité ne sera déclarée opérationnelle qu'après tests positifs et négatifs sur la base, les Edge Functions, les permissions, les erreurs provider, les répétitions d'événements et l'interface. Un bouton qui affiche un toast ne constitue pas une preuve de fonctionnement.
