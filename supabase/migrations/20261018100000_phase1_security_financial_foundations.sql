-- =============================================================================
-- Phase 1 - Securite et fondations financieres
--
-- 1. La visibilite des videos conserve les trois niveaux (public / abonnes /
--    prive) et ne depend plus seulement de is_published : la moderation, le
--    traitement Cloudflare, le profil prive du createur et les blocages sont
--    pris en compte.
-- 2. Les champs de moderation et de traitement Cloudflare sont reserves au
--    serveur : un client ne peut plus s'auto-approuver ni publier une video
--    qui n'est pas prete.
-- 3. Toutes les tables financieres perdent leurs ecritures directes. Les
--    operations passent par des fonctions SECURITY DEFINER reservees au
--    service_role et alimentent un journal comptable immuable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Visibilite des videos
-- -----------------------------------------------------------------------------

-- Les regles de visibilite lisent follows / user_blocks / profiles, dont les
-- politiques RLS cachent les lignes aux autres utilisateurs. Cette fonction
-- SECURITY DEFINER applique donc la regle metier sans dependre de ces RLS.
CREATE OR REPLACE FUNCTION public.can_view_creator_content(
  p_creator_id uuid,
  p_privacy text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks AS block
      WHERE block.blocker_id = p_creator_id
        AND block.blocked_id = auth.uid()
    )
    AND (
      (
        p_privacy IN ('public', 'followers')
        AND EXISTS (
          SELECT 1
          FROM public.follows AS follow
          WHERE follow.follower_id = auth.uid()
            AND follow.following_id = p_creator_id
        )
      )
      OR (
        p_privacy = 'public'
        AND NOT EXISTS (
          SELECT 1
          FROM public.profiles AS profile
          WHERE profile.user_id = p_creator_id
            AND profile.is_private = true
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_creator_content(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_creator_content(uuid, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Videos publiees visibles par tous" ON public.videos;
DROP POLICY IF EXISTS "Videos visibles selon leur confidentialite" ON public.videos;

CREATE POLICY "Videos visibles selon leur confidentialite"
  ON public.videos FOR SELECT
  USING (
    -- Le proprietaire voit toujours ses propres videos.
    auth.uid() = user_id
    OR (
      is_published = true
      AND moderation_status = 'approved'
      AND cloudflare_status = 'ready'
      AND public.can_view_creator_content(user_id, privacy)
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Integrite de la publication et de la moderation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_video_publish_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Les Edge Functions (service_role) pilotent la moderation et Cloudflare.
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Une creation cliente ne peut jamais publier ni s'auto-approuver.
    NEW.moderation_status := 'pending';
    NEW.is_published := false;
    NEW.cloudflare_status := 'uploading';
    RETURN NEW;
  END IF;

  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    RAISE EXCEPTION 'La moderation des videos est geree par Afrixa';
  END IF;

  IF NEW.cloudflare_status IS DISTINCT FROM OLD.cloudflare_status
    OR NEW.cloudflare_uid IS DISTINCT FROM OLD.cloudflare_uid
    OR NEW.hls_url IS DISTINCT FROM OLD.hls_url
    OR NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url THEN
    RAISE EXCEPTION 'Le traitement video est gere par Afrixa';
  END IF;

  IF NEW.is_published = true AND OLD.is_published = false THEN
    IF OLD.cloudflare_status <> 'ready' THEN
      RAISE EXCEPTION 'Une video doit etre prete avant publication';
    END IF;
    IF coalesce(OLD.moderation_status, 'pending') = 'rejected' THEN
      RAISE EXCEPTION 'Une video refusee ne peut pas etre publiee';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_video_publish_integrity ON public.videos;
CREATE TRIGGER enforce_video_publish_integrity
  BEFORE INSERT OR UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_video_publish_integrity();

-- -----------------------------------------------------------------------------
-- 3. Journal comptable immuable
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN (
    'coin_purchase', 'gift_sent', 'gift_received', 'creator_earning',
    'withdrawal_request', 'withdrawal_paid', 'refund', 'adjustment'
  )),
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  coins_delta integer NOT NULL DEFAULT 0,
  fcfa_delta integer NOT NULL DEFAULT 0,
  balance_after integer,
  reference_type text,
  reference_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_ledger_amount_present CHECK (coins_delta <> 0 OR fcfa_delta <> 0)
);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_ledger_owner_select" ON public.financial_ledger;
CREATE POLICY "financial_ledger_owner_select"
  ON public.financial_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS financial_ledger_user_created_idx
  ON public.financial_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_ledger_reference_idx
  ON public.financial_ledger(reference_type, reference_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.financial_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT SELECT, INSERT ON public.financial_ledger TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal financier est en append-only';
END;
$$;

DROP TRIGGER IF EXISTS financial_ledger_append_only ON public.financial_ledger;
CREATE TRIGGER financial_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

-- -----------------------------------------------------------------------------
-- 4. Verrouillage des tables financieres
-- -----------------------------------------------------------------------------

-- Politiques d'ecriture proprietaire supprimees (vulnerabilite relevee).
DROP POLICY IF EXISTS "afrixa_coins_owner_all" ON public.afrixa_coins;
DROP POLICY IF EXISTS "creator_wallet_owner_all" ON public.creator_wallet;
DROP POLICY IF EXISTS "creator_earnings_owner_insert" ON public.creator_earnings;
DROP POLICY IF EXISTS "gift_transactions_sender_insert" ON public.gift_transactions;
DROP POLICY IF EXISTS "coin_purchases_owner_insert" ON public.coin_purchases;
DROP POLICY IF EXISTS "Utilisateur initialise son wallet coins" ON public.coin_balances;
DROP POLICY IF EXISTS "Utilisateur cree ses transactions" ON public.transactions;

-- La lecture reste possible sur ses propres donnees.
DROP POLICY IF EXISTS "afrixa_coins_owner_select" ON public.afrixa_coins;
CREATE POLICY "afrixa_coins_owner_select"
  ON public.afrixa_coins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_wallet_owner_select" ON public.creator_wallet;
CREATE POLICY "creator_wallet_owner_select"
  ON public.creator_wallet FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Defense en profondeur : plus aucun droit d'ecriture pour les roles clients,
-- meme si une politique etait ajoutee par erreur plus tard.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.afrixa_coins,
  public.creator_wallet,
  public.creator_earnings,
  public.gift_transactions,
  public.coin_balances,
  public.coin_purchases,
  public.coin_transactions,
  public.transactions,
  public.seller_payouts,
  public.virtual_gifts
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_financial_write_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
    OR coalesce(current_setting('afrixa.financial_writer', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Seuls les serveurs Afrixa peuvent modifier les donnees financieres';
END;
$$;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'afrixa_coins', 'creator_wallet', 'creator_earnings', 'gift_transactions',
    'coin_balances', 'coin_purchases', 'coin_transactions', 'transactions',
    'seller_payouts', 'virtual_gifts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_financial_write_lock ON public.%I', target_table);
    EXECUTE format(
      'CREATE TRIGGER enforce_financial_write_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_write_lock()',
      target_table
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Operations financieres serveur (idempotentes)
-- -----------------------------------------------------------------------------

-- Achat de coins confirme par le fournisseur de paiement (webhook / service).
CREATE OR REPLACE FUNCTION public.credit_coin_purchase(
  p_user_id uuid,
  p_coins integer,
  p_fcfa_paid integer,
  p_operator text,
  p_provider_reference text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_balance integer;
  v_existing public.financial_ledger%ROWTYPE;
  v_purchase_id uuid;
BEGIN
  IF p_user_id IS NULL
    OR p_coins IS NULL OR p_coins <= 0
    OR p_fcfa_paid IS NULL OR p_fcfa_paid <= 0
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres d''achat de coins invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  INSERT INTO public.coin_balances (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_coins, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.coin_balances.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.afrixa_coins (user_id, balance, updated_at)
  VALUES (p_user_id, p_coins, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.afrixa_coins.balance + EXCLUDED.balance,
        updated_at = now();

  INSERT INTO public.coin_purchases (user_id, coins_amount, fcfa_paid, operator, flutterwave_ref, status)
  VALUES (
    p_user_id,
    p_coins,
    p_fcfa_paid,
    coalesce(nullif(btrim(coalesce(p_operator, '')), ''), 'fedapay'),
    p_provider_reference,
    'completed'
  )
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (p_user_id, 'purchased', p_coins, v_purchase_id, 'Achat de coins');

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    p_user_id, 'coin_purchase', 'credit', p_coins, 0, v_balance,
    'coin_purchase', v_purchase_id, v_key,
    jsonb_build_object('fcfa_paid', p_fcfa_paid, 'provider_reference', p_provider_reference)
  );

  RETURN jsonb_build_object('duplicate', false, 'balance', v_balance, 'purchase_id', v_purchase_id);
END;
$$;

-- Envoi d'un cadeau virtuel : debit des coins de l'expediteur et credit du
-- createur, dans une seule transaction.
CREATE OR REPLACE FUNCTION public.send_virtual_gift(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_live_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_gift public.virtual_gifts%ROWTYPE;
  v_existing public.financial_ledger%ROWTYPE;
  v_balance integer;
  v_receiver_balance integer;
  v_gift_tx_id uuid;
BEGIN
  IF p_sender_id IS NULL OR p_receiver_id IS NULL
    OR p_sender_id = p_receiver_id
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de cadeau invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key || ':sent';
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  SELECT * INTO v_gift FROM public.virtual_gifts WHERE id = p_gift_id;
  IF NOT FOUND OR v_gift.price_coins <= 0 THEN
    RAISE EXCEPTION 'Cadeau introuvable ou invalide';
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  SELECT balance INTO v_balance
  FROM public.coin_balances
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT balance INTO v_balance
    FROM public.afrixa_coins
    WHERE user_id = p_sender_id
    FOR UPDATE;
  END IF;

  v_balance := coalesce(v_balance, 0);
  IF v_balance < v_gift.price_coins THEN
    RAISE EXCEPTION 'Solde de coins insuffisant';
  END IF;

  UPDATE public.coin_balances
  SET balance = public.coin_balances.balance - v_gift.price_coins,
      lifetime_spent = public.coin_balances.lifetime_spent + v_gift.price_coins,
      updated_at = now()
  WHERE user_id = p_sender_id;

  UPDATE public.afrixa_coins
  SET balance = greatest(public.afrixa_coins.balance - v_gift.price_coins, 0),
      updated_at = now()
  WHERE user_id = p_sender_id;

  INSERT INTO public.gift_transactions (
    sender_id, receiver_id, live_id, gift_id, coins_spent, fcfa_earned
  ) VALUES (
    p_sender_id, p_receiver_id, p_live_id, v_gift.id, v_gift.price_coins, v_gift.fcfa_value
  )
  RETURNING id INTO v_gift_tx_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (p_sender_id, 'sent_gift', -v_gift.price_coins, v_gift_tx_id, v_gift.name);

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    p_sender_id, 'gift_sent', 'debit', -v_gift.price_coins, 0, v_balance - v_gift.price_coins,
    'gift_transaction', v_gift_tx_id, v_key || ':sent',
    jsonb_build_object('gift', v_gift.name, 'receiver_id', p_receiver_id, 'live_id', p_live_id)
  );

  IF v_gift.fcfa_value > 0 THEN
    INSERT INTO public.creator_wallet (user_id, balance, pending, total_earned)
    VALUES (p_receiver_id, v_gift.fcfa_value, 0, v_gift.fcfa_value)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.creator_wallet.balance + EXCLUDED.balance,
          total_earned = public.creator_wallet.total_earned + EXCLUDED.total_earned,
          updated_at = now()
    RETURNING balance INTO v_receiver_balance;

    INSERT INTO public.creator_earnings (user_id, video_id, type, amount, status)
    VALUES (p_receiver_id, NULL, 'gift_received', v_gift.fcfa_value, 'confirmed');

    INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
    VALUES (p_receiver_id, 'received_gift', v_gift.fcfa_value, v_gift_tx_id, v_gift.name);

    INSERT INTO public.financial_ledger (
      user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
      reference_type, reference_id, idempotency_key, metadata
    ) VALUES (
      p_receiver_id, 'gift_received', 'credit', 0, v_gift.fcfa_value, v_receiver_balance,
      'gift_transaction', v_gift_tx_id, v_key || ':received',
      jsonb_build_object('gift', v_gift.name, 'sender_id', p_sender_id, 'live_id', p_live_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'gift_transaction_id', v_gift_tx_id,
    'sender_balance', v_balance - v_gift.price_coins,
    'receiver_balance', coalesce(v_receiver_balance, 0)
  );
END;
$$;

-- Credit de revenus createur (pourboire, bonus de vues, abonnement).
CREATE OR REPLACE FUNCTION public.credit_creator_earning(
  p_user_id uuid,
  p_video_id uuid,
  p_type text,
  p_amount integer,
  p_reference_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.financial_ledger%ROWTYPE;
  v_status text;
  v_balance integer;
  v_earning_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
    OR p_type NOT IN ('views_bonus', 'gift_received', 'tip_received', 'subscription_revenue')
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de revenu createur invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  -- Un pourboire ou un cadeau est acquis ; les bonus de vues restent a valider.
  v_status := CASE WHEN p_type IN ('tip_received', 'gift_received') THEN 'confirmed' ELSE 'pending' END;

  INSERT INTO public.creator_earnings (user_id, video_id, type, amount, status)
  VALUES (p_user_id, p_video_id, p_type, p_amount, v_status)
  RETURNING id INTO v_earning_id;

  IF v_status = 'confirmed' THEN
    INSERT INTO public.creator_wallet (user_id, balance, pending, total_earned)
    VALUES (p_user_id, p_amount, 0, p_amount)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.creator_wallet.balance + EXCLUDED.balance,
          total_earned = public.creator_wallet.total_earned + EXCLUDED.total_earned,
          updated_at = now()
    RETURNING balance INTO v_balance;
  ELSE
    INSERT INTO public.creator_wallet (user_id, balance, pending, total_earned)
    VALUES (p_user_id, 0, p_amount, p_amount)
    ON CONFLICT (user_id) DO UPDATE
      SET pending = public.creator_wallet.pending + EXCLUDED.pending,
          total_earned = public.creator_wallet.total_earned + EXCLUDED.total_earned,
          updated_at = now()
    RETURNING balance INTO v_balance;
  END IF;

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    p_user_id, 'creator_earning', 'credit', 0, p_amount, v_balance,
    'creator_earning', v_earning_id, v_key,
    jsonb_build_object('type', p_type, 'status', v_status, 'source_reference', p_reference_id)
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'earning_id', v_earning_id,
    'status', v_status,
    'balance', v_balance
  );
END;
$$;

-- Demande de retrait : verifie et reserve le solde disponible. Le versement
-- sortant reste execute par un flux serveur dedie (FEDAPAY_PAYOUTS_ENABLED).
CREATE OR REPLACE FUNCTION public.request_creator_withdrawal(
  p_user_id uuid,
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
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_operator text := nullif(btrim(coalesce(p_operator, '')), '');
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_existing public.financial_ledger%ROWTYPE;
  v_balance integer;
  v_payout_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0
    OR v_operator IS NULL
    OR length(v_phone_digits) < 8 OR length(v_phone_digits) > 15
    OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de retrait invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  SELECT balance INTO v_balance
  FROM public.creator_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portefeuille createur introuvable';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Solde disponible insuffisant';
  END IF;

  UPDATE public.creator_wallet
  SET balance = public.creator_wallet.balance - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.seller_payouts (seller_id, amount, operator, phone, status)
  VALUES (p_user_id, p_amount, v_operator, btrim(p_phone), 'demande')
  RETURNING id INTO v_payout_id;

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    p_user_id, 'withdrawal_request', 'debit', 0, -p_amount, v_balance - p_amount,
    'seller_payout', v_payout_id, v_key,
    jsonb_build_object('operator', v_operator)
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'payout_id', v_payout_id,
    'balance', v_balance - p_amount,
    'status', 'demande'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Droits d'execution : serveur uniquement
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.credit_coin_purchase(uuid, integer, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_virtual_gift(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_creator_earning(uuid, uuid, text, integer, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_creator_withdrawal(uuid, integer, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_coin_purchase(uuid, integer, integer, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.send_virtual_gift(uuid, uuid, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_creator_earning(uuid, uuid, text, integer, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.request_creator_withdrawal(uuid, integer, text, text, text)
  TO service_role;

COMMENT ON TABLE public.financial_ledger IS
  'Journal comptable append-only : toute operation financiere doit y laisser une ligne idempotente.';
COMMENT ON FUNCTION public.credit_coin_purchase(uuid, integer, integer, text, text, text) IS
  'Credit de coins apres confirmation du fournisseur de paiement (service_role uniquement).';
COMMENT ON FUNCTION public.send_virtual_gift(uuid, uuid, uuid, uuid, text) IS
  'Debit des coins de l expediteur et credit du createur, de facon atomique et idempotente.';
