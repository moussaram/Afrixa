-- Lock creator balances and earnings behind trusted server-side operations.
-- This migration intentionally removes all direct client write access.
-- service_role / Edge Functions remain responsible for future audited mutations.

BEGIN;

DROP POLICY IF EXISTS "creator_wallet_owner_all" ON public.creator_wallet;
DROP POLICY IF EXISTS "afrixa_coins_owner_all" ON public.afrixa_coins;
DROP POLICY IF EXISTS "creator_earnings_owner_insert" ON public.creator_earnings;
DROP POLICY IF EXISTS "gift_transactions_sender_insert" ON public.gift_transactions;

DROP POLICY IF EXISTS "creator_wallet_owner_select" ON public.creator_wallet;
DROP POLICY IF EXISTS "afrixa_coins_owner_select" ON public.afrixa_coins;
DROP POLICY IF EXISTS "creator_earnings_owner_select" ON public.creator_earnings;
DROP POLICY IF EXISTS "gift_transactions_participants_select" ON public.gift_transactions;

-- RLS is the row-level boundary; explicit grants also prevent direct writes
-- through any accidental future permissive policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.creator_wallet, public.afrixa_coins,
            public.creator_earnings, public.gift_transactions
  FROM anon, authenticated;

GRANT SELECT
  ON TABLE public.creator_wallet, public.afrixa_coins,
            public.creator_earnings, public.gift_transactions
  TO authenticated;

CREATE POLICY "creator_wallet_owner_select"
  ON public.creator_wallet
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "afrixa_coins_owner_select"
  ON public.afrixa_coins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "creator_earnings_owner_select"
  ON public.creator_earnings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "gift_transactions_participants_select"
  ON public.gift_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

COMMIT;
