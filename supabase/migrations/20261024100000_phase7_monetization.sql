-- =============================================================================
-- Phase 7 - Monetisation des createurs
--
-- 1. Reglages monetaires cote serveur (tip, bonus de vues, retrait minimum).
-- 2. Pourboires reels : debit des Coins du spectateur et credit FCFA du
--    createur, atomiques et idempotents.
-- 3. Bonus de vues calcule par periode a partir de l historique de visionnage,
--    puis valide avant credit.
-- 4. Retraits : demande par le createur, reservation du solde, execution
--    FedaPay et remboursement automatique en cas d echec.
-- 5. Revenus par periode pour Afrixa Studio (plus de somme toutes periodes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reglages et journal des periodes
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.monetization_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tip_min_coins integer NOT NULL DEFAULT 10 CHECK (tip_min_coins > 0),
  tip_fcfa_per_coin integer NOT NULL DEFAULT 5 CHECK (tip_fcfa_per_coin > 0),
  view_bonus_fcfa_per_1000 integer NOT NULL DEFAULT 100 CHECK (view_bonus_fcfa_per_1000 >= 0),
  min_withdrawal_fcfa integer NOT NULL DEFAULT 5000 CHECK (min_withdrawal_fcfa > 0),
  withdrawal_daily_limit integer NOT NULL DEFAULT 3 CHECK (withdrawal_daily_limit > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.monetization_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.monetization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monetization_settings_read" ON public.monetization_settings;
CREATE POLICY "monetization_settings_read"
  ON public.monetization_settings FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.monetization_settings TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.monetization_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monetization_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.creator_earning_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  eligible_views integer NOT NULL DEFAULT 0 CHECK (eligible_views >= 0),
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, period_end)
);

ALTER TABLE public.creator_earning_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_earning_periods_owner_select" ON public.creator_earning_periods;
CREATE POLICY "creator_earning_periods_owner_select"
  ON public.creator_earning_periods FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.creator_earning_periods TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.creator_earning_periods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_earning_periods TO service_role;

-- Les pourboires ont leurs propres operations comptables.
ALTER TABLE public.financial_ledger DROP CONSTRAINT IF EXISTS financial_ledger_operation_check;
ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_operation_check CHECK (operation IN (
  'coin_purchase', 'gift_sent', 'gift_received', 'tip_sent', 'tip_received',
  'creator_earning', 'withdrawal_request', 'withdrawal_paid', 'refund', 'adjustment'
));

-- Colonnes de retrait utilisees par les versements createur.
ALTER TABLE public.seller_payouts
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS fedapay_transfer_id text,
  ADD COLUMN IF NOT EXISTS fedapay_transfer_ref text,
  ADD COLUMN IF NOT EXISTS fedapay_response jsonb;

CREATE INDEX IF NOT EXISTS seller_payouts_seller_created_idx
  ON public.seller_payouts(seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creator_earnings_user_created_idx
  ON public.creator_earnings(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Lecture des reglages et des revenus
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_monetization_settings()
RETURNS TABLE (
  tip_min_coins integer,
  tip_fcfa_per_coin integer,
  view_bonus_fcfa_per_1000 integer,
  min_withdrawal_fcfa integer,
  withdrawal_daily_limit integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    settings.tip_min_coins,
    settings.tip_fcfa_per_coin,
    settings.view_bonus_fcfa_per_1000,
    settings.min_withdrawal_fcfa,
    settings.withdrawal_daily_limit
  FROM public.monetization_settings AS settings
  WHERE settings.id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_monetization_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_monetization_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_revenue(p_from date, p_to date)
RETURNS TABLE (type text, status text, total bigint, entries bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Periode invalide';
  END IF;

  RETURN QUERY
  SELECT
    earning.type,
    earning.status,
    coalesce(sum(earning.amount), 0)::bigint,
    count(*)::bigint
  FROM public.creator_earnings AS earning
  WHERE earning.user_id = auth.uid()
    AND earning.created_at >= p_from::timestamptz
    AND earning.created_at < (p_to + 1)::timestamptz
  GROUP BY earning.type, earning.status
  ORDER BY earning.type, earning.status;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_revenue(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_revenue(date, date) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Pourboires reels
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_tip(
  p_video_id uuid,
  p_coins integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_video public.videos%ROWTYPE;
  v_settings public.monetization_settings%ROWTYPE;
  v_existing public.financial_ledger%ROWTYPE;
  v_balance integer;
  v_receiver_balance integer;
  v_fcfa integer;
  v_recent integer;
  v_tip_id uuid;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour soutenir un createur';
  END IF;
  IF p_video_id IS NULL OR p_coins IS NULL OR p_coins <= 0
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de pourboire invalides';
  END IF;

  SELECT * INTO v_settings FROM public.monetization_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reglages monetaires indisponibles';
  END IF;
  IF p_coins < v_settings.tip_min_coins THEN
    RAISE EXCEPTION 'Le pourboire minimum est de % coins', v_settings.tip_min_coins;
  END IF;

  SELECT * INTO v_video FROM public.videos WHERE id = p_video_id;
  IF NOT FOUND
    OR v_video.is_published IS NOT TRUE
    OR v_video.moderation_status <> 'approved'
    OR v_video.cloudflare_status <> 'ready' THEN
    RAISE EXCEPTION 'Video indisponible pour un pourboire';
  END IF;
  IF v_video.user_id = v_sender THEN
    RAISE EXCEPTION 'Impossible de se soutenir soi-meme';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key || ':sent';
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.coin_transactions
  WHERE user_id = v_sender AND type = 'sent_tip' AND created_at > now() - interval '1 minute';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Trop de pourboires envoyes, reessayez dans une minute';
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  SELECT balance INTO v_balance
  FROM public.coin_balances
  WHERE user_id = v_sender
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solde de coins insuffisant';
  END IF;
  IF v_balance < p_coins THEN
    RAISE EXCEPTION 'Solde de coins insuffisant';
  END IF;

  v_fcfa := p_coins * v_settings.tip_fcfa_per_coin;

  UPDATE public.coin_balances
  SET balance = public.coin_balances.balance - p_coins,
      lifetime_spent = public.coin_balances.lifetime_spent + p_coins,
      updated_at = now()
  WHERE user_id = v_sender;

  UPDATE public.afrixa_coins
  SET balance = greatest(balance - p_coins, 0), updated_at = now()
  WHERE user_id = v_sender;

  INSERT INTO public.creator_wallet (user_id, balance, pending, total_earned)
  VALUES (v_video.user_id, v_fcfa, 0, v_fcfa)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.creator_wallet.balance + EXCLUDED.balance,
        total_earned = public.creator_wallet.total_earned + EXCLUDED.total_earned,
        updated_at = now()
  RETURNING balance INTO v_receiver_balance;

  INSERT INTO public.creator_earnings (user_id, video_id, type, amount, status)
  VALUES (v_video.user_id, v_video.id, 'tip_received', v_fcfa, 'confirmed')
  RETURNING id INTO v_tip_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (v_sender, 'sent_tip', -p_coins, v_video.id, 'Pourboire');

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (v_video.user_id, 'received_tip', v_fcfa, v_video.id, 'Pourboire recu');

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_sender, 'tip_sent', 'debit', -p_coins, 0, v_balance - p_coins,
    'creator_earning', v_tip_id, v_key || ':sent',
    jsonb_build_object('video_id', v_video.id, 'creator_id', v_video.user_id)
  );

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_video.user_id, 'tip_received', 'credit', 0, v_fcfa, v_receiver_balance,
    'creator_earning', v_tip_id, v_key || ':received',
    jsonb_build_object('video_id', v_video.id, 'sender_id', v_sender)
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'coins_spent', p_coins,
    'fcfa_earned', v_fcfa,
    'sender_balance', v_balance - p_coins,
    'receiver_balance', v_receiver_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_tip(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tip(uuid, integer, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Bonus de vues par periode
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accrue_view_earnings(
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings public.monetization_settings%ROWTYPE;
  v_creator record;
  v_amount integer;
  v_views integer;
  v_processed integer := 0;
  v_total integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Calcul reserve au serveur';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL
    OR p_period_end < p_period_start
    OR (p_period_end - p_period_start) > 31 THEN
    RAISE EXCEPTION 'Periode de calcul invalide';
  END IF;

  SELECT * INTO v_settings FROM public.monetization_settings WHERE id = 1;
  IF NOT FOUND OR v_settings.view_bonus_fcfa_per_1000 <= 0 THEN
    RETURN jsonb_build_object('processed', 0, 'amount', 0);
  END IF;

  FOR v_creator IN
    SELECT
      video.user_id AS creator_id,
      count(DISTINCT history.user_id || ':' || history.video_id)::int AS eligible_views
    FROM public.video_watch_history AS history
    JOIN public.videos AS video ON video.id = history.video_id
    WHERE history.last_watched_at >= p_period_start::timestamptz
      AND history.last_watched_at < (p_period_end + 1)::timestamptz
      AND history.watch_duration >= 3
      AND history.user_id <> video.user_id
      AND video.is_published = true
      AND video.moderation_status = 'approved'
      AND video.cloudflare_status = 'ready'
    GROUP BY video.user_id
  LOOP
    -- Plafond anti-fraude : au plus 100 000 vues eligibles par createur et
    -- par periode.
    v_views := least(v_creator.eligible_views, 100000);
    v_amount := floor(v_views * v_settings.view_bonus_fcfa_per_1000 / 1000.0);
    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.creator_earning_periods (user_id, period_start, period_end, eligible_views, amount)
    VALUES (v_creator.creator_id, p_period_start, p_period_end, v_views, v_amount)
    ON CONFLICT (user_id, period_start, period_end) DO NOTHING;
    CONTINUE WHEN NOT FOUND;

    PERFORM public.credit_creator_earning(
      v_creator.creator_id,
      NULL,
      'views_bonus',
      v_amount,
      NULL,
      'views:' || v_creator.creator_id::text || ':' || p_period_start::text
    );
    v_processed := v_processed + 1;
    v_total := v_total + v_amount;
  END LOOP;

  RETURN jsonb_build_object('processed', v_processed, 'amount', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_view_earnings(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accrue_view_earnings(date, date) TO service_role;

-- Validation d un gain en attente (bonus de vues) : le montant quitte le
-- "pending" et devient disponible au retrait.
CREATE OR REPLACE FUNCTION public.approve_creator_earning(p_earning_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_earning public.creator_earnings%ROWTYPE;
  v_key text;
  v_balance integer;
BEGIN
  IF p_earning_id IS NULL THEN
    RAISE EXCEPTION 'Gain introuvable';
  END IF;

  SELECT * INTO v_earning FROM public.creator_earnings WHERE id = p_earning_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gain introuvable';
  END IF;
  IF v_earning.status = 'confirmed' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'confirmed');
  END IF;
  IF v_earning.status <> 'pending' THEN
    RAISE EXCEPTION 'Ce gain ne peut pas etre valide';
  END IF;

  v_key := 'earning-confirm:' || v_earning.id::text;
  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = v_key) THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'confirmed');
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  UPDATE public.creator_wallet
  SET balance = public.creator_wallet.balance + v_earning.amount,
      pending = greatest(public.creator_wallet.pending - v_earning.amount, 0),
      updated_at = now()
  WHERE user_id = v_earning.user_id
  RETURNING balance INTO v_balance;

  UPDATE public.creator_earnings SET status = 'confirmed' WHERE id = v_earning.id;

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_earning.user_id, 'creator_earning', 'credit', 0, v_earning.amount, coalesce(v_balance, 0),
    'creator_earning', v_earning.id, v_key,
    jsonb_build_object('type', v_earning.type, 'validated', true)
  );

  RETURN jsonb_build_object('duplicate', false, 'status', 'confirmed', 'balance', coalesce(v_balance, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.approve_creator_earning(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_creator_earning(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Retraits createur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_my_withdrawal(
  p_amount integer,
  p_operator text,
  p_phone text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_settings public.monetization_settings%ROWTYPE;
  v_operator text := nullif(btrim(coalesce(p_operator, '')), '');
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_balance integer;
  v_pending integer;
  v_today integer;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour retirer';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0
    OR v_operator IS NULL
    OR length(v_phone_digits) < 8 OR length(v_phone_digits) > 15
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de retrait invalides';
  END IF;

  SELECT * INTO v_settings FROM public.monetization_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reglages monetaires indisponibles';
  END IF;
  IF p_amount < v_settings.min_withdrawal_fcfa THEN
    RAISE EXCEPTION 'Le retrait minimum est de % FCFA', v_settings.min_withdrawal_fcfa;
  END IF;

  SELECT balance INTO v_balance FROM public.creator_wallet WHERE user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portefeuille createur introuvable';
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Solde disponible insuffisant';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.seller_payouts
  WHERE seller_id = v_user AND status IN ('demande', 'processing');
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Un retrait est deja en cours de traitement';
  END IF;

  SELECT count(*) INTO v_today
  FROM public.seller_payouts
  WHERE seller_id = v_user AND created_at >= date_trunc('day', now());
  IF v_today >= v_settings.withdrawal_daily_limit THEN
    RAISE EXCEPTION 'Limite quotidienne de retraits atteinte';
  END IF;

  v_result := public.request_creator_withdrawal(v_user, p_amount, v_operator, btrim(p_phone), v_key);

  IF coalesce((v_result ->> 'duplicate')::boolean, false) IS FALSE THEN
    PERFORM set_config('afrixa.financial_writer', 'on', true);
    UPDATE public.seller_payouts
    SET payout_reference = 'AFR-WD-' || replace((v_result ->> 'payout_id'), '-', '')
    WHERE id = (v_result ->> 'payout_id')::uuid
      AND payout_reference IS NULL;
  END IF;

  RETURN v_result || jsonb_build_object('status', coalesce(v_result ->> 'status', 'demande'));
END;
$$;

REVOKE ALL ON FUNCTION public.request_my_withdrawal(integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_my_withdrawal(integer, text, text, text) TO authenticated;

-- Echec d un versement : le montant reserve revient au createur.
CREATE OR REPLACE FUNCTION public.fail_creator_withdrawal(
  p_payout_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payout public.seller_payouts%ROWTYPE;
  v_key text;
  v_balance integer;
BEGIN
  IF p_payout_id IS NULL THEN
    RAISE EXCEPTION 'Retrait introuvable';
  END IF;

  SELECT * INTO v_payout FROM public.seller_payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retrait introuvable';
  END IF;
  IF v_payout.status = 'echec' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'echec');
  END IF;
  IF v_payout.status = 'envoye' THEN
    RAISE EXCEPTION 'Un retrait verse ne peut pas echouer';
  END IF;

  v_key := 'withdrawal-refund:' || v_payout.id::text;
  IF EXISTS (SELECT 1 FROM public.financial_ledger WHERE idempotency_key = v_key) THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'echec');
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  UPDATE public.seller_payouts
  SET status = 'echec',
      fedapay_response = coalesce(fedapay_response, '{}'::jsonb) || jsonb_build_object('failure_reason', left(coalesce(p_reason, 'echec'), 200))
  WHERE id = v_payout.id;

  UPDATE public.creator_wallet
  SET balance = public.creator_wallet.balance + v_payout.amount,
      updated_at = now()
  WHERE user_id = v_payout.seller_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_payout.seller_id, 'adjustment', 'credit', 0, v_payout.amount, coalesce(v_balance, 0),
    'seller_payout', v_payout.id, v_key,
    jsonb_build_object('reason', 'withdrawal_failed', 'detail', p_reason)
  );

  RETURN jsonb_build_object('duplicate', false, 'status', 'echec', 'balance', coalesce(v_balance, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.fail_creator_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_creator_withdrawal(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_withdrawals(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  amount integer,
  operator text,
  phone_masked text,
  status text,
  payout_reference text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  RETURN QUERY
  SELECT
    payout.id,
    payout.amount,
    payout.operator,
    CASE
      WHEN payout.phone IS NULL OR length(payout.phone) < 4 THEN '***'
      ELSE overlay(payout.phone placing '***' from greatest(length(payout.phone) - 3, 1) for 3)
    END,
    payout.status,
    payout.payout_reference,
    payout.created_at
  FROM public.seller_payouts AS payout
  WHERE payout.seller_id = auth.uid()
    AND payout.order_id IS NULL
  ORDER BY payout.created_at DESC
  LIMIT least(coalesce(p_limit, 20), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_withdrawals(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_withdrawals(integer) TO authenticated;

COMMENT ON FUNCTION public.send_tip(uuid, integer, text) IS
  'Pourboire en Coins : debit du spectateur et credit FCFA du createur, idempotent.';
COMMENT ON FUNCTION public.request_my_withdrawal(integer, text, text, text) IS
  'Demande de retrait createur : minimum, solde, antifraude puis reservation du montant.';
COMMENT ON FUNCTION public.accrue_view_earnings(date, date) IS
  'Calcule et valide les bonus de vues d une periode a partir de l historique de visionnage.';
