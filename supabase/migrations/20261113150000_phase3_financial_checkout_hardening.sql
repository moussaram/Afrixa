-- Phase 3: create order + payment intent atomically from trusted product data.
-- This migration is intentionally not applied to production by this workflow.

CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, idempotency_key)
);

-- One payment intent per order and one commission split per successful payment.
-- Existing production rows were checked for duplicates before adding these constraints.
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_order_id_unique
  ON public.payment_transactions(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS commission_splits_transaction_id_unique
  ON public.commission_splits(transaction_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reserved boolean NOT NULL DEFAULT false;

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_idempotency FROM PUBLIC, anon, authenticated;

-- Enforce server-derived checkout values even when an authenticated client
-- attempts to insert an order directly instead of using the checkout RPC.
CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  computed_total bigint;
BEGIN
  IF auth.role() = 'service_role' OR current_setting('afrixa.financial_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A buyer may only create their own order';
    END IF;
    IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 50 THEN
      RAISE EXCEPTION 'A valid product and quantity are required';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = NEW.product_id AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is unavailable';
    END IF;
    IF product_row.seller_id = NEW.buyer_id THEN
      RAISE EXCEPTION 'A seller cannot buy their own product';
    END IF;
    IF coalesce(product_row.is_group_buy, false) THEN
      RAISE EXCEPTION 'Group purchases are temporarily unavailable';
    END IF;
    IF NEW.payment_operator IS NULL OR NEW.payment_operator NOT IN (
      'mtn_open', 'moov', 'sbin', 'mtn_ci', 'moov_tg',
      'togocel', 'mtn_open_gn', 'free_sn', 'airtel_ne'
    ) THEN
      RAISE EXCEPTION 'Unsupported payment operator';
    END IF;
    IF NOT coalesce(product_row.unlimited_stock, false)
      AND coalesce(product_row.stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient product stock';
    END IF;

    NEW.seller_id := product_row.seller_id;
    NEW.product_name := product_row.name;
    NEW.product_image := product_row.images[1];
    NEW.unit_price := CASE
      WHEN product_row.promo_price IS NOT NULL
        AND product_row.promo_price > 0
        AND product_row.promo_price < product_row.price
        THEN product_row.promo_price
      ELSE product_row.price
    END;
    computed_total := NEW.unit_price::bigint * NEW.quantity;
    IF computed_total < 1 OR computed_total > 2147483647 THEN
      RAISE EXCEPTION 'Order total is outside supported limits';
    END IF;
    NEW.total_price := computed_total::integer;
    NEW.commission_rate := 0.05;
    NEW.commission_amount := round(computed_total * NEW.commission_rate)::integer;
    NEW.seller_amount := (computed_total - NEW.commission_amount)::integer;
    NEW.payment_reference := 'AFR-' || replace(gen_random_uuid()::text, '-', '');
    NEW.status := 'en_attente';
    NEW.escrow_released := false;
    IF coalesce(product_row.unlimited_stock, false) THEN
      NEW.stock_reserved := false;
    ELSE
      UPDATE public.products
      SET stock = coalesce(stock, 0) - NEW.quantity,
          updated_at = now()
      WHERE id = product_row.id;
      NEW.stock_reserved := true;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.product_name IS DISTINCT FROM OLD.product_name
    OR NEW.product_image IS DISTINCT FROM OLD.product_image
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
    OR NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
    OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
    OR NEW.seller_amount IS DISTINCT FROM OLD.seller_amount
    OR NEW.payment_operator IS DISTINCT FROM OLD.payment_operator
    OR NEW.buyer_phone IS DISTINCT FROM OLD.buyer_phone
    OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
    OR NEW.escrow_released IS DISTINCT FROM OLD.escrow_released
    OR NEW.stock_reserved IS DISTINCT FROM OLD.stock_reserved THEN
    RAISE EXCEPTION 'Checkout and escrow fields cannot be changed by a client';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'livree' AND OLD.status = 'expediee' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() = OLD.seller_id
      AND ((OLD.status = 'payee' AND NEW.status = 'en_preparation')
        OR (OLD.status = 'en_preparation' AND NEW.status = 'expediee')) THEN
      RETURN NEW;
    END IF;
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'litige'
      AND OLD.status IN ('payee', 'en_preparation', 'expediee', 'livree') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'This order status transition must be performed through the authorized flow';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_order_checkout_integrity ON public.orders;
CREATE TRIGGER a_order_checkout_integrity
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_checkout_integrity();

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique
  ON public.orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_order_payment_atomic(
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
  v_product public.products%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_tx public.payment_transactions%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_reference text;
  v_rate numeric;
  v_total bigint;
  v_commission bigint;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50
    OR v_key IS NULL OR length(v_key) > 120
    OR length(v_phone) < 8 OR length(v_phone) > 15
    OR p_operator IS NULL OR p_operator NOT IN (
      'mtn_open', 'moov', 'sbin', 'mtn_ci', 'moov_tg',
      'togocel', 'mtn_open_gn', 'free_sn', 'airtel_ne'
    )
    OR length(btrim(coalesce(p_delivery_address, ''))) < 5
    OR length(btrim(coalesce(p_delivery_address, ''))) > 500
    OR length(coalesce(p_buyer_note, '')) > 1000
    OR ((p_delivery_lat IS NULL) <> (p_delivery_lng IS NULL))
    OR (p_delivery_lat IS NOT NULL AND (p_delivery_lat < -90 OR p_delivery_lat > 90))
    OR (p_delivery_lng IS NOT NULL AND (p_delivery_lng < -180 OR p_delivery_lng > 180)) THEN
    RAISE EXCEPTION 'Parametres de commande invalides';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_buyer::text || ':' || v_key, 0));

  SELECT existing_order.* INTO v_order
  FROM public.orders AS existing_order
  JOIN public.checkout_idempotency AS idem ON idem.order_id = existing_order.id
  WHERE idem.buyer_id = v_buyer AND idem.idempotency_key = v_key
  FOR UPDATE OF existing_order;

  IF FOUND THEN
    SELECT * INTO v_tx FROM public.payment_transactions WHERE order_id = v_order.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Intent de paiement existant incomplet';
    END IF;
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_ref', v_order.payment_reference,
      'total_price', v_order.total_price,
      'transaction_id', v_tx.id,
      'reused', true
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
    RAISE EXCEPTION 'Impossible d acheter son propre produit';
  END IF;
  IF coalesce(v_product.is_group_buy, false) THEN
    RAISE EXCEPTION 'Les achats groupes sont temporairement indisponibles';
  END IF;
  IF NOT coalesce(v_product.unlimited_stock, false)
    AND coalesce(v_product.stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant';
  END IF;
  IF v_product.price IS NULL OR v_product.price <= 0 THEN
    RAISE EXCEPTION 'Prix du produit invalide';
  END IF;

  v_rate := 0.05;
  v_total := CASE
    WHEN v_product.promo_price IS NOT NULL
      AND v_product.promo_price > 0
      AND v_product.promo_price < v_product.price
      THEN v_product.promo_price::bigint
    ELSE v_product.price::bigint
  END * p_quantity;
  IF v_total > 2147483647 THEN
    RAISE EXCEPTION 'Montant de commande trop eleve';
  END IF;
  v_commission := round(v_total * v_rate);
  v_reference := 'AFR-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.orders (
    buyer_id, seller_id, product_id, product_name, product_image,
    quantity, unit_price, total_price, commission_rate, commission_amount,
    seller_amount, payment_operator, buyer_phone, delivery_address,
    delivery_lat, delivery_lng, buyer_note, status, payment_reference, stock_reserved
  ) VALUES (
    v_buyer, v_product.seller_id, v_product.id, v_product.name, v_product.images[1],
    p_quantity,
    CASE WHEN v_product.promo_price IS NOT NULL AND v_product.promo_price > 0
      AND v_product.promo_price < v_product.price THEN v_product.promo_price ELSE v_product.price END,
    v_total::integer, v_rate, v_commission::integer,
    (v_total - v_commission)::integer, p_operator, v_phone, btrim(p_delivery_address),
    p_delivery_lat, p_delivery_lng, nullif(btrim(coalesce(p_buyer_note, '')), ''),
    'en_attente', v_reference, NOT coalesce(v_product.unlimited_stock, false)
  )
  RETURNING * INTO v_order;

  IF NOT coalesce(v_product.unlimited_stock, false) THEN
    UPDATE public.products
    SET stock = stock - p_quantity, updated_at = now()
    WHERE id = v_product.id AND stock >= p_quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant';
    END IF;
  END IF;

  INSERT INTO public.payment_transactions (
    order_id, fedapay_ref, amount, commission_amount, seller_amount,
    currency, operator, buyer_phone, status, escrow_status
  ) VALUES (
    v_order.id, v_reference, v_order.total_price, v_order.commission_amount,
    v_order.seller_amount, 'XOF', p_operator, v_phone, 'initiated', 'held'
  )
  RETURNING * INTO v_tx;

  INSERT INTO public.checkout_idempotency (buyer_id, idempotency_key, order_id)
  VALUES (v_buyer, v_key, v_order.id);

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_ref', v_order.payment_reference,
    'total_price', v_order.total_price,
    'transaction_id', v_tx.id,
    'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, text
) TO authenticated;

COMMENT ON FUNCTION public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, text
) IS 'Creates an order and its FedaPay intent atomically; product price, seller, image and commission are read from the database.';


-- Serialize creator withdrawals per account. This closes the race where two
-- concurrent requests both pass the pending/daily-limit checks before either
-- reservation is inserted, and preserves idempotent retries.
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
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_balance integer;
  v_pending integer;
  v_today integer;
  v_result jsonb;
  v_existing public.financial_ledger%ROWTYPE;
  v_existing_status text;
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

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':creator-withdrawal', 0));

  SELECT * INTO v_existing
  FROM public.financial_ledger
  WHERE idempotency_key = v_key
    AND reference_type = 'seller_payout';
  IF FOUND THEN
    SELECT status INTO v_existing_status
    FROM public.seller_payouts
    WHERE id = v_existing.reference_id;
    RETURN jsonb_build_object(
      'duplicate', true,
      'payout_id', v_existing.reference_id,
      'balance', v_existing.balance_after,
      'status', coalesce(v_existing_status, 'demande')
    );
  END IF;

  SELECT * INTO v_settings FROM public.monetization_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reglages monetaires indisponibles';
  END IF;
  IF p_amount < v_settings.min_withdrawal_fcfa THEN
    RAISE EXCEPTION 'Le retrait minimum est de % FCFA', v_settings.min_withdrawal_fcfa;
  END IF;

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
  WHERE seller_id = v_user
    AND created_at >= date_trunc('day', now());
  IF v_today >= v_settings.withdrawal_daily_limit THEN
    RAISE EXCEPTION 'Limite quotidienne de retraits atteinte';
  END IF;

  v_result := public.request_creator_withdrawal(
    v_user, p_amount, v_operator, btrim(p_phone), v_key
  );

  IF coalesce((v_result ->> 'duplicate')::boolean, false) IS FALSE THEN
    PERFORM set_config('afrixa.financial_writer', 'on', true);
    UPDATE public.seller_payouts
    SET payout_reference = 'AFR-WD-' || replace((v_result ->> 'payout_id'), '-', '')
    WHERE id = (v_result ->> 'payout_id')::uuid
      AND payout_reference IS NULL;
  END IF;

  RETURN v_result || jsonb_build_object(
    'status', coalesce(v_result ->> 'status', 'demande')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_my_withdrawal(integer, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_my_withdrawal(integer, text, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.request_my_withdrawal(integer, text, text, text) IS
  'Retrait createur atomique, idempotent et serialise par compte; applique le solde, le plafond quotidien et la limite de retrait en cours.';


-- Finalize a marketplace payment atomically and idempotently after verifying FedaPay server-side.
CREATE UNIQUE INDEX IF NOT EXISTS commission_splits_transaction_id_uidx
  ON public.commission_splits (transaction_id);

CREATE OR REPLACE FUNCTION public.settle_order_payment(
  p_transaction_id uuid,
  p_provider_response jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_type text;
BEGIN
  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction introuvable'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND OR v_order.total_price <> v_tx.amount THEN
    RAISE EXCEPTION 'Commande et transaction incoherentes';
  END IF;
  IF v_tx.status = 'successful' THEN RETURN false; END IF;
  IF v_tx.status NOT IN ('initiated', 'creating', 'pending') THEN
    RAISE EXCEPTION 'Transaction non payable';
  END IF;
  IF v_order.status NOT IN ('en_attente', 'payee') THEN
    RAISE EXCEPTION 'Commande non payable';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'successful', fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id;

  UPDATE public.orders
  SET status = 'payee', stock_reserved = false, updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  v_type := CASE
    WHEN v_order.commission_rate = 0.03 THEN 'group_buy'
    WHEN v_order.commission_rate = 0.07 THEN 'booste'
    WHEN v_order.commission_rate = 0.08 THEN 'live'
    ELSE 'normale'
  END;

  INSERT INTO public.commission_splits (
    transaction_id, afrixa_amount, seller_amount, split_type, split_rate, status
  ) VALUES (
    v_tx.id, v_tx.commission_amount, v_tx.seller_amount, v_type, v_order.commission_rate, 'pending'
  )
  ON CONFLICT (transaction_id) DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_order_payment(
  p_transaction_id uuid,
  p_final_status text,
  p_provider_response jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_final_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Statut final invalide';
  END IF;

  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction introuvable'; END IF;
  IF v_tx.status IN ('failed', 'cancelled') THEN RETURN false; END IF;
  IF v_tx.status NOT IN ('initiated', 'creating', 'pending') THEN
    RAISE EXCEPTION 'Transaction non annulable';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_tx.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  UPDATE public.payment_transactions
  SET status = p_final_status, fedapay_response = p_provider_response, updated_at = now()
  WHERE id = v_tx.id;

  IF v_order.stock_reserved AND v_order.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock + v_order.quantity, updated_at = now()
    WHERE id = v_order.product_id;
  END IF;

  UPDATE public.orders
  SET status = 'annulee', stock_reserved = false, updated_at = now()
  WHERE id = v_order.id AND status = 'en_attente';

  RETURN true;
END;
$$;

-- FedaPay refunds are performed manually in its merchant dashboard.
-- This function only reconciles a refund after the provider's authoritative
-- transaction status has changed to "refunded"; it never initiates a refund.
CREATE TABLE IF NOT EXISTS public.payment_refund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.payment_transactions(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  transaction_amount integer NOT NULL CHECK (transaction_amount > 0),
  refund_amount integer CHECK (refund_amount > 0),
  status text NOT NULL CHECK (status IN ('recorded', 'manual_reconciliation_required')),
  provider_response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_refund_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_refund_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_refund_events TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_fedapay_refund(
  p_transaction_id uuid,
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
  v_existing public.payment_refund_events%ROWTYPE;
  v_refund_text text;
  v_refund_amount integer;
  v_manual boolean;
  v_provider_status text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Remboursement reserve au serveur';
  END IF;
  IF p_transaction_id IS NULL OR p_provider_response IS NULL THEN
    RAISE EXCEPTION 'Evenement de remboursement invalide';
  END IF;

  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction introuvable'; END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_tx.order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;

  SELECT * INTO v_existing
  FROM public.payment_refund_events
  WHERE transaction_id = v_tx.id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'duplicate', true,
      'status', v_existing.status,
      'manual_reconciliation_required', v_existing.status = 'manual_reconciliation_required'
    );
  END IF;

  v_provider_status := lower(coalesce(
    p_provider_response #>> '{data,status}',
    p_provider_response #>> '{transaction,status}',
    p_provider_response #>> '{v1/transaction,status}',
    p_provider_response ->> 'status',
    ''
  ));
  IF v_provider_status <> 'refunded' THEN
    RAISE EXCEPTION 'FedaPay ne confirme pas le remboursement';
  END IF;
  IF v_tx.status <> 'successful' THEN
    RAISE EXCEPTION 'Seul un paiement confirme peut etre rapproche comme rembourse';
  END IF;

  v_refund_text := coalesce(
    p_provider_response #>> '{data,refund_amount}',
    p_provider_response #>> '{data,refunded_amount}',
    p_provider_response #>> '{transaction,refund_amount}',
    p_provider_response #>> '{v1/transaction,refund_amount}',
    p_provider_response ->> 'refund_amount'
  );
  IF v_refund_text ~ '^[0-9]+
REVOKE ALL ON FUNCTION public.fail_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_order_payment(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_order_payment(uuid, text, jsonb) TO service_role;
 THEN
    v_refund_amount := v_refund_text::integer;
  END IF;

  SELECT
    coalesce(v_order.escrow_released, false)
    OR EXISTS (
      SELECT 1 FROM public.seller_payouts AS payout
      WHERE payout.order_id = v_order.id
        AND payout.status IN ('demande', 'processing', 'envoye')
    )
    OR EXISTS (
      SELECT 1 FROM public.commission_splits AS split
      WHERE split.transaction_id = v_tx.id AND split.status = 'percue'
    )
  INTO v_manual;

  v_manual := coalesce(v_manual, false)
    OR v_refund_amount IS NULL
    OR v_refund_amount <> v_tx.amount;

  INSERT INTO public.payment_refund_events (
    transaction_id, order_id, transaction_amount, refund_amount,
    status, provider_response
  ) VALUES (
    v_tx.id, v_order.id, v_tx.amount, v_refund_amount,
    CASE WHEN v_manual THEN 'manual_reconciliation_required' ELSE 'recorded' END,
    p_provider_response
  );

  UPDATE public.payment_transactions
  SET status = 'refunded',
      escrow_status = 'refunded',
      fedapay_response = p_provider_response,
      updated_at = now()
  WHERE id = v_tx.id;

  IF v_manual THEN
    UPDATE public.orders
    SET dispute_reason = concat_ws(
      E'\\n',
      nullif(dispute_reason, ''),
      'Remboursement FedaPay confirmé : rapprochement manuel vendeur/Afrixa requis.'
    ),
    updated_at = now()
    WHERE id = v_order.id;
  ELSE
    UPDATE public.orders
    SET status = 'remboursee',
        escrow_released = false,
        stock_reserved = false,
        updated_at = now()
    WHERE id = v_order.id;

    UPDATE public.commission_splits
    SET status = 'remboursee'
    WHERE transaction_id = v_tx.id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'status', CASE WHEN v_manual THEN 'manual_reconciliation_required' ELSE 'recorded' END,
    'manual_reconciliation_required', v_manual,
    'refund_amount', v_refund_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_fedapay_refund(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_fedapay_refund(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.settle_order_payment(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_order_payment(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_order_payment(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_order_payment(uuid, text, jsonb) TO service_role;
