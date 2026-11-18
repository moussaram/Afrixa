-- GENERATED FROM LIVE AFRIXA SUPABASE PUBLIC SCHEMA SNAPSHOT.
-- Source project: kxxwdiyloplkoyperwty; generated 2026-11-18.
-- This is a schema-only portability baseline, not a data dump.
-- Review extension requirements, auth compatibility, functions/triggers and policies before production restore.
CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public."ad_campaigns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "advertiser_name" text NOT NULL,
  "advertiser_email" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "media_url" text NOT NULL,
  "media_type" text,
  "cta_text" text,
  "cta_url" text,
  "budget" integer NOT NULL,
  "spent" integer DEFAULT 0,
  "cpc" integer DEFAULT 50,
  "target_countries" text[] DEFAULT '{CI,SN,ML,BF,GN}'::text[],
  "target_age_min" integer DEFAULT 16,
  "target_age_max" integer DEFAULT 45,
  "target_interests" text[],
  "impressions" integer DEFAULT 0,
  "clicks" integer DEFAULT 0,
  "status" text DEFAULT 'pending'::text,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ad_impressions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid,
  "user_id" uuid,
  "clicked" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."afrixa_coins" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "balance" integer DEFAULT 0,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."banned_words" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "word" text NOT NULL,
  "language" text DEFAULT 'fr'::text,
  "severity" text DEFAULT 'medium'::text
);

CREATE TABLE IF NOT EXISTS public."challenge_submissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "challenge_id" uuid,
  "user_id" uuid,
  "video_id" uuid,
  "rank" integer,
  "votes" integer DEFAULT 0,
  "is_winner" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."challenges" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "hashtag" text NOT NULL,
  "description" text,
  "cover_image" text,
  "prize_description" text,
  "prize_amount" integer,
  "sponsor_name" text,
  "sponsor_logo" text,
  "status" text DEFAULT 'active'::text,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "participants_count" integer DEFAULT 0,
  "views_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."coin_balances" (
  "user_id" uuid NOT NULL,
  "balance" integer DEFAULT 0 NOT NULL,
  "lifetime_earned" integer DEFAULT 0 NOT NULL,
  "lifetime_spent" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."coin_purchases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "coins_amount" integer NOT NULL,
  "fcfa_paid" integer NOT NULL,
  "operator" text NOT NULL,
  "fedapay_ref" text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."coin_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "reference_id" uuid,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."collab_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sender_id" uuid,
  "receiver_id" uuid,
  "type" text NOT NULL,
  "video_id" uuid,
  "message" text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."collab_videos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid,
  "creator_1" uuid,
  "creator_2" uuid,
  "type" text,
  "revenue_split" double precision DEFAULT 0.5,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."comment_likes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "comment_id" uuid,
  "user_id" uuid
);

CREATE TABLE IF NOT EXISTS public."comment_mentions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "comment_id" uuid,
  "mentioned_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid,
  "user_id" uuid,
  "parent_id" uuid,
  "content" text NOT NULL,
  "likes_count" integer DEFAULT 0,
  "replies_count" integer DEFAULT 0,
  "is_pinned" boolean DEFAULT false,
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."commission_splits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL,
  "afrixa_amount" integer NOT NULL,
  "seller_amount" integer NOT NULL,
  "split_type" text DEFAULT 'normale'::text NOT NULL,
  "split_rate" double precision NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."commissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "rate" double precision NOT NULL,
  "type" text DEFAULT 'normale'::text NOT NULL,
  "status" text DEFAULT 'en_attente'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."content_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reporter_id" uuid,
  "content_type" text NOT NULL,
  "content_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'pending'::text,
  "reviewed_by" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "participant_1" uuid NOT NULL,
  "participant_2" uuid NOT NULL,
  "last_message" text,
  "last_message_at" timestamp with time zone DEFAULT now(),
  "last_sender_id" uuid,
  "unread_count_1" integer DEFAULT 0 NOT NULL,
  "unread_count_2" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."creator_earnings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "video_id" uuid,
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "status" text DEFAULT 'pending'::text,
  "period_start" date,
  "period_end" date,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."creator_program" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "level" text DEFAULT 'starter'::text,
  "followers_at_join" integer DEFAULT 0,
  "joined_at" timestamp with time zone DEFAULT now(),
  "is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."creator_wallet" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "balance" integer DEFAULT 0,
  "pending" integer DEFAULT 0,
  "total_earned" integer DEFAULT 0,
  "withdrawal_operator" text,
  "withdrawal_phone" text,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."disputes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "buyer_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "buyer_evidence" text,
  "seller_evidence" text,
  "admin_decision" text,
  "status" text DEFAULT 'ouvert'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fan_club_memberships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "fan_club_id" uuid,
  "user_id" uuid,
  "status" text DEFAULT 'active'::text,
  "current_period_start" date,
  "current_period_end" date,
  "fedapay_subscription_id" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."fan_clubs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid,
  "name" text,
  "description" text,
  "price_monthly" integer NOT NULL,
  "perks" text[],
  "members_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."follow_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "requester_id" uuid,
  "target_id" uuid,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."follows" (
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."gift_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "sender_id" uuid,
  "receiver_id" uuid,
  "live_id" uuid,
  "gift_id" uuid,
  "coins_spent" integer NOT NULL,
  "fcfa_earned" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."help_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "category" text NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'non_lu'::text NOT NULL,
  "admin_reply" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."live_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "host_id" uuid NOT NULL,
  "agora_channel" text NOT NULL,
  "title" text DEFAULT 'Live Afrixa'::text NOT NULL,
  "cover_image" text,
  "status" text DEFAULT 'live'::text NOT NULL,
  "viewers_count" integer DEFAULT 0 NOT NULL,
  "peak_viewers" integer DEFAULT 0 NOT NULL,
  "pinned_product_id" uuid,
  "replay_video_id" uuid,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "privacy" text DEFAULT 'public'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."login_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "country" text,
  "city" text,
  "device_name" text,
  "user_agent" text,
  "ip_address" inet,
  "is_suspicious" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "sender_id" uuid NOT NULL,
  "content" text,
  "type" text DEFAULT 'text'::text NOT NULL,
  "media_url" text,
  "product_id" uuid,
  "is_read" boolean DEFAULT false NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."moderation_actions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action_type" text NOT NULL,
  "reason" text NOT NULL,
  "content_type" text,
  "content_id" uuid,
  "admin_id" uuid,
  "expires_at" timestamp with time zone,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."notification_settings" (
  "user_id" uuid NOT NULL,
  "likes_enabled" boolean DEFAULT true NOT NULL,
  "comments_enabled" boolean DEFAULT true NOT NULL,
  "follows_enabled" boolean DEFAULT true NOT NULL,
  "lives_enabled" boolean DEFAULT true NOT NULL,
  "messages_enabled" boolean DEFAULT true NOT NULL,
  "orders_enabled" boolean DEFAULT true NOT NULL,
  "promotions_enabled" boolean DEFAULT false NOT NULL,
  "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
  "quiet_hours_start" time without time zone,
  "quiet_hours_end" time without time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text DEFAULT 'info'::text NOT NULL,
  "order_id" uuid,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reference_id" uuid
);

CREATE TABLE IF NOT EXISTS public."order_timeline" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."orders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "buyer_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "product_id" uuid,
  "product_name" text NOT NULL,
  "product_image" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price" integer NOT NULL,
  "total_price" integer NOT NULL,
  "commission_rate" double precision DEFAULT 0.05 NOT NULL,
  "commission_amount" integer DEFAULT 0 NOT NULL,
  "seller_amount" integer DEFAULT 0 NOT NULL,
  "payment_operator" text,
  "buyer_phone" text,
  "delivery_address" text,
  "buyer_note" text,
  "status" text DEFAULT 'en_attente'::text NOT NULL,
  "payment_reference" text,
  "escrow_released" boolean DEFAULT false NOT NULL,
  "dispute_reason" text,
  "auto_confirm_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "delivery_lat" double precision,
  "delivery_lng" double precision,
  "tracking_number" text,
  "shipped_at" timestamp with time zone,
  "buyer_confirmed_at" timestamp with time zone,
  "released_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."payment_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "fedapay_transaction_id" text,
  "fedapay_ref" text NOT NULL,
  "amount" integer NOT NULL,
  "commission_amount" integer DEFAULT 0 NOT NULL,
  "seller_amount" integer DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'XOF'::text NOT NULL,
  "operator" text,
  "buyer_phone" text,
  "status" text DEFAULT 'initiated'::text NOT NULL,
  "fedapay_response" jsonb,
  "escrow_status" text DEFAULT 'held'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fedapay_payment_ref" text
);

CREATE TABLE IF NOT EXISTS public."premium_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "plan" text DEFAULT 'monthly'::text,
  "price" integer NOT NULL,
  "status" text DEFAULT 'active'::text,
  "current_period_start" date,
  "current_period_end" date,
  "fedapay_sub_id" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "price" integer NOT NULL,
  "promo_price" integer,
  "stock" integer DEFAULT 0,
  "unlimited_stock" boolean DEFAULT false,
  "images" text[] DEFAULT '{}'::text[],
  "city" text,
  "country" text,
  "delivery_delay" text DEFAULT '3-5 jours'::text,
  "delivery_fee" integer DEFAULT 0,
  "is_group_buy" boolean DEFAULT false,
  "group_price_5" integer,
  "group_price_10" integer,
  "group_duration" text,
  "is_featured" boolean DEFAULT false,
  "views_count" integer DEFAULT 0,
  "sales_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."profile_analytics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "followers_count" integer DEFAULT 0,
  "following_count" integer DEFAULT 0,
  "total_views" integer DEFAULT 0,
  "total_likes" integer DEFAULT 0,
  "profile_visits" integer DEFAULT 0,
  "new_followers" integer DEFAULT 0,
  "lost_followers" integer DEFAULT 0,
  "recorded_date" date DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public."profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "nom" text,
  "prenom" text,
  "deuxieme_prenom" text,
  "date_naissance" date,
  "lieu_naissance" text,
  "profession" text,
  "numero_mobile" text,
  "mobile_verifie" boolean DEFAULT false NOT NULL,
  "email_verifie" boolean DEFAULT false NOT NULL,
  "google_id" text,
  "avatar_url" text,
  "bio" text,
  "username" text,
  "nationalite" text,
  "nationalite_flag" text,
  "inscription_complete" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_private" boolean DEFAULT false,
  "who_can_comment" text DEFAULT 'everyone'::text,
  "who_can_message" text DEFAULT 'everyone'::text,
  "allow_duet" boolean DEFAULT true,
  "allow_stitch" boolean DEFAULT true,
  "is_premium" boolean DEFAULT false,
  "premium_expires_at" timestamp with time zone,
  "numero_mobile_operateur" text
);

CREATE TABLE IF NOT EXISTS public."rate_limits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "count" integer DEFAULT 1,
  "window_start" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "buyer_id" uuid NOT NULL,
  "seller_id" uuid NOT NULL,
  "rating" integer NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."seller_payouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL,
  "order_id" uuid,
  "amount" integer NOT NULL,
  "operator" text,
  "phone" text,
  "status" text DEFAULT 'en_attente'::text NOT NULL,
  "payout_reference" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fedapay_transfer_id" text,
  "fedapay_transfer_ref" text,
  "fedapay_response" jsonb
);

CREATE TABLE IF NOT EXISTS public."seller_wallet_ledger" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "seller_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'XOF'::text NOT NULL,
  "entry_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."series" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "cover_image" text,
  "category" text,
  "total_episodes" integer DEFAULT 0,
  "subscribers_count" integer DEFAULT 0,
  "is_complete" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."series_episodes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "series_id" uuid,
  "video_id" uuid,
  "episode_number" integer NOT NULL,
  "title" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."series_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "series_id" uuid,
  "user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sounds" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "artist" text,
  "cover_url" text,
  "audio_url" text NOT NULL,
  "duration" double precision,
  "type" text DEFAULT 'music'::text,
  "category" text,
  "uses_count" integer DEFAULT 0,
  "is_trending" boolean DEFAULT false,
  "source_video_id" uuid,
  "creator_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."spotlights" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "user_id" uuid,
  "video_id" uuid,
  "week_start" date NOT NULL,
  "week_end" date NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."stories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "type" text NOT NULL,
  "media_url" text,
  "text_content" text,
  "text_color" text DEFAULT '#FFFFFF'::text,
  "background_color" text DEFAULT '#7C3AED'::text,
  "duration" integer DEFAULT 5,
  "views_count" integer DEFAULT 0,
  "expires_at" timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
  "is_archived" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."story_views" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "story_id" uuid,
  "viewer_id" uuid,
  "viewed_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."super_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "follower_id" uuid,
  "creator_id" uuid,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "amount_fcfa" integer DEFAULT 0 NOT NULL,
  "coins_amount" integer,
  "flw_tx_ref" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."typing_indicators" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "is_typing" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_blocks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "blocker_id" uuid,
  "blocked_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_fcm_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" text NOT NULL,
  "platform" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_interests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "categories" text[] DEFAULT '{}'::text[],
  "not_interested" text[] DEFAULT '{}'::text[],
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_onboarding" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "step_completed" integer DEFAULT 0,
  "interests" text[] DEFAULT '{}'::text[],
  "onboarding_done" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_presence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "is_online" boolean DEFAULT false NOT NULL,
  "last_seen" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_settings" (
  "user_id" uuid NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."video_analytics" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid,
  "user_id" uuid,
  "views" integer DEFAULT 0,
  "unique_views" integer DEFAULT 0,
  "likes" integer DEFAULT 0,
  "comments" integer DEFAULT 0,
  "shares" integer DEFAULT 0,
  "saves" integer DEFAULT 0,
  "avg_watch_duration" double precision DEFAULT 0,
  "completion_rate" double precision DEFAULT 0,
  "traffic_source" jsonb DEFAULT '{}'::jsonb,
  "audience_countries" jsonb DEFAULT '{}'::jsonb,
  "recorded_date" date DEFAULT CURRENT_DATE,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."video_comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "parent_id" uuid,
  "content" text NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."video_likes" (
  "video_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."video_saves" (
  "video_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."video_scores" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "video_id" uuid,
  "user_id" uuid,
  "score" double precision DEFAULT 0,
  "last_calculated" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."video_watch_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "video_id" uuid,
  "watch_duration" double precision DEFAULT 0,
  "completion_rate" double precision DEFAULT 0,
  "last_position" double precision DEFAULT 0,
  "watch_count" integer DEFAULT 1,
  "last_watched_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."videos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "cloudflare_uid" text,
  "hls_url" text NOT NULL,
  "thumbnail_url" text,
  "title" text,
  "description" text,
  "duration" integer DEFAULT 0 NOT NULL,
  "views_count" integer DEFAULT 0 NOT NULL,
  "likes_count" integer DEFAULT 0 NOT NULL,
  "comments_count" integer DEFAULT 0 NOT NULL,
  "shares_count" integer DEFAULT 0 NOT NULL,
  "saves_count" integer DEFAULT 0 NOT NULL,
  "location_name" text,
  "lat" double precision,
  "lng" double precision,
  "moderation_status" text DEFAULT 'pending'::text NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "file_size" integer,
  "resolution" text,
  "audio_track" text,
  "sound_id" uuid,
  "allow_duet" boolean DEFAULT true,
  "allow_stitch" boolean DEFAULT true,
  "allow_download" boolean DEFAULT true,
  "is_exclusive" boolean DEFAULT false,
  "series_id" uuid,
  "episode_number" integer,
  "tagged_products" uuid[],
  "cover_timestamp" double precision DEFAULT 0,
  "comments_disabled" boolean DEFAULT false,
  "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('french'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))) STORED,
  "privacy" text DEFAULT 'public'::text NOT NULL,
  "cloudflare_status" text DEFAULT 'ready'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."virtual_gifts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "emoji" text,
  "price_coins" integer NOT NULL,
  "fcfa_value" integer NOT NULL,
  "animation" text
);
ALTER TABLE public."ad_campaigns" ADD CONSTRAINT "ad_campaigns_media_type_check" CHECK (media_type = ANY (ARRAY['image'::text, 'video'::text]));
ALTER TABLE public."ad_campaigns" ADD CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY (id);
ALTER TABLE public."ad_campaigns" ADD CONSTRAINT "ad_campaigns_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'completed'::text, 'rejected'::text]));
ALTER TABLE public."ad_impressions" ADD CONSTRAINT "ad_impressions_campaign_id_fkey" FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public."ad_impressions" ADD CONSTRAINT "ad_impressions_pkey" PRIMARY KEY (id);
ALTER TABLE public."ad_impressions" ADD CONSTRAINT "ad_impressions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."afrixa_coins" ADD CONSTRAINT "afrixa_coins_pkey" PRIMARY KEY (id);
ALTER TABLE public."afrixa_coins" ADD CONSTRAINT "afrixa_coins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."afrixa_coins" ADD CONSTRAINT "afrixa_coins_user_id_key" UNIQUE (user_id);
ALTER TABLE public."banned_words" ADD CONSTRAINT "banned_words_pkey" PRIMARY KEY (id);
ALTER TABLE public."banned_words" ADD CONSTRAINT "banned_words_severity_check" CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]));
ALTER TABLE public."banned_words" ADD CONSTRAINT "banned_words_word_key" UNIQUE (word);
ALTER TABLE public."challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_fkey" FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
ALTER TABLE public."challenge_submissions" ADD CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."challenge_submissions" ADD CONSTRAINT "challenge_submissions_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."challenges" ADD CONSTRAINT "challenges_hashtag_key" UNIQUE (hashtag);
ALTER TABLE public."challenges" ADD CONSTRAINT "challenges_pkey" PRIMARY KEY (id);
ALTER TABLE public."challenges" ADD CONSTRAINT "challenges_status_check" CHECK (status = ANY (ARRAY['active'::text, 'ended'::text, 'upcoming'::text]));
ALTER TABLE public."coin_balances" ADD CONSTRAINT "coin_balances_balance_check" CHECK (balance >= 0);
ALTER TABLE public."coin_balances" ADD CONSTRAINT "coin_balances_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."coin_balances" ADD CONSTRAINT "coin_balances_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."coin_purchases" ADD CONSTRAINT "coin_purchases_pkey" PRIMARY KEY (id);
ALTER TABLE public."coin_purchases" ADD CONSTRAINT "coin_purchases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."coin_transactions" ADD CONSTRAINT "coin_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."coin_transactions" ADD CONSTRAINT "coin_transactions_type_check" CHECK (type = ANY (ARRAY['sent_gift'::text, 'received_gift'::text, 'sent_tip'::text, 'received_tip'::text, 'purchased'::text, 'withdrawn'::text]));
ALTER TABLE public."coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'completed'::text]));
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_type_check" CHECK (type = ANY (ARRAY['duo'::text, 'duet'::text, 'stitch'::text]));
ALTER TABLE public."collab_requests" ADD CONSTRAINT "collab_requests_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL;
ALTER TABLE public."collab_videos" ADD CONSTRAINT "collab_videos_creator_1_fkey" FOREIGN KEY (creator_1) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."collab_videos" ADD CONSTRAINT "collab_videos_creator_2_fkey" FOREIGN KEY (creator_2) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."collab_videos" ADD CONSTRAINT "collab_videos_pkey" PRIMARY KEY (id);
ALTER TABLE public."collab_videos" ADD CONSTRAINT "collab_videos_type_check" CHECK (type = ANY (ARRAY['duo'::text, 'duet'::text, 'stitch'::text]));
ALTER TABLE public."collab_videos" ADD CONSTRAINT "collab_videos_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE public."comment_likes" ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE (comment_id, user_id);
ALTER TABLE public."comment_likes" ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY (id);
ALTER TABLE public."comment_likes" ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE public."comment_mentions" ADD CONSTRAINT "comment_mentions_mentioned_user_id_fkey" FOREIGN KEY (mentioned_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."comment_mentions" ADD CONSTRAINT "comment_mentions_pkey" PRIMARY KEY (id);
ALTER TABLE public."comments" ADD CONSTRAINT "comments_content_check" CHECK (char_length(content) <= 500 AND content !~* '<script'::text);
ALTER TABLE public."comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE public."comments" ADD CONSTRAINT "comments_pkey" PRIMARY KEY (id);
ALTER TABLE public."comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."comments" ADD CONSTRAINT "comments_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."commission_splits" ADD CONSTRAINT "commission_splits_pkey" PRIMARY KEY (id);
ALTER TABLE public."commission_splits" ADD CONSTRAINT "commission_splits_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES payment_transactions(id) ON DELETE CASCADE;
ALTER TABLE public."commissions" ADD CONSTRAINT "commissions_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public."commissions" ADD CONSTRAINT "commissions_pkey" PRIMARY KEY (id);
ALTER TABLE public."content_reports" ADD CONSTRAINT "content_reports_content_type_check" CHECK (content_type = ANY (ARRAY['video'::text, 'comment'::text, 'product'::text, 'message'::text, 'profile'::text]));
ALTER TABLE public."content_reports" ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY (id);
ALTER TABLE public."content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."content_reports" ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."content_reports" ADD CONSTRAINT "content_reports_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'action_taken'::text, 'dismissed'::text]));
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_last_sender_id_fkey" FOREIGN KEY (last_sender_id) REFERENCES auth.users(id);
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_participant_1_fkey" FOREIGN KEY (participant_1) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_participant_1_participant_2_key" UNIQUE (participant_1, participant_2);
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_participant_2_fkey" FOREIGN KEY (participant_2) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY (id);
ALTER TABLE public."creator_earnings" ADD CONSTRAINT "creator_earnings_pkey" PRIMARY KEY (id);
ALTER TABLE public."creator_earnings" ADD CONSTRAINT "creator_earnings_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'paid'::text]));
ALTER TABLE public."creator_earnings" ADD CONSTRAINT "creator_earnings_type_check" CHECK (type = ANY (ARRAY['views_bonus'::text, 'gift_received'::text, 'tip_received'::text, 'subscription_revenue'::text]));
ALTER TABLE public."creator_earnings" ADD CONSTRAINT "creator_earnings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."creator_earnings" ADD CONSTRAINT "creator_earnings_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL;
ALTER TABLE public."creator_program" ADD CONSTRAINT "creator_program_level_check" CHECK (level = ANY (ARRAY['starter'::text, 'rising'::text, 'verified'::text, 'elite'::text]));
ALTER TABLE public."creator_program" ADD CONSTRAINT "creator_program_pkey" PRIMARY KEY (id);
ALTER TABLE public."creator_program" ADD CONSTRAINT "creator_program_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."creator_program" ADD CONSTRAINT "creator_program_user_id_key" UNIQUE (user_id);
ALTER TABLE public."creator_wallet" ADD CONSTRAINT "creator_wallet_pkey" PRIMARY KEY (id);
ALTER TABLE public."creator_wallet" ADD CONSTRAINT "creator_wallet_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."creator_wallet" ADD CONSTRAINT "creator_wallet_user_id_key" UNIQUE (user_id);
ALTER TABLE public."disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public."disputes" ADD CONSTRAINT "disputes_pkey" PRIMARY KEY (id);
ALTER TABLE public."fan_club_memberships" ADD CONSTRAINT "fan_club_memberships_fan_club_id_fkey" FOREIGN KEY (fan_club_id) REFERENCES fan_clubs(id) ON DELETE CASCADE;
ALTER TABLE public."fan_club_memberships" ADD CONSTRAINT "fan_club_memberships_pkey" PRIMARY KEY (id);
ALTER TABLE public."fan_club_memberships" ADD CONSTRAINT "fan_club_memberships_status_check" CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text]));
ALTER TABLE public."fan_club_memberships" ADD CONSTRAINT "fan_club_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."fan_clubs" ADD CONSTRAINT "fan_clubs_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."fan_clubs" ADD CONSTRAINT "fan_clubs_creator_id_key" UNIQUE (creator_id);
ALTER TABLE public."fan_clubs" ADD CONSTRAINT "fan_clubs_pkey" PRIMARY KEY (id);
ALTER TABLE public."follow_requests" ADD CONSTRAINT "follow_requests_pkey" PRIMARY KEY (id);
ALTER TABLE public."follow_requests" ADD CONSTRAINT "follow_requests_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."follow_requests" ADD CONSTRAINT "follow_requests_requester_id_target_id_key" UNIQUE (requester_id, target_id);
ALTER TABLE public."follow_requests" ADD CONSTRAINT "follow_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]));
ALTER TABLE public."follow_requests" ADD CONSTRAINT "follow_requests_target_id_fkey" FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."follows" ADD CONSTRAINT "follows_check" CHECK (follower_id <> following_id);
ALTER TABLE public."follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."follows" ADD CONSTRAINT "follows_pkey" PRIMARY KEY (follower_id, following_id);
ALTER TABLE public."gift_transactions" ADD CONSTRAINT "gift_transactions_gift_id_fkey" FOREIGN KEY (gift_id) REFERENCES virtual_gifts(id) ON DELETE SET NULL;
ALTER TABLE public."gift_transactions" ADD CONSTRAINT "gift_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."gift_transactions" ADD CONSTRAINT "gift_transactions_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."gift_transactions" ADD CONSTRAINT "gift_transactions_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."help_messages" ADD CONSTRAINT "help_messages_pkey" PRIMARY KEY (id);
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_agora_channel_key" UNIQUE (agora_channel);
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_host_id_fkey" FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_pinned_product_id_fkey" FOREIGN KEY (pinned_product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_privacy_check" CHECK (privacy = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text]));
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_replay_video_id_fkey" FOREIGN KEY (replay_video_id) REFERENCES videos(id) ON DELETE SET NULL;
ALTER TABLE public."live_sessions" ADD CONSTRAINT "live_sessions_status_check" CHECK (status = ANY (ARRAY['live'::text, 'ended'::text]));
ALTER TABLE public."login_history" ADD CONSTRAINT "login_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public."messages" ADD CONSTRAINT "messages_pkey" PRIMARY KEY (id);
ALTER TABLE public."messages" ADD CONSTRAINT "messages_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE public."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."moderation_actions" ADD CONSTRAINT "moderation_actions_action_type_check" CHECK (action_type = ANY (ARRAY['warning'::text, 'restrict_24h'::text, 'ban_7days'::text, 'ban_permanent'::text]));
ALTER TABLE public."moderation_actions" ADD CONSTRAINT "moderation_actions_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."moderation_actions" ADD CONSTRAINT "moderation_actions_content_type_check" CHECK (content_type = ANY (ARRAY['video'::text, 'comment'::text, 'product'::text, 'message'::text, 'profile'::text]));
ALTER TABLE public."moderation_actions" ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY (id);
ALTER TABLE public."moderation_actions" ADD CONSTRAINT "moderation_actions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."notification_settings" ADD CONSTRAINT "notification_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_timeline" ADD CONSTRAINT "order_timeline_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public."order_timeline" ADD CONSTRAINT "order_timeline_pkey" PRIMARY KEY (id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_delivery_coordinates_pair_check" CHECK ((delivery_lat IS NULL) = (delivery_lng IS NULL));
ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_transactions" ADD CONSTRAINT "payment_transactions_flutterwave_ref_key" UNIQUE (fedapay_ref);
ALTER TABLE public."payment_transactions" ADD CONSTRAINT "payment_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_plan_check" CHECK (plan = ANY (ARRAY['monthly'::text, 'yearly'::text]));
ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_status_check" CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text]));
ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."premium_subscriptions" ADD CONSTRAINT "premium_subscriptions_user_id_key" UNIQUE (user_id);
ALTER TABLE public."products" ADD CONSTRAINT "products_name_length" CHECK (char_length(name) <= 80) NOT VALID;
ALTER TABLE public."products" ADD CONSTRAINT "products_pkey" PRIMARY KEY (id);
ALTER TABLE public."products" ADD CONSTRAINT "products_price_positive" CHECK (price > 0) NOT VALID;
ALTER TABLE public."products" ADD CONSTRAINT "products_stock_non_negative" CHECK (stock >= 0) NOT VALID;
ALTER TABLE public."profile_analytics" ADD CONSTRAINT "profile_analytics_pkey" PRIMARY KEY (id);
ALTER TABLE public."profile_analytics" ADD CONSTRAINT "profile_analytics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_numero_mobile_operateur_check" CHECK (numero_mobile_operateur IS NULL OR (numero_mobile_operateur = ANY (ARRAY['mtn_open'::text, 'moov'::text, 'sbin'::text, 'mtn_ci'::text, 'moov_tg'::text, 'togocel'::text, 'orange-bf'::text, 'moov_bf'::text, 'mtn_open_gn'::text, 'moov_ci'::text, 'wave_ci'::text, 'orange_ci'::text, 'wave_sn'::text, 'orange_sn'::text])));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_user_id_key" UNIQUE (user_id);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE (username);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_who_can_comment_check" CHECK (who_can_comment = ANY (ARRAY['everyone'::text, 'followers'::text, 'nobody'::text]));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_who_can_message_check" CHECK (who_can_message = ANY (ARRAY['everyone'::text, 'followers'::text, 'nobody'::text]));
ALTER TABLE public."rate_limits" ADD CONSTRAINT "rate_limits_action_check" CHECK (action = ANY (ARRAY['comment'::text, 'message'::text, 'video_upload'::text, 'product_create'::text, 'follow'::text, 'report'::text, 'tip'::text]));
ALTER TABLE public."rate_limits" ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY (id);
ALTER TABLE public."rate_limits" ADD CONSTRAINT "rate_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_rating_check" CHECK (rating >= 1 AND rating <= 5);
ALTER TABLE public."seller_payouts" ADD CONSTRAINT "seller_payouts_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE public."seller_payouts" ADD CONSTRAINT "seller_payouts_pkey" PRIMARY KEY (id);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_amount_check" CHECK (amount > 0);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_currency_check" CHECK (currency = 'XOF'::text);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_entry_type_check" CHECK (entry_type = 'order_release_credit'::text);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_idempotency_key_key" UNIQUE (idempotency_key);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_one_release_per_order" UNIQUE (order_id, entry_type);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_pkey" PRIMARY KEY (id);
ALTER TABLE public."seller_wallet_ledger" ADD CONSTRAINT "seller_wallet_ledger_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public."series" ADD CONSTRAINT "series_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."series" ADD CONSTRAINT "series_pkey" PRIMARY KEY (id);
ALTER TABLE public."series_episodes" ADD CONSTRAINT "series_episodes_pkey" PRIMARY KEY (id);
ALTER TABLE public."series_episodes" ADD CONSTRAINT "series_episodes_series_id_fkey" FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE;
ALTER TABLE public."series_episodes" ADD CONSTRAINT "series_episodes_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."series_subscriptions" ADD CONSTRAINT "series_subscriptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."series_subscriptions" ADD CONSTRAINT "series_subscriptions_series_id_fkey" FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE;
ALTER TABLE public."series_subscriptions" ADD CONSTRAINT "series_subscriptions_series_id_user_id_key" UNIQUE (series_id, user_id);
ALTER TABLE public."series_subscriptions" ADD CONSTRAINT "series_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."sounds" ADD CONSTRAINT "sounds_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."sounds" ADD CONSTRAINT "sounds_pkey" PRIMARY KEY (id);
ALTER TABLE public."sounds" ADD CONSTRAINT "sounds_type_check" CHECK (type = ANY (ARRAY['music'::text, 'original'::text, 'effect'::text]));
ALTER TABLE public."spotlights" ADD CONSTRAINT "spotlights_pkey" PRIMARY KEY (id);
ALTER TABLE public."spotlights" ADD CONSTRAINT "spotlights_type_check" CHECK (type = ANY (ARRAY['creator_of_week'::text, 'video_of_week'::text]));
ALTER TABLE public."spotlights" ADD CONSTRAINT "spotlights_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."spotlights" ADD CONSTRAINT "spotlights_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."stories" ADD CONSTRAINT "stories_duration_check" CHECK (duration >= 5 AND duration <= 15);
ALTER TABLE public."stories" ADD CONSTRAINT "stories_pkey" PRIMARY KEY (id);
ALTER TABLE public."stories" ADD CONSTRAINT "stories_type_check" CHECK (type = ANY (ARRAY['photo'::text, 'video'::text, 'text'::text]));
ALTER TABLE public."stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."story_views" ADD CONSTRAINT "story_views_pkey" PRIMARY KEY (id);
ALTER TABLE public."story_views" ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
ALTER TABLE public."story_views" ADD CONSTRAINT "story_views_story_id_viewer_id_key" UNIQUE (story_id, viewer_id);
ALTER TABLE public."story_views" ADD CONSTRAINT "story_views_viewer_id_fkey" FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."super_notifications" ADD CONSTRAINT "super_notifications_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."super_notifications" ADD CONSTRAINT "super_notifications_follower_id_creator_id_key" UNIQUE (follower_id, creator_id);
ALTER TABLE public."super_notifications" ADD CONSTRAINT "super_notifications_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."super_notifications" ADD CONSTRAINT "super_notifications_pkey" PRIMARY KEY (id);
ALTER TABLE public."transactions" ADD CONSTRAINT "transactions_flw_tx_ref_key" UNIQUE (flw_tx_ref);
ALTER TABLE public."transactions" ADD CONSTRAINT "transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."typing_indicators" ADD CONSTRAINT "typing_indicators_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public."typing_indicators" ADD CONSTRAINT "typing_indicators_conversation_id_user_id_key" UNIQUE (conversation_id, user_id);
ALTER TABLE public."typing_indicators" ADD CONSTRAINT "typing_indicators_pkey" PRIMARY KEY (id);
ALTER TABLE public."typing_indicators" ADD CONSTRAINT "typing_indicators_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE (blocker_id, blocked_id);
ALTER TABLE public."user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_blocks" ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_token_key" UNIQUE (token);
ALTER TABLE public."user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_interests" ADD CONSTRAINT "user_interests_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_interests" ADD CONSTRAINT "user_interests_user_id_key" UNIQUE (user_id);
ALTER TABLE public."user_onboarding" ADD CONSTRAINT "user_onboarding_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_onboarding" ADD CONSTRAINT "user_onboarding_step_completed_check" CHECK (step_completed >= 0 AND step_completed <= 5);
ALTER TABLE public."user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_key" UNIQUE (user_id);
ALTER TABLE public."user_presence" ADD CONSTRAINT "user_presence_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_presence" ADD CONSTRAINT "user_presence_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."user_presence" ADD CONSTRAINT "user_presence_user_id_key" UNIQUE (user_id);
ALTER TABLE public."user_settings" ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."user_settings" ADD CONSTRAINT "user_settings_settings_check" CHECK (jsonb_typeof(settings) = 'object'::text);
ALTER TABLE public."user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_analytics" ADD CONSTRAINT "video_analytics_pkey" PRIMARY KEY (id);
ALTER TABLE public."video_analytics" ADD CONSTRAINT "video_analytics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_analytics" ADD CONSTRAINT "video_analytics_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."video_comments" ADD CONSTRAINT "video_comments_content_check" CHECK (char_length(content) <= 1000);
ALTER TABLE public."video_comments" ADD CONSTRAINT "video_comments_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES video_comments(id) ON DELETE CASCADE;
ALTER TABLE public."video_comments" ADD CONSTRAINT "video_comments_pkey" PRIMARY KEY (id);
ALTER TABLE public."video_comments" ADD CONSTRAINT "video_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_comments" ADD CONSTRAINT "video_comments_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."video_likes" ADD CONSTRAINT "video_likes_pkey" PRIMARY KEY (video_id, user_id);
ALTER TABLE public."video_likes" ADD CONSTRAINT "video_likes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_likes" ADD CONSTRAINT "video_likes_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."video_saves" ADD CONSTRAINT "video_saves_pkey" PRIMARY KEY (video_id, user_id);
ALTER TABLE public."video_saves" ADD CONSTRAINT "video_saves_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_saves" ADD CONSTRAINT "video_saves_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."video_scores" ADD CONSTRAINT "video_scores_pkey" PRIMARY KEY (id);
ALTER TABLE public."video_scores" ADD CONSTRAINT "video_scores_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_scores" ADD CONSTRAINT "video_scores_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."video_scores" ADD CONSTRAINT "video_scores_video_id_user_id_key" UNIQUE (video_id, user_id);
ALTER TABLE public."video_watch_history" ADD CONSTRAINT "video_watch_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."video_watch_history" ADD CONSTRAINT "video_watch_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."video_watch_history" ADD CONSTRAINT "video_watch_history_user_id_video_id_key" UNIQUE (user_id, video_id);
ALTER TABLE public."video_watch_history" ADD CONSTRAINT "video_watch_history_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE public."videos" ADD CONSTRAINT "videos_cloudflare_status_check" CHECK (cloudflare_status = ANY (ARRAY['uploading'::text, 'processing'::text, 'ready'::text, 'error'::text]));
ALTER TABLE public."videos" ADD CONSTRAINT "videos_duration_check" CHECK (duration >= 0 AND duration <= 600);
ALTER TABLE public."videos" ADD CONSTRAINT "videos_pkey" PRIMARY KEY (id);
ALTER TABLE public."videos" ADD CONSTRAINT "videos_privacy_check" CHECK (privacy = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text]));
ALTER TABLE public."videos" ADD CONSTRAINT "videos_series_id_fkey" FOREIGN KEY (series_id) REFERENCES series(id);
ALTER TABLE public."videos" ADD CONSTRAINT "videos_sound_id_fkey" FOREIGN KEY (sound_id) REFERENCES sounds(id);
ALTER TABLE public."videos" ADD CONSTRAINT "videos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."virtual_gifts" ADD CONSTRAINT "virtual_gifts_pkey" PRIMARY KEY (id);
ALTER TABLE public."ad_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ad_impressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."afrixa_coins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."banned_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."challenge_submissions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX challenges_status_dates_idx ON public.challenges USING btree (status, starts_at, ends_at);
ALTER TABLE public."challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coin_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coin_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."coin_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."collab_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."collab_videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comment_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comment_mentions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comments_video_id ON public.comments USING btree (video_id, created_at DESC);
ALTER TABLE public."comments" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_commission_splits_tx ON public.commission_splits USING btree (transaction_id);
ALTER TABLE public."commission_splits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."commissions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX content_reports_status_idx ON public.content_reports USING btree (status, created_at DESC);
CREATE INDEX content_reports_content_idx ON public.content_reports USING btree (content_type, content_id);
ALTER TABLE public."content_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conversations" ENABLE ROW LEVEL SECURITY;
CREATE INDEX creator_earnings_user_created_idx ON public.creator_earnings USING btree (user_id, created_at DESC);
ALTER TABLE public."creator_earnings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."creator_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."creator_wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fan_club_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fan_clubs" ENABLE ROW LEVEL SECURITY;
CREATE INDEX follow_requests_target_idx ON public.follow_requests USING btree (target_id, status);
ALTER TABLE public."follow_requests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_follows_following ON public.follows USING btree (following_id);
ALTER TABLE public."follows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."gift_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."help_messages" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_live_sessions_status ON public.live_sessions USING btree (status, started_at DESC);
CREATE INDEX idx_live_sessions_host ON public.live_sessions USING btree (host_id, started_at DESC);
CREATE INDEX live_sessions_host_status_idx ON public.live_sessions USING btree (host_id, status, started_at DESC);
ALTER TABLE public."live_sessions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX login_history_user_created_idx ON public.login_history USING btree (user_id, created_at DESC);
ALTER TABLE public."login_history" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id, created_at);
ALTER TABLE public."messages" ENABLE ROW LEVEL SECURITY;
CREATE INDEX moderation_actions_user_active_idx ON public.moderation_actions USING btree (user_id, is_active, created_at DESC);
ALTER TABLE public."moderation_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notification_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id, is_read);
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_timeline" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_buyer_id ON public.orders USING btree (buyer_id);
CREATE INDEX idx_orders_seller_id ON public.orders USING btree (seller_id);
CREATE INDEX orders_seller_active_idx ON public.orders USING btree (seller_id, created_at DESC) WHERE (escrow_released = false);
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_payment_tx_order ON public.payment_transactions USING btree (order_id);
CREATE INDEX idx_payment_tx_ref ON public.payment_transactions USING btree (fedapay_ref);
ALTER TABLE public."payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."premium_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_seller ON public.products USING btree (seller_id);
CREATE INDEX idx_products_category ON public.products USING btree (category);
CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_products_seller_id ON public.products USING btree (seller_id);
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;
CREATE INDEX profile_analytics_user_date_idx ON public.profile_analytics USING btree (user_id, recorded_date DESC);
ALTER TABLE public."profile_analytics" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_profiles_numero_mobile ON public.profiles USING btree (numero_mobile);
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
CREATE INDEX rate_limits_user_action_idx ON public.rate_limits USING btree (user_id, action, window_start DESC);
ALTER TABLE public."rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reviews" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX seller_payouts_reference_unique ON public.seller_payouts USING btree (payout_reference) WHERE (payout_reference IS NOT NULL);
ALTER TABLE public."seller_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."seller_wallet_ledger" ENABLE ROW LEVEL SECURITY;
CREATE INDEX series_creator_idx ON public.series USING btree (creator_id, created_at DESC);
ALTER TABLE public."series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."series_episodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."series_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."spotlights" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stories_user_id ON public.stories USING btree (user_id, expires_at);
ALTER TABLE public."stories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."story_views" ENABLE ROW LEVEL SECURITY;
CREATE INDEX super_notifications_creator_idx ON public.super_notifications USING btree (creator_id) WHERE (is_active = true);
ALTER TABLE public."super_notifications" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_transactions_user ON public.transactions USING btree (user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);
ALTER TABLE public."transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."typing_indicators" ENABLE ROW LEVEL SECURITY;
CREATE INDEX user_blocks_blocker_idx ON public.user_blocks USING btree (blocker_id, blocked_id);
ALTER TABLE public."user_blocks" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_fcm_tokens_user ON public.user_fcm_tokens USING btree (user_id);
ALTER TABLE public."user_fcm_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_interests" ENABLE ROW LEVEL SECURITY;
CREATE INDEX user_onboarding_user_id_idx ON public.user_onboarding USING btree (user_id);
ALTER TABLE public."user_onboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_presence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_settings" ENABLE ROW LEVEL SECURITY;
CREATE INDEX video_analytics_user_date_idx ON public.video_analytics USING btree (user_id, recorded_date DESC);
ALTER TABLE public."video_analytics" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_video_comments_video ON public.video_comments USING btree (video_id, created_at DESC);
ALTER TABLE public."video_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."video_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."video_saves" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_video_scores_user_score ON public.video_scores USING btree (user_id, score DESC);
ALTER TABLE public."video_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."video_watch_history" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_videos_feed ON public.videos USING btree (is_published, created_at DESC);
CREATE INDEX idx_videos_user ON public.videos USING btree (user_id, created_at DESC);
CREATE INDEX idx_videos_moderation ON public.videos USING btree (moderation_status);
CREATE INDEX idx_videos_user_id ON public.videos USING btree (user_id);
CREATE INDEX idx_videos_created_at ON public.videos USING btree (created_at DESC);
CREATE INDEX videos_search_idx ON public.videos USING gin (search_vector);
CREATE UNIQUE INDEX videos_cloudflare_uid_unique ON public.videos USING btree (cloudflare_uid) WHERE (cloudflare_uid IS NOT NULL);
ALTER TABLE public."videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."virtual_gifts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profils publics accessibles a tous" ON public."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Utilisateur peut creer son profil" ON public."profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur peut modifier son profil" ON public."profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own orders" ON public."orders" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)));
CREATE POLICY "Buyers can create orders" ON public."orders" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = buyer_id));
CREATE POLICY "Users can view timeline of their orders" ON public."order_timeline" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_timeline.order_id) AND ((orders.buyer_id = auth.uid()) OR (orders.seller_id = auth.uid()))))));
CREATE POLICY "System can insert timeline entries" ON public."order_timeline" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_timeline.order_id) AND ((orders.buyer_id = auth.uid()) OR (orders.seller_id = auth.uid()))))));
CREATE POLICY "Users can view their notifications" ON public."notifications" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Only system can manage commissions" ON public."commissions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = commissions.order_id) AND ((orders.buyer_id = auth.uid()) OR (orders.seller_id = auth.uid()))))));
CREATE POLICY "Sellers can view their payouts" ON public."seller_payouts" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = seller_id));
CREATE POLICY "Dispute participants can view" ON public."disputes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)));
CREATE POLICY "Reviews are public" ON public."reviews" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Buyers can create reviews" ON public."reviews" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = buyer_id));
CREATE POLICY "Users can update their notifications" ON public."notifications" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own notifications" ON public."notifications" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Produits actifs visibles publiquement" ON public."products" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((is_active = true) OR (auth.uid() = seller_id)));
CREATE POLICY "Vendeur peut créer ses produits" ON public."products" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = seller_id));
CREATE POLICY "Vendeur peut modifier ses produits" ON public."products" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = seller_id));
CREATE POLICY "Vendeur peut supprimer ses produits" ON public."products" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = seller_id));
CREATE POLICY "Utilisateur envoie ses messages d'aide" ON public."help_messages" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur voit ses messages d'aide" ON public."help_messages" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Order participants can view transactions" ON public."payment_transactions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = payment_transactions.order_id) AND ((o.buyer_id = auth.uid()) OR (o.seller_id = auth.uid()))))));
CREATE POLICY "Utilisateur peut suivre" ON public."follows" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "Utilisateur peut se desabonner" ON public."follows" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = follower_id));
CREATE POLICY "Likes visibles par tous" ON public."video_likes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Buyers can create transactions" ON public."payment_transactions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = payment_transactions.order_id) AND (o.buyer_id = auth.uid())))));
CREATE POLICY "Order participants can view splits" ON public."commission_splits" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (payment_transactions pt
     JOIN orders o ON ((o.id = pt.order_id)))
  WHERE ((pt.id = commission_splits.transaction_id) AND ((o.buyer_id = auth.uid()) OR (o.seller_id = auth.uid()))))));
CREATE POLICY "Voir ses conversations" ON public."conversations" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = participant_1) OR (auth.uid() = participant_2)));
CREATE POLICY "Créer une conversation" ON public."conversations" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = participant_1) OR (auth.uid() = participant_2)));
CREATE POLICY "Modifier sa conversation" ON public."conversations" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = participant_1) OR (auth.uid() = participant_2)));
CREATE POLICY "Voir messages de sa conversation" ON public."messages" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_1 = auth.uid()) OR (conversations.participant_2 = auth.uid()))))));
CREATE POLICY "Envoyer un message" ON public."messages" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_1 = auth.uid()) OR (conversations.participant_2 = auth.uid())))))));
CREATE POLICY "Modifier son message" ON public."messages" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = sender_id));
CREATE POLICY "Voir indicateur frappe" ON public."typing_indicators" AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = typing_indicators.conversation_id) AND ((conversations.participant_1 = auth.uid()) OR (conversations.participant_2 = auth.uid()))))));
CREATE POLICY "Présence visible par tous" ON public."user_presence" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Modifier sa présence" ON public."user_presence" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Createur peut publier ses videos" ON public."videos" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Createur peut modifier ses videos" ON public."videos" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Createur peut supprimer ses videos" ON public."videos" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Abonnements visibles par tous" ON public."follows" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Utilisateur peut aimer une video" ON public."video_likes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur peut retirer son like" ON public."video_likes" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Utilisateur voit ses sauvegardes" ON public."video_saves" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Utilisateur peut sauvegarder une video" ON public."video_saves" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur peut retirer sa sauvegarde" ON public."video_saves" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Commentaires visibles par tous" ON public."video_comments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((is_deleted = false));
CREATE POLICY "Utilisateur peut commenter" ON public."video_comments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur peut modifier son commentaire" ON public."video_comments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Lives publics visibles" ON public."live_sessions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Createur peut demarrer un live" ON public."live_sessions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = host_id));
CREATE POLICY "Createur peut gerer son live" ON public."live_sessions" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = host_id)) WITH CHECK ((auth.uid() = host_id));
CREATE POLICY "Utilisateur voit son wallet coins" ON public."coin_balances" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Utilisateur initialise son wallet coins" ON public."coin_balances" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur voit ses transactions" ON public."transactions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Utilisateur cree ses transactions" ON public."transactions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur gere ses tokens FCM" ON public."user_fcm_tokens" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Utilisateur gere ses preferences notification" ON public."notification_settings" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "creator_program_select_all" ON public."creator_program" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "creator_earnings_owner_select" ON public."creator_earnings" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "creator_earnings_owner_insert" ON public."creator_earnings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "creator_wallet_owner_all" ON public."creator_wallet" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "virtual_gifts_select_all" ON public."virtual_gifts" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "gift_transactions_participants_select" ON public."gift_transactions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "gift_transactions_sender_insert" ON public."gift_transactions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = sender_id));
CREATE POLICY "spotlights_select_active" ON public."spotlights" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((is_active = true));
CREATE POLICY "afrixa_coins_owner_all" ON public."afrixa_coins" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "video_analytics_owner_select" ON public."video_analytics" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "profile_analytics_owner_select" ON public."profile_analytics" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "collab_requests_participants_all" ON public."collab_requests" AS PERMISSIVE FOR ALL TO PUBLIC USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id))) WITH CHECK (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));
CREATE POLICY "collab_videos_select_all" ON public."collab_videos" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "challenges_select_all" ON public."challenges" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "challenge_submissions_select_all" ON public."challenge_submissions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "challenge_submissions_owner_insert" ON public."challenge_submissions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "series_select_all" ON public."series" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "series_owner_all" ON public."series" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = creator_id)) WITH CHECK ((auth.uid() = creator_id));
CREATE POLICY "series_episodes_select_all" ON public."series_episodes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "series_subscriptions_owner_all" ON public."series_subscriptions" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "fan_clubs_select_all" ON public."fan_clubs" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "fan_clubs_owner_all" ON public."fan_clubs" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = creator_id)) WITH CHECK ((auth.uid() = creator_id));
CREATE POLICY "fan_club_memberships_owner_select" ON public."fan_club_memberships" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "fan_club_memberships_owner_insert" ON public."fan_club_memberships" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "super_notifications_owner_all" ON public."super_notifications" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = follower_id)) WITH CHECK ((auth.uid() = follower_id));
CREATE POLICY "super_notifications_creator_count" ON public."super_notifications" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = creator_id) OR (auth.uid() = follower_id)));
CREATE POLICY "rate_limits_owner_select" ON public."rate_limits" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "moderation_actions_owner_select" ON public."moderation_actions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "banned_words_public_select" ON public."banned_words" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "content_reports_owner_insert" ON public."content_reports" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = reporter_id));
CREATE POLICY "content_reports_owner_select" ON public."content_reports" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = reporter_id));
CREATE POLICY "user_blocks_owner_all" ON public."user_blocks" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = blocker_id)) WITH CHECK ((auth.uid() = blocker_id));
CREATE POLICY "follow_requests_participants_select" ON public."follow_requests" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = requester_id) OR (auth.uid() = target_id)));
CREATE POLICY "follow_requests_requester_insert" ON public."follow_requests" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = requester_id));
CREATE POLICY "follow_requests_target_update" ON public."follow_requests" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = target_id)) WITH CHECK ((auth.uid() = target_id));
CREATE POLICY "login_history_owner_select" ON public."login_history" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "login_history_owner_insert" ON public."login_history" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "user_onboarding_owner_select" ON public."user_onboarding" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "user_onboarding_owner_insert" ON public."user_onboarding" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "user_onboarding_owner_update" ON public."user_onboarding" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "sounds_public_select" ON public."sounds" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "video_watch_history_owner_all" ON public."video_watch_history" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "comments_public_select" ON public."comments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((is_deleted = false));
CREATE POLICY "comments_owner_insert" ON public."comments" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "comments_owner_update" ON public."comments" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "comment_likes_owner_all" ON public."comment_likes" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "comment_mentions_public_select" ON public."comment_mentions" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "stories_public_select" ON public."stories" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((expires_at > now()) AND (is_archived = false)));
CREATE POLICY "stories_owner_all" ON public."stories" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "story_views_owner_all" ON public."story_views" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = viewer_id)) WITH CHECK ((auth.uid() = viewer_id));
CREATE POLICY "user_interests_owner_all" ON public."user_interests" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "video_scores_owner_select" ON public."video_scores" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "ad_campaigns_public_active_select" ON public."ad_campaigns" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((status = 'active'::text));
CREATE POLICY "ad_impressions_owner_insert" ON public."ad_impressions" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));
CREATE POLICY "premium_subscriptions_owner_select" ON public."premium_subscriptions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "coin_purchases_owner_select" ON public."coin_purchases" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "coin_purchases_owner_insert" ON public."coin_purchases" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "coin_transactions_owner_select" ON public."coin_transactions" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "Videos visibles selon leur confidentialite" ON public."videos" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((auth.uid() = user_id) OR ((is_published = true) AND (privacy = 'public'::text)) OR ((is_published = true) AND (privacy = 'followers'::text) AND (EXISTS ( SELECT 1
   FROM follows
  WHERE ((follows.follower_id = auth.uid()) AND (follows.following_id = videos.user_id)))))));
CREATE POLICY "user_settings_owner_select" ON public."user_settings" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "user_settings_owner_insert" ON public."user_settings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "user_settings_owner_update" ON public."user_settings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "creator_program_owner_insert" ON public."creator_program" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "creator_program_owner_update" ON public."creator_program" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Buyers can open their own eligible order disputes" ON public."disputes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = buyer_id) AND (status = 'ouvert'::text) AND (admin_decision IS NULL) AND (seller_evidence IS NULL) AND (EXISTS ( SELECT 1
   FROM orders order_row
  WHERE ((order_row.id = disputes.order_id) AND (order_row.buyer_id = auth.uid()) AND (order_row.seller_id = disputes.seller_id) AND (order_row.status = ANY (ARRAY['payee'::text, 'en_preparation'::text, 'expediee'::text, 'livree'::text])) AND (order_row.escrow_released = false))))));
CREATE POLICY "Buyer can add evidence to open dispute" ON public."disputes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = buyer_id) AND (status = 'ouvert'::text))) WITH CHECK (((auth.uid() = buyer_id) AND (status = 'ouvert'::text)));
CREATE POLICY "Seller can add evidence to open dispute" ON public."disputes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = seller_id) AND (status = 'ouvert'::text))) WITH CHECK (((auth.uid() = seller_id) AND (status = 'ouvert'::text)));
CREATE POLICY "seller_wallet_ledger_owner_read" ON public."seller_wallet_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((seller_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Order participants can update their own orders" ON public."orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = seller_id))) WITH CHECK (((( SELECT auth.uid() AS uid) = buyer_id) OR (( SELECT auth.uid() AS uid) = seller_id)));

-- Trusted backend role only; anon/authenticated receive no table grants by default.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
