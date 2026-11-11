-- Minimal Supabase-shaped schema for verifying the Phase 1 migration locally.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  phone_confirmed_at timestamptz,
  email_confirmed_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''),
    current_user
  )
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  is_private boolean DEFAULT false
);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  moderation_status text NOT NULL DEFAULT 'pending',
  privacy text NOT NULL DEFAULT 'public',
  cloudflare_status text NOT NULL DEFAULT 'ready',
  cloudflare_uid text,
  hls_url text,
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Createur peut publier ses videos"
  ON public.videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Createur peut modifier ses videos"
  ON public.videos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.virtual_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text,
  price_coins integer NOT NULL,
  fcfa_value integer NOT NULL,
  animation text
);

CREATE TABLE public.coin_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit son wallet coins"
  ON public.coin_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Utilisateur initialise son wallet coins"
  ON public.coin_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.afrixa_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.afrixa_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "afrixa_coins_owner_all"
  ON public.afrixa_coins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.creator_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 0,
  pending integer DEFAULT 0,
  total_earned integer DEFAULT 0,
  withdrawal_operator text,
  withdrawal_phone text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.creator_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_wallet_owner_all"
  ON public.creator_wallet FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('views_bonus', 'gift_received', 'tip_received', 'subscription_revenue')),
  amount integer NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
  period_start date,
  period_end date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator_earnings_owner_select"
  ON public.creator_earnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "creator_earnings_owner_insert"
  ON public.creator_earnings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  live_id uuid,
  gift_id uuid REFERENCES public.virtual_gifts(id) ON DELETE SET NULL,
  coins_spent integer NOT NULL,
  fcfa_earned integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_transactions_participants_select"
  ON public.gift_transactions FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "gift_transactions_sender_insert"
  ON public.gift_transactions FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE TABLE public.coin_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  coins_amount integer NOT NULL,
  fcfa_paid integer NOT NULL,
  operator text NOT NULL,
  flutterwave_ref text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.coin_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_purchases_owner_select"
  ON public.coin_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coin_purchases_owner_insert"
  ON public.coin_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sent_gift', 'received_gift', 'sent_tip', 'received_tip', 'purchased', 'withdrawn')),
  amount integer NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_transactions_owner_select"
  ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount_fcfa integer NOT NULL DEFAULT 0,
  coins_amount integer,
  flw_tx_ref text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit ses transactions"
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Utilisateur cree ses transactions"
  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  order_id uuid,
  amount integer NOT NULL,
  operator text,
  phone text,
  status text NOT NULL DEFAULT 'en_attente',
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can view their payouts"
  ON public.seller_payouts FOR SELECT USING (auth.uid() = seller_id);

-- Supabase grants broad table privileges to client roles by default.
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
