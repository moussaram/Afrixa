-- Phase 3 — checkout serveur et transitions financieres atomiques.
-- Aucun changement n'est applique a la base de production par cette migration.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_unique
  ON public.orders (buyer_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commission_splits_transaction_unique
  ON public.commission_splits (transaction_id);

CREATE OR REPLACE FUNCTION public.create_my_order_payment(
  p_product_id uuid,
  p_quantity integer,
  p_operator text,
  p_phone text,
  p_delivery_address text,
  p_buyer_note text DEFAULT NULL,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buyer uuid := auth.uid();
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_product public.products%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_unit_price integer;
  v_total bigint;
  v_rate double precision;
  v_commission integer;
  v_seller_amount integer;
  v_reference text;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100
    OR v_key IS NULL OR length(v_key) > 120
    OR nullif(btrim(coalesce(p_operator, '')), '') IS NULL
    OR length(coalesce(p_operator, '')) > 40
    OR p_phone IS NULL OR length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) NOT BETWEEN 8 AND 15
    OR length(coalesce(p_delivery_address, '')) < 5
    OR length(coalesce(p_delivery_address, '')) > 500
    OR (p_delivery_lat IS NULL) <> (p_delivery_lng IS NULL)
    OR (p_delivery_lat IS NOT NULL AND (p_delivery_lat NOT BETWEEN -90 AND 90 OR p_delivery_lng NOT BETWEEN -180 AND 180))
    OR length(coalesce(p_buyer_note, '')) > 1000 THEN
    RAISE EXCEPTION 'Parametres de commande invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_buyer::text || ':' || v_key));

  SELECT * INTO v_order
  FROM public.orders
  WHERE buyer_id = v_buyer AND checkout_idempotency_key = v_key
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_reference', v_order.payment_reference,
      'amount', v_order.total_price,
      'commission_amount', v_order.commission_amount,
      'seller_amount', v_order.seller_amount,
      'duplicate', true
    );
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit indisponible';
  END IF;
  IF v_product.seller_id = v_buyer THEN
    RAISE EXCEPTION 'Impossible d''acheter son propre produit';
  END IF;
  IF NOT coalesce(v_product.unlimited_stock, false)
    AND coalesce(v_product.stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant';
  END IF;

  -- Le trigger historique de commande utilise products.price comme prix de reference.
  v_unit_price := v_product.price;
  v_total := v_unit_price * p_quantity;
  IF v_total <= 0 OR v_total > 2000000000 THEN
    RAISE EXCEPTION 'Montant de commande invalide';
  END IF;

  v_rate := CASE WHEN coalesce(v_product.is_group_buy, false) THEN 0.03 ELSE 0.05 END;
  v_commission := round(v_total * v_rate)::integer;
  v_seller_amount := v_total - v_commission;
  v_reference := 'AFR-' || upper(replace(gen_random_uuid()::text, '-', ''));

  INSERT INTO public.orders (
    buyer_id, seller_id, product_id, product_name, product_image,
    quantity, unit_price, total_price, commission_rate, commission_amount,
    seller_amount, payment_operator, buyer_phone, delivery_address,
    delivery_lat, delivery_lng, buyer_note, status, escrow_released,
    payment_reference, checkout_idempotency_key
  ) VALUES (
    v_buyer, v_product.seller_id, v_product.id, v_product.name,
    v_product.images[1], p_quantity, v_unit_price, v_total, v_rate,
    v_commission, v_seller_amount, p_operator,
    regexp_replace(p_phone, '\D', '', 'g'), btrim(p_delivery_address),
    p_delivery_lat, p_delivery_lng, nullif(btrim(coalesce(p_buyer_note, '')), ''),
    'en_attente', false, v_reference, v_key
  )
  RETURNING * INTO v_order;

  INSERT INTO public.payment_transactions (
    order_id, fedapay_ref, amount, commission_amount, seller_amount,
    currency, operator, buyer_phone, status, escrow_status
  ) VALUES (
    v_order.id, v_reference, v_total, v_commission, v_seller_amount,
    'XOF', p_operator, regexp_replace(p_phone, '\D', '', 'g'),
    'initiated', 'held'
  );

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_reference', v_reference,
    'amount', v_total,
    'commission_amount', v_commission,
    'seller_amount', v_seller_amount,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_order_payment(uuid, integer, text, text, text, text, double precision, double precision, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_order_payment(uuid, integer, text, text, text, text, double precision, double precision, text)
  TO authenticated;

-- Une seule transition de paiement peut confirmer commande, transaction et commission.
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_transaction_id uuid,
  p_provider_transaction_id text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_rate double precision;
  v_type text;
  v_duplicate boolean := false;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operation reservee au serveur';
  END IF;
  IF p_transaction_id IS NULL OR p_provider_transaction_id IS NULL OR p_provider_transaction_id !~ '^\d{1,32}
    RAISE EXCEPTION 'Reference de paiement invalide';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.fedapay_transaction_id IS DISTINCT FROM p_provider_transaction_id THEN
    RAISE EXCEPTION 'Transaction de paiement introuvable';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND OR v_order.total_price <> v_tx.amount
    OR v_order.commission_amount <> v_tx.commission_amount
    OR v_order.seller_amount <> v_tx.seller_amount
    OR v_order.total_price <> v_order.commission_amount + v_order.seller_amount
    OR v_tx.currency <> 'XOF' THEN
    RAISE EXCEPTION 'Incoherence des montants de paiement';
  END IF;

  IF v_tx.status = 'successful' AND v_order.status IN ('payee', 'en_preparation', 'expediee', 'livree', 'terminee', 'litige') THEN
    v_duplicate := true;
  ELSIF v_tx.status NOT IN ('initiated', 'creating', 'pending')
    OR v_order.status <> 'en_attente' THEN
    RAISE EXCEPTION 'Transition de paiement interdite';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'successful', fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id AND status IN ('initiated', 'creating', 'pending');

  UPDATE public.orders
  SET status = 'payee', updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  v_rate := v_order.commission_rate;
  v_type := CASE v_rate
    WHEN 0.03 THEN 'group_buy'
    WHEN 0.07 THEN 'booste'
    WHEN 0.08 THEN 'live'
    ELSE 'normale'
  END;

  INSERT INTO public.commission_splits (
    transaction_id, afrixa_amount, seller_amount, split_type, split_rate, status
  ) VALUES (
    v_tx.id, v_tx.commission_amount, v_tx.seller_amount, v_type, v_rate, 'pending'
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN jsonb_build_object('verified', true, 'order_id', v_order.id, 'duplicate', v_duplicate);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_order_payment(
  p_transaction_id uuid,
  p_final_status text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operation reservee au serveur';
  END IF;
  IF p_transaction_id IS NULL OR p_final_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Statut de paiement invalide';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction introuvable';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  IF v_tx.status IN ('failed', 'cancelled') THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;
  IF v_tx.status NOT IN ('initiated', 'creating', 'pending') OR v_order.status <> 'en_attente' THEN
    RAISE EXCEPTION 'Un paiement confirme ne peut pas etre annule par cet evenement';
  END IF;

  UPDATE public.payment_transactions
  SET status = p_final_status, fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id;

  UPDATE public.orders
  SET status = 'annulee', updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  RETURN jsonb_build_object('processed', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_order_payment(uuid, text, jsonb) TO service_role;
 THEN
    RAISE EXCEPTION 'Reference de paiement invalide';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_tx.fedapay_transaction_id IS DISTINCT FROM p_provider_transaction_id THEN
    RAISE EXCEPTION 'Transaction de paiement introuvable';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND OR v_order.total_price <> v_tx.amount
    OR v_order.commission_amount <> v_tx.commission_amount
    OR v_order.seller_amount <> v_tx.seller_amount
    OR v_order.total_price <> v_order.commission_amount + v_order.seller_amount
    OR v_tx.currency <> 'XOF' THEN
    RAISE EXCEPTION 'Incoherence des montants de paiement';
  END IF;

  IF v_tx.status = 'successful' AND v_order.status IN ('payee', 'en_preparation', 'expediee', 'livree', 'terminee', 'litige') THEN
    v_duplicate := true;
  ELSIF v_tx.status NOT IN ('initiated', 'creating', 'pending')
    OR v_order.status <> 'en_attente' THEN
    RAISE EXCEPTION 'Transition de paiement interdite';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'successful', fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id AND status IN ('initiated', 'creating', 'pending');

  UPDATE public.orders
  SET status = 'payee', updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  v_rate := v_order.commission_rate;
  v_type := CASE v_rate
    WHEN 0.03 THEN 'group_buy'
    WHEN 0.07 THEN 'booste'
    WHEN 0.08 THEN 'live'
    ELSE 'normale'
  END;

  INSERT INTO public.commission_splits (
    transaction_id, afrixa_amount, seller_amount, split_type, split_rate, status
  ) VALUES (
    v_tx.id, v_tx.commission_amount, v_tx.seller_amount, v_type, v_rate, 'pending'
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN jsonb_build_object('verified', true, 'order_id', v_order.id, 'duplicate', v_duplicate);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_order_payment(
  p_transaction_id uuid,
  p_final_status text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operation reservee au serveur';
  END IF;
  IF p_transaction_id IS NULL OR p_final_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Statut de paiement invalide';
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions
  WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction introuvable';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  IF v_tx.status IN ('failed', 'cancelled') THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;
  IF v_tx.status NOT IN ('initiated', 'creating', 'pending') OR v_order.status <> 'en_attente' THEN
    RAISE EXCEPTION 'Un paiement confirme ne peut pas etre annule par cet evenement';
  END IF;

  UPDATE public.payment_transactions
  SET status = p_final_status, fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id;

  UPDATE public.orders
  SET status = 'annulee', updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  RETURN jsonb_build_object('processed', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_order_payment(uuid, text, jsonb) TO service_role;


-- FIN-05 : idempotence du retrait avant controles de solde et verrouillage du wallet.
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
  v_client_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_key text;
  v_existing public.financial_ledger%ROWTYPE;
  v_payout public.seller_payouts%ROWTYPE;
  v_balance integer;
  v_pending integer;
  v_today integer;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour retirer';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR v_operator IS NULL
    OR length(v_phone_digits) < 8 OR length(v_phone_digits) > 15
    OR v_client_key IS NULL OR length(v_client_key) > 120 THEN
    RAISE EXCEPTION 'Parametres de retrait invalides';
  END IF;

  -- La cle est scellee par utilisateur pour eviter les collisions entre comptes.
  v_key := 'withdrawal:' || md5(v_user::text || ':' || v_client_key);
  PERFORM pg_advisory_xact_lock(hashtext(v_key));

  SELECT * INTO v_existing
  FROM public.financial_ledger
  WHERE user_id = v_user AND idempotency_key = v_key;
  IF FOUND THEN
    SELECT * INTO v_payout
    FROM public.seller_payouts
    WHERE id = v_existing.reference_id;
    IF NOT FOUND OR v_payout.amount <> p_amount
      OR v_payout.operator IS DISTINCT FROM v_operator
      OR regexp_replace(coalesce(v_payout.phone, ''), '\D', '', 'g') <> v_phone_digits THEN
      RAISE EXCEPTION 'Cle de retrait deja utilisee avec des parametres differents';
    END IF;
    RETURN jsonb_build_object(
      'duplicate', true,
      'payout_id', v_payout.id,
      'balance', coalesce(v_existing.balance_after, 0),
      'status', v_payout.status
    );
  END IF;

  SELECT * INTO v_settings FROM public.monetization_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reglages monetaires indisponibles';
  END IF;
  IF p_amount < v_settings.min_withdrawal_fcfa THEN
    RAISE EXCEPTION 'Le retrait minimum est de % FCFA', v_settings.min_withdrawal_fcfa;
  END IF;

  -- Ce verrou serialise les demandes concurrentes du meme createur.
  SELECT balance INTO v_balance
  FROM public.creator_wallet
  WHERE user_id = v_user
  FOR UPDATE;
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

-- FIN-05 : le webhook de versement ajoute une preuve comptable de reglement.
ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_amount_present;
ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_amount_present
  CHECK (coins_delta <> 0 OR fcfa_delta <> 0 OR operation = 'withdrawal_paid');

CREATE OR REPLACE FUNCTION public.complete_creator_withdrawal(
  p_payout_id uuid,
  p_provider_transaction_id text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payout public.seller_payouts%ROWTYPE;
  v_balance integer;
  v_key text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operation reservee au serveur';
  END IF;
  IF p_payout_id IS NULL OR p_provider_transaction_id IS NULL
    OR p_provider_transaction_id !~ '^\d{1,32}$' THEN
    RAISE EXCEPTION 'Reference de versement invalide';
  END IF;

  SELECT * INTO v_payout
  FROM public.seller_payouts
  WHERE id = p_payout_id AND order_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retrait createur introuvable';
  END IF;
  IF v_payout.fedapay_transfer_id IS DISTINCT FROM p_provider_transaction_id THEN
    RAISE EXCEPTION 'Reference FedaPay differente du retrait';
  END IF;
  IF v_payout.status = 'envoye' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'envoye');
  END IF;
  IF v_payout.status NOT IN ('demande', 'processing') THEN
    RAISE EXCEPTION 'Ce retrait ne peut pas etre confirme';
  END IF;

  UPDATE public.seller_payouts
  SET status = 'envoye', fedapay_response = p_provider_response
  WHERE id = v_payout.id;

  SELECT balance INTO v_balance
  FROM public.creator_wallet
  WHERE user_id = v_payout.seller_id;

  v_key := 'withdrawal-paid:' || v_payout.id::text;
  INSERT INTO public.financial_ledger (
    user_id, operation, direction, coins_delta, fcfa_delta, balance_after,
    reference_type, reference_id, idempotency_key, metadata
  ) VALUES (
    v_payout.seller_id, 'withdrawal_paid', 'debit', 0, 0, coalesce(v_balance, 0),
    'seller_payout', v_payout.id, v_key,
    jsonb_build_object('amount', v_payout.amount, 'provider_transaction_id', p_provider_transaction_id)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN jsonb_build_object('duplicate', false, 'status', 'envoye', 'balance', coalesce(v_balance, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.complete_creator_withdrawal(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_creator_withdrawal(uuid, text, jsonb) TO service_role;
