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
  IF p_transaction_id IS NULL OR p_provider_transaction_id !~ '^\d{1,32}$' THEN
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

  IF v_tx.status = 'successful' AND v_order.status IN ('payee', 'en_preparation', 'expediee', 'livree', 'terminee') THEN
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
