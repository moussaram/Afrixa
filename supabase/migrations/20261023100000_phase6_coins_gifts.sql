-- =============================================================================
-- Phase 6 - Coins et cadeaux
--
-- 1. Les packs de Coins et les cadeaux quittent le code de l'interface et
--    deviennent une configuration serveur (coin_packs, virtual_gifts).
-- 2. L'achat de Coins passe par une intention serveur, un paiement FedaPay et
--    un reglement idempotent : un webhook recu deux fois ne credite qu'une fois.
-- 3. L'envoi d'un cadeau est une fonction serveur : elle verifie le solde,
--    debite l'expediteur et credite le createur dans la meme transaction.
-- 4. Les echecs et remboursements laissent une trace comptable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catalogue serveur
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coin_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  coins integer NOT NULL CHECK (coins > 0),
  price_fcfa integer NOT NULL CHECK (price_fcfa > 0),
  bonus_percent integer NOT NULL DEFAULT 0 CHECK (bonus_percent >= 0 AND bonus_percent <= 200),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coin_packs_public_select" ON public.coin_packs;
CREATE POLICY "coin_packs_public_select"
  ON public.coin_packs FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.coin_packs TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coin_packs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coin_packs TO service_role;

INSERT INTO public.coin_packs (slug, name, coins, price_fcfa, bonus_percent, sort_order)
VALUES
  ('starter', 'Starter', 100, 500, 0, 1),
  ('basic', 'Basic', 550, 2000, 10, 2),
  ('popular', 'Popular', 1300, 3500, 30, 3),
  ('pro', 'Pro', 3750, 7500, 50, 4),
  ('elite', 'Elite', 9000, 12000, 80, 5)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      coins = EXCLUDED.coins,
      price_fcfa = EXCLUDED.price_fcfa,
      bonus_percent = EXCLUDED.bonus_percent,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now();

-- Catalogue des cadeaux : prix et valeur reels, geres cote serveur.
ALTER TABLE public.virtual_gifts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.virtual_gifts
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

SELECT set_config('afrixa.financial_writer', 'on', true);

INSERT INTO public.virtual_gifts (name, emoji, price_coins, fcfa_value, animation, sort_order)
SELECT seed.name, seed.emoji, seed.price_coins, seed.fcfa_value, seed.animation, seed.sort_order
FROM (VALUES
  ('Rose', '🌹', 10, 50, 'rose-pop', 1),
  ('Coeur', '💜', 50, 250, 'heart-burst', 2),
  ('Diamant', '💎', 200, 1000, 'diamond-shine', 3),
  ('Lion', '🦁', 500, 2500, 'lion-roar', 4),
  ('Couronne', '👑', 1000, 5000, 'crown-glow', 5),
  ('Fusee', '🚀', 2000, 10000, 'rocket-launch', 6)
) AS seed(name, emoji, price_coins, fcfa_value, animation, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.virtual_gifts AS existing WHERE existing.name = seed.name
);

UPDATE public.virtual_gifts
SET sort_order = CASE name
    WHEN 'Rose' THEN 1
    WHEN 'Coeur' THEN 2
    WHEN 'Diamant' THEN 3
    WHEN 'Lion' THEN 4
    WHEN 'Couronne' THEN 5
    WHEN 'Fusee' THEN 6
    ELSE sort_order
  END
WHERE name IN ('Rose', 'Coeur', 'Diamant', 'Lion', 'Couronne', 'Fusee');

CREATE INDEX IF NOT EXISTS virtual_gifts_active_order_idx
  ON public.virtual_gifts(is_active, sort_order);

-- -----------------------------------------------------------------------------
-- 2. Achats de Coins
-- -----------------------------------------------------------------------------

ALTER TABLE public.coin_purchases
  ADD COLUMN IF NOT EXISTS fedapay_ref text,
  ADD COLUMN IF NOT EXISTS fedapay_transaction_id text,
  ADD COLUMN IF NOT EXISTS fedapay_response jsonb,
  ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES public.coin_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS coin_purchases_transaction_unique_idx
  ON public.coin_purchases(fedapay_transaction_id)
  WHERE fedapay_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coin_purchases_user_created_idx
  ON public.coin_purchases(user_id, created_at DESC);

-- Les remboursements apparaissent dans l'historique des coins.
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_type_check CHECK (
  type IN ('sent_gift', 'received_gift', 'sent_tip', 'received_tip', 'purchased', 'withdrawn', 'refunded')
);

GRANT SELECT ON public.coin_purchases, public.coin_transactions TO authenticated;

-- Ouverture d'une intention d'achat : reservee au serveur.
CREATE OR REPLACE FUNCTION public.start_coin_purchase(
  p_user_id uuid,
  p_pack_id uuid,
  p_operator text,
  p_phone text,
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pack public.coin_packs%ROWTYPE;
  v_operator text := nullif(btrim(coalesce(p_operator, '')), '');
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_purchase_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_pack_id IS NULL
    OR v_operator IS NULL
    OR length(v_phone_digits) < 8 OR length(v_phone_digits) > 15
    OR v_reference IS NULL OR length(v_reference) > 80 THEN
    RAISE EXCEPTION 'Parametres d''achat de coins invalides';
  END IF;

  SELECT * INTO v_pack FROM public.coin_packs WHERE id = p_pack_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pack de coins introuvable';
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  INSERT INTO public.coin_purchases (
    user_id, coins_amount, fcfa_paid, operator, fedapay_ref, pack_id, status
  ) VALUES (
    p_user_id, v_pack.coins, v_pack.price_fcfa, v_operator, v_reference, v_pack.id, 'pending'
  )
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'coins', v_pack.coins,
    'price_fcfa', v_pack.price_fcfa,
    'pack_name', v_pack.name,
    'reference', v_reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_coin_purchase(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_coin_purchase(uuid, uuid, text, text, text)
  TO service_role;

-- Rattachement de la transaction FedaPay a l'intention d'achat.
CREATE OR REPLACE FUNCTION public.attach_coin_purchase_transaction(
  p_purchase_id uuid,
  p_transaction_id text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase public.coin_purchases%ROWTYPE;
  v_transaction text := nullif(btrim(coalesce(p_transaction_id, '')), '');
BEGIN
  IF p_purchase_id IS NULL OR v_transaction IS NULL OR v_transaction !~ '^[0-9]{1,32}$' THEN
    RAISE EXCEPTION 'Transaction de paiement invalide';
  END IF;

  SELECT * INTO v_purchase FROM public.coin_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat de coins introuvable';
  END IF;
  IF v_purchase.fedapay_transaction_id IS NOT NULL
    AND v_purchase.fedapay_transaction_id <> v_transaction THEN
    RAISE EXCEPTION 'Transaction de paiement deja rattachee';
  END IF;
  IF v_purchase.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Achat de coins non modifiable';
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  UPDATE public.coin_purchases
  SET fedapay_transaction_id = v_transaction,
      fedapay_response = coalesce(p_provider_response, fedapay_response),
      status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END
  WHERE id = p_purchase_id;

  RETURN jsonb_build_object('purchase_id', p_purchase_id, 'transaction_id', v_transaction);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_coin_purchase_transaction(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_coin_purchase_transaction(uuid, text, jsonb)
  TO service_role;

-- Reglement d'un achat confirme par le fournisseur. Idempotent : le journal
-- financier porte la cle, un second appel ne credite rien.
CREATE OR REPLACE FUNCTION public.settle_coin_purchase(
  p_purchase_id uuid,
  p_transaction_id text,
  p_provider_reference text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase public.coin_purchases%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_transaction text := nullif(btrim(coalesce(p_transaction_id, '')), '');
  v_existing public.financial_ledger%ROWTYPE;
  v_balance integer;
BEGIN
  IF p_purchase_id IS NULL OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de reglement invalides';
  END IF;

  SELECT * INTO v_purchase FROM public.coin_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat de coins introuvable';
  END IF;
  IF v_purchase.status = 'completed' THEN
    RETURN jsonb_build_object('duplicate', true, 'coins', v_purchase.coins_amount);
  END IF;
  IF v_purchase.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Achat de coins non payable';
  END IF;
  IF v_transaction IS NOT NULL
    AND v_purchase.fedapay_transaction_id IS NOT NULL
    AND v_purchase.fedapay_transaction_id <> v_transaction THEN
    RAISE EXCEPTION 'Transaction de paiement incoherente';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  INSERT INTO public.coin_balances (user_id, balance, lifetime_earned)
  VALUES (v_purchase.user_id, v_purchase.coins_amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.coin_balances.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.afrixa_coins (user_id, balance, updated_at)
  VALUES (v_purchase.user_id, v_purchase.coins_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.afrixa_coins.balance + EXCLUDED.balance,
        updated_at = now();

  UPDATE public.coin_purchases
  SET status = 'completed',
      completed_at = now(),
      fedapay_transaction_id = coalesce(fedapay_transaction_id, v_transaction),
      fedapay_ref = coalesce(fedapay_ref, nullif(btrim(coalesce(p_provider_reference, '')), '')),
      failure_reason = NULL
  WHERE id = v_purchase.id;

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (v_purchase.user_id, 'purchased', v_purchase.coins_amount, v_purchase.id, 'Achat de coins');

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_purchase.user_id, 'coin_purchase', 'credit', v_purchase.coins_amount, 0, v_balance,
    'coin_purchase', v_purchase.id, v_key,
    jsonb_build_object(
      'fcfa_paid', v_purchase.fcfa_paid,
      'operator', v_purchase.operator,
      'provider_reference', p_provider_reference
    )
  );

  RETURN jsonb_build_object(
    'duplicate', false,
    'balance', v_balance,
    'coins', v_purchase.coins_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_coin_purchase(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_coin_purchase(uuid, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fail_coin_purchase(
  p_purchase_id uuid,
  p_reason text,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase public.coin_purchases%ROWTYPE;
BEGIN
  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Achat de coins introuvable';
  END IF;

  SELECT * INTO v_purchase FROM public.coin_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat de coins introuvable';
  END IF;
  IF v_purchase.status = 'completed' THEN
    RAISE EXCEPTION 'Un achat deja credite ne peut pas echouer';
  END IF;
  IF v_purchase.status IN ('failed', 'refunded') THEN
    RETURN jsonb_build_object('duplicate', true, 'status', v_purchase.status);
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  UPDATE public.coin_purchases
  SET status = 'failed',
      failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'paiement refuse'), 200),
      fedapay_transaction_id = coalesce(fedapay_transaction_id, nullif(btrim(coalesce(p_transaction_id, '')), ''))
  WHERE id = p_purchase_id;

  RETURN jsonb_build_object('duplicate', false, 'status', 'failed');
END;
$$;

REVOKE ALL ON FUNCTION public.fail_coin_purchase(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_coin_purchase(uuid, text, text)
  TO service_role;

-- Remboursement : debite les coins encore disponibles et garde la trace.
CREATE OR REPLACE FUNCTION public.refund_coin_purchase(
  p_purchase_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_purchase public.coin_purchases%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.financial_ledger%ROWTYPE;
  v_balance integer;
BEGIN
  IF p_purchase_id IS NULL OR v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de remboursement invalides';
  END IF;

  SELECT * INTO v_purchase FROM public.coin_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Achat de coins introuvable';
  END IF;
  IF v_purchase.status = 'refunded' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'refunded');
  END IF;
  IF v_purchase.status <> 'completed' THEN
    RAISE EXCEPTION 'Seul un achat credite peut etre rembourse';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_key));
  SELECT * INTO v_existing FROM public.financial_ledger WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object('duplicate', true, 'balance', coalesce(v_existing.balance_after, 0));
  END IF;

  PERFORM set_config('afrixa.financial_writer', 'on', true);

  UPDATE public.coin_balances
  SET balance = greatest(balance - v_purchase.coins_amount, 0),
      updated_at = now()
  WHERE user_id = v_purchase.user_id
  RETURNING balance INTO v_balance;

  UPDATE public.afrixa_coins
  SET balance = greatest(balance - v_purchase.coins_amount, 0),
      updated_at = now()
  WHERE user_id = v_purchase.user_id;

  UPDATE public.coin_purchases
  SET status = 'refunded'
  WHERE id = v_purchase.id;

  INSERT INTO public.coin_transactions (user_id, type, amount, reference_id, description)
  VALUES (v_purchase.user_id, 'refunded', -v_purchase.coins_amount, v_purchase.id, 'Remboursement de coins')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_purchase.user_id, 'refund', 'debit', -v_purchase.coins_amount, 0, coalesce(v_balance, 0),
    'coin_purchase', v_purchase.id, v_key,
    jsonb_build_object('reason', 'refund')
  );

  RETURN jsonb_build_object('duplicate', false, 'balance', coalesce(v_balance, 0), 'status', 'refunded');
END;
$$;

REVOKE ALL ON FUNCTION public.refund_coin_purchase(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_coin_purchase(uuid, text)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Envoi de cadeaux par un client
-- -----------------------------------------------------------------------------

-- L'expediteur vient toujours de auth.uid() : un client ne peut pas debiter
-- le solde d'un autre. Le destinataire d'un cadeau de live est l'hote.
CREATE OR REPLACE FUNCTION public.send_gift(
  p_gift_id uuid,
  p_live_id uuid DEFAULT NULL,
  p_receiver_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_receiver uuid := p_receiver_id;
  v_gift public.virtual_gifts%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_recent integer;
  v_result jsonb;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour envoyer un cadeau';
  END IF;
  IF v_key IS NULL OR length(v_key) > 120 THEN
    RAISE EXCEPTION 'Reference de cadeau invalide';
  END IF;

  IF p_live_id IS NOT NULL THEN
    SELECT host_id INTO v_receiver
    FROM public.live_sessions
    WHERE id = p_live_id AND status = 'live';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Live termine ou introuvable';
    END IF;
  END IF;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'Destinataire du cadeau manquant';
  END IF;
  IF v_receiver = v_sender THEN
    RAISE EXCEPTION 'Impossible de s''envoyer un cadeau';
  END IF;

  SELECT * INTO v_gift FROM public.virtual_gifts WHERE id = p_gift_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadeau introuvable';
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.gift_transactions
  WHERE sender_id = v_sender AND created_at > now() - interval '1 minute';
  IF v_recent >= 20 THEN
    RAISE EXCEPTION 'Trop de cadeaux envoyes, reessayez dans une minute';
  END IF;

  v_result := public.send_virtual_gift(v_sender, v_receiver, p_gift_id, p_live_id, v_key);

  RETURN v_result || jsonb_build_object(
    'gift_name', v_gift.name,
    'gift_emoji', v_gift.emoji,
    'coins_spent', v_gift.price_coins,
    'receiver_id', v_receiver
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_gift(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, text) TO authenticated;

-- Les cadeaux d'un live sont visibles par les participants du live (RLS du live
-- via can_view_live) pour alimenter l'animation en temps reel.
DROP POLICY IF EXISTS "gift_transactions_participants_select" ON public.gift_transactions;
DROP POLICY IF EXISTS "gift_transactions_visible" ON public.gift_transactions;
CREATE POLICY "gift_transactions_visible"
  ON public.gift_transactions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR (live_id IS NOT NULL AND public.can_view_live(live_id))
  );

-- Diffusion des cadeaux aux spectateurs du live.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_transactions;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END;
$$;

COMMENT ON TABLE public.coin_packs IS
  'Configuration serveur des packs de Coins : prix, bonus et ordre d affichage.';
COMMENT ON FUNCTION public.send_gift(uuid, uuid, uuid, text) IS
  'Envoi d un cadeau par le client connecte : debit du solde et credit createur atomiques.';
COMMENT ON FUNCTION public.settle_coin_purchase(uuid, text, text, text) IS
  'Credit des coins apres confirmation FedaPay, idempotent via le journal financier.';
