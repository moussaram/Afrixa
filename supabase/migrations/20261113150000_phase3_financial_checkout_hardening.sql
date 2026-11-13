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

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.checkout_idempotency FROM PUBLIC, anon, authenticated;

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
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g');
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
    OR p_operator IS NULL OR p_operator NOT IN ('orange_money', 'wave', 'mtn', 'moov')
    OR length(btrim(coalesce(p_delivery_address, ''))) < 5
    OR length(coalesce(p_buyer_note, '')) > 1000 THEN
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
  IF NOT coalesce(v_product.unlimited_stock, false)
    AND coalesce(v_product.stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant';
  END IF;
  IF v_product.price IS NULL OR v_product.price <= 0 THEN
    RAISE EXCEPTION 'Prix du produit invalide';
  END IF;

  v_rate := CASE WHEN coalesce(v_product.is_group_buy, false) THEN 0.03 ELSE 0.05 END;
  v_total := v_product.price::bigint * p_quantity;
  IF v_total > 2147483647 THEN
    RAISE EXCEPTION 'Montant de commande trop eleve';
  END IF;
  v_commission := round(v_total * v_rate);
  v_reference := 'AFR-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.orders (
    buyer_id, seller_id, product_id, product_name, product_image,
    quantity, unit_price, total_price, commission_rate, commission_amount,
    seller_amount, payment_operator, buyer_phone, delivery_address,
    delivery_lat, delivery_lng, buyer_note, status, payment_reference
  ) VALUES (
    v_buyer, v_product.seller_id, v_product.id, v_product.name, v_product.images[1],
    p_quantity, v_product.price, v_total::integer, v_rate, v_commission::integer,
    (v_total - v_commission)::integer, p_operator, v_phone, btrim(p_delivery_address),
    p_delivery_lat, p_delivery_lng, nullif(btrim(coalesce(p_buyer_note, '')), ''),
    'en_attente', v_reference
  )
  RETURNING * INTO v_order;

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
    'order_ref', v_reference,
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
