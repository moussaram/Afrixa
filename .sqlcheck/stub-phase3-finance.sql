CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''), current_user)
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  images text[] DEFAULT '{}',
  price integer NOT NULL CHECK(price > 0),
  promo_price integer,
  stock integer DEFAULT 0,
  unlimited_stock boolean DEFAULT false,
  is_group_buy boolean DEFAULT false,
  is_active boolean DEFAULT true
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  product_image text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL,
  total_price integer NOT NULL,
  commission_rate double precision NOT NULL DEFAULT 0.05,
  commission_amount integer NOT NULL DEFAULT 0,
  seller_amount integer NOT NULL DEFAULT 0,
  payment_operator text,
  buyer_phone text,
  delivery_address text,
  buyer_note text,
  status text NOT NULL DEFAULT 'en_attente',
  payment_reference text,
  escrow_released boolean NOT NULL DEFAULT false,
  delivery_lat double precision,
  delivery_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_buyer_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY order_participant_select ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  fedapay_ref text NOT NULL,
  amount integer NOT NULL,
  commission_amount integer NOT NULL DEFAULT 0,
  seller_amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  operator text,
  buyer_phone text,
  status text NOT NULL DEFAULT 'initiated',
  escrow_status text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id),
  afrixa_amount integer NOT NULL,
  seller_amount integer NOT NULL,
  split_type text NOT NULL,
  split_rate double precision NOT NULL,
  status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  order_id uuid REFERENCES public.orders(id),
  amount integer NOT NULL,
  operator text,
  phone text,
  status text NOT NULL DEFAULT 'demande',
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id),
  balance integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  operation text NOT NULL,
  direction text NOT NULL,
  coins_delta integer NOT NULL DEFAULT 0,
  fcfa_delta integer NOT NULL DEFAULT 0,
  balance_after integer,
  reference_type text,
  reference_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.monetization_settings (
  id integer PRIMARY KEY DEFAULT 1,
  min_withdrawal_fcfa integer NOT NULL DEFAULT 5000,
  withdrawal_daily_limit integer NOT NULL DEFAULT 3
);
INSERT INTO public.monetization_settings(id) VALUES(1);

CREATE OR REPLACE FUNCTION public.request_creator_withdrawal(
  p_user uuid, p_amount integer, p_operator text, p_phone text, p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payout_id uuid; new_balance integer;
BEGIN
  UPDATE public.creator_wallet SET balance=balance-p_amount WHERE user_id=p_user RETURNING balance INTO new_balance;
  INSERT INTO public.seller_payouts(seller_id,amount,operator,phone,status)
  VALUES(p_user,p_amount,p_operator,p_phone,'demande') RETURNING id INTO payout_id;
  INSERT INTO public.financial_ledger(user_id,operation,direction,fcfa_delta,balance_after,reference_type,reference_id,idempotency_key)
  VALUES(p_user,'withdrawal_request','debit',-p_amount,new_balance,'seller_payout',payout_id,p_key);
  RETURN jsonb_build_object('duplicate',false,'payout_id',payout_id,'balance',new_balance,'status','demande');
END $$;

GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
