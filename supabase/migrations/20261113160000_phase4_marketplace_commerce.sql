-- Phase 4: marketplace commerce foundations.
-- This migration is not applied to production by the code workflow.

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  price integer,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_name_length CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT product_variants_price_positive CHECK (price IS NULL OR price > 0)
);

CREATE INDEX IF NOT EXISTS product_variants_product_active_idx
  ON public.product_variants(product_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_product_sku_unique
  ON public.product_variants(product_id, sku) WHERE sku IS NOT NULL;

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_variants_public_read ON public.product_variants;
CREATE POLICY product_variants_public_read
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS product_variants_owner_insert ON public.product_variants;
CREATE POLICY product_variants_owner_insert
  ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  );
DROP POLICY IF EXISTS product_variants_owner_update ON public.product_variants;
CREATE POLICY product_variants_owner_update
  ON public.product_variants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
DROP POLICY IF EXISTS product_variants_owner_delete ON public.product_variants;
CREATE POLICY product_variants_owner_delete
  ON public.product_variants FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_buyer_product_no_variant_unique
  ON public.cart_items(buyer_id, product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_buyer_product_variant_unique
  ON public.cart_items(buyer_id, product_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cart_items_buyer_updated_idx
  ON public.cart_items(buyer_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cart_items_owner_select ON public.cart_items;
CREATE POLICY cart_items_owner_select ON public.cart_items
  FOR SELECT TO authenticated USING (buyer_id = auth.uid());
DROP POLICY IF EXISTS cart_items_owner_insert ON public.cart_items;
CREATE POLICY cart_items_owner_insert ON public.cart_items
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
DROP POLICY IF EXISTS cart_items_owner_update ON public.cart_items;
CREATE POLICY cart_items_owner_update ON public.cart_items
  FOR UPDATE TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());
DROP POLICY IF EXISTS cart_items_owner_delete ON public.cart_items;
CREATE POLICY cart_items_owner_delete ON public.cart_items
  FOR DELETE TO authenticated USING (buyer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_cart_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Panier utilisateur invalide';
  END IF;
  SELECT * INTO v_product FROM public.products
  WHERE id = NEW.product_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit indisponible'; END IF;
  IF NEW.variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants
    WHERE id = NEW.variant_id AND product_id = NEW.product_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible'; END IF;
    IF NOT coalesce(v_product.unlimited_stock, false) AND v_variant.stock < NEW.quantity THEN
      RAISE EXCEPTION 'Stock de la variante insuffisant';
    END IF;
  ELSIF NOT coalesce(v_product.unlimited_stock, false)
    AND coalesce(v_product.stock, 0) < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuffisant';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cart_item_before_write ON public.cart_items;
CREATE TRIGGER validate_cart_item_before_write
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_cart_item();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.dispute_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('opened', 'seller_response', 'admin_decision', 'appeal', 'status_changed')),
  message text,
  evidence_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispute_events_dispute_created_idx
  ON public.dispute_events(dispute_id, created_at);
ALTER TABLE public.dispute_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispute_events_participant_read ON public.dispute_events;
CREATE POLICY dispute_events_participant_read ON public.dispute_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.id = dispute_id AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
  ));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dispute_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dispute_events TO authenticated;

-- Only the buyer can confirm delivery, and only after a verified successful payment.
CREATE OR REPLACE FUNCTION public.confirm_order_received(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.buyer_id <> v_user THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status = 'livree' OR v_order.status = 'terminee' THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'status', v_order.status);
  END IF;
  IF v_order.status <> 'expediee' THEN RAISE EXCEPTION 'La commande ne peut pas encore être confirmée'; END IF;
  SELECT * INTO v_payment FROM public.payment_transactions
  WHERE order_id = p_order_id AND status = 'successful' FOR UPDATE;
  IF NOT FOUND OR v_payment.escrow_status <> 'held' THEN
    RAISE EXCEPTION 'Paiement vérifié ou séquestre indisponible';
  END IF;
  UPDATE public.orders SET status = 'livree' WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'duplicate', false, 'status', 'livree', 'escrow_status', 'held');
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_order_received(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_received(uuid) TO authenticated;

-- A dispute is created atomically with the order status transition and its audit event.
CREATE OR REPLACE FUNCTION public.open_order_dispute(
  p_order_id uuid,
  p_reason text,
  p_description text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_dispute public.disputes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 120
    OR length(coalesce(p_description, '')) > 3000
    OR length(coalesce(p_evidence_url, '')) > 1000 THEN
    RAISE EXCEPTION 'Informations de litige invalides';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.buyer_id <> v_user THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.status NOT IN ('payee', 'en_preparation', 'expediee', 'livree') THEN
    RAISE EXCEPTION 'Cette commande ne peut pas faire l’objet d’un litige';
  END IF;
  SELECT * INTO v_dispute FROM public.disputes
  WHERE order_id = p_order_id AND status NOT IN ('resolu', 'rejete', 'ferme')
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'dispute_id', v_dispute.id);
  END IF;

  INSERT INTO public.disputes (order_id, buyer_id, seller_id, reason, buyer_evidence, status)
  VALUES (
    p_order_id, v_user, v_order.seller_id, btrim(p_reason),
    nullif(concat_ws(E'\n', nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_evidence_url, '')), '')), ''),
    'ouvert'
  ) RETURNING * INTO v_dispute;

  INSERT INTO public.dispute_events (dispute_id, actor_id, event_type, message, evidence_url)
  VALUES (v_dispute.id, v_user, 'opened', nullif(btrim(coalesce(p_description, '')), ''), nullif(btrim(coalesce(p_evidence_url, '')), ''));

  UPDATE public.orders SET status = 'litige', dispute_reason = btrim(p_reason) WHERE id = p_order_id;
  RETURN jsonb_build_object('success', true, 'duplicate', false, 'dispute_id', v_dispute.id);
END;
$$;
REVOKE ALL ON FUNCTION public.open_order_dispute(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_order_dispute(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_order_dispute_response(
  p_dispute_id uuid,
  p_message text,
  p_evidence_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dispute public.disputes%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF length(btrim(coalesce(p_message, ''))) < 2
    OR length(coalesce(p_evidence_url, '')) > 1000 THEN
    RAISE EXCEPTION 'Réponse invalide';
  END IF;
  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND OR v_dispute.seller_id <> v_user THEN RAISE EXCEPTION 'Litige introuvable'; END IF;
  IF v_dispute.status NOT IN ('ouvert', 'en_examen', 'reponse_vendeur') THEN
    RAISE EXCEPTION 'Ce litige est clôturé';
  END IF;
  UPDATE public.disputes
  SET seller_evidence = concat_ws(E'\n', nullif(seller_evidence, ''), btrim(p_message), nullif(btrim(coalesce(p_evidence_url, '')), '')),
      status = 'reponse_vendeur',
      updated_at = now()
  WHERE id = p_dispute_id;
  INSERT INTO public.dispute_events (dispute_id, actor_id, event_type, message, evidence_url)
  VALUES (p_dispute_id, v_user, 'seller_response', btrim(p_message), nullif(btrim(coalesce(p_evidence_url, '')), ''));
  RETURN jsonb_build_object('success', true, 'status', 'reponse_vendeur');
END;
$$;
REVOKE ALL ON FUNCTION public.add_order_dispute_response(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_order_dispute_response(uuid, text, text) TO authenticated;

-- Reviews are accepted only once, from the buyer, after delivery.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_order_unique ON public.reviews(order_id);

CREATE OR REPLACE FUNCTION public.enforce_delivered_order_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND OR auth.uid() IS NULL OR auth.uid() <> v_order.buyer_id
    OR NEW.buyer_id IS DISTINCT FROM v_order.buyer_id
    OR NEW.seller_id IS DISTINCT FROM v_order.seller_id
    OR v_order.status NOT IN ('livree', 'terminee') THEN
    RAISE EXCEPTION 'Un avis est autorisé uniquement après livraison confirmée';
  END IF;
  IF NEW.rating < 1 OR NEW.rating > 5 OR length(coalesce(NEW.comment, '')) > 2000 THEN
    RAISE EXCEPTION 'Avis invalide';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_delivered_order_review ON public.reviews;
CREATE TRIGGER enforce_delivered_order_review
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_delivered_order_review();

DROP POLICY IF EXISTS "Buyers and sellers can create disputes" ON public.disputes;
DROP POLICY IF EXISTS "Participants can update disputes" ON public.disputes;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.disputes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.disputes TO authenticated;


-- Inventory is reserved atomically at checkout and either consumed on payment
-- approval or restored after a definitive payment failure.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reservation_status text NOT NULL DEFAULT 'none'
  CHECK (stock_reservation_status IN ('none', 'reserved', 'consumed', 'released'));

CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_unit_price integer;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A buyer may only create their own order';
    END IF;
    IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      RAISE EXCEPTION 'A valid product and quantity are required';
    END IF;

    SELECT * INTO v_product FROM public.products
    WHERE id = NEW.product_id AND is_active = true FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
    IF v_product.seller_id = NEW.buyer_id THEN RAISE EXCEPTION 'A seller cannot buy their own product'; END IF;

    IF NEW.variant_id IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.product_variants
      WHERE id = NEW.variant_id AND product_id = NEW.product_id AND is_active = true FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Product variant is unavailable'; END IF;
      IF NOT coalesce(v_product.unlimited_stock, false) AND v_variant.stock < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient variant stock';
      END IF;
      v_unit_price := coalesce(v_variant.price, CASE
      WHEN v_product.promo_price > 0 AND v_product.promo_price < v_product.price THEN v_product.promo_price
      ELSE v_product.price
    END);
    ELSE
      IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = NEW.product_id AND is_active = true) THEN
        RAISE EXCEPTION 'A product variant must be selected';
      END IF;
      IF NOT coalesce(v_product.unlimited_stock, false) AND coalesce(v_product.stock, 0) < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient product stock';
      END IF;
      v_unit_price := CASE
        WHEN v_product.promo_price > 0 AND v_product.promo_price < v_product.price THEN v_product.promo_price
        ELSE v_product.price
      END;
    END IF;

    NEW.seller_id := v_product.seller_id;
    NEW.product_name := v_product.name;
    NEW.product_image := v_product.images[1];
    NEW.unit_price := v_unit_price;
    NEW.commission_rate := CASE WHEN coalesce(v_product.is_group_buy, false) THEN 0.03 ELSE 0.05 END;
    NEW.status := 'en_attente';
    NEW.escrow_released := false;
    NEW.stock_reservation_status := 'reserved';
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.variant_id IS DISTINCT FROM OLD.variant_id
    OR NEW.stock_reservation_status IS DISTINCT FROM OLD.stock_reservation_status
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
    OR NEW.escrow_released IS DISTINCT FROM OLD.escrow_released THEN
    RAISE EXCEPTION 'Checkout, inventory and escrow fields cannot be changed by a client';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'livree' AND OLD.status = 'expediee' THEN RETURN NEW; END IF;
    IF auth.uid() = OLD.seller_id
      AND ((OLD.status = 'payee' AND NEW.status = 'en_preparation')
        OR (OLD.status = 'en_preparation' AND NEW.status = 'expediee')) THEN RETURN NEW; END IF;
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'litige'
      AND OLD.status IN ('payee', 'en_preparation', 'expediee', 'livree') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'This order status transition must be performed through the authorized flow';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, text
);

CREATE OR REPLACE FUNCTION public.create_order_payment_atomic(
  p_product_id uuid,
  p_quantity integer,
  p_operator text,
  p_phone text,
  p_delivery_address text,
  p_buyer_note text DEFAULT NULL,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_variant_id uuid DEFAULT NULL,
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
  v_variant public.product_variants%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_tx public.payment_transactions%ROWTYPE;
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_reference text;
  v_rate numeric;
  v_unit_price integer;
  v_total bigint;
  v_commission bigint;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
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
    IF NOT FOUND THEN RAISE EXCEPTION 'Intent de paiement existant incomplet'; END IF;
    RETURN jsonb_build_object(
      'order_id', v_order.id, 'order_ref', v_order.payment_reference,
      'total_price', v_order.total_price, 'transaction_id', v_tx.id, 'reused', true
    );
  END IF;

  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit indisponible'; END IF;
  IF v_product.seller_id = v_buyer THEN RAISE EXCEPTION 'Impossible d acheter son propre produit'; END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible'; END IF;
    IF NOT coalesce(v_product.unlimited_stock, false) AND v_variant.stock < p_quantity THEN
      RAISE EXCEPTION 'Stock de la variante insuffisant';
    END IF;
    v_unit_price := coalesce(v_variant.price, v_product.promo_price, v_product.price);
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id AND is_active = true) THEN
      RAISE EXCEPTION 'Veuillez choisir une variante';
    END IF;
    IF NOT coalesce(v_product.unlimited_stock, false) AND coalesce(v_product.stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant';
    END IF;
    v_unit_price := CASE
      WHEN v_product.promo_price > 0 AND v_product.promo_price < v_product.price THEN v_product.promo_price
      ELSE v_product.price
    END;
  END IF;

  IF v_unit_price IS NULL OR v_unit_price <= 0 THEN RAISE EXCEPTION 'Prix invalide'; END IF;
  v_rate := CASE WHEN coalesce(v_product.is_group_buy, false) THEN 0.03 ELSE 0.05 END;
  v_total := v_unit_price::bigint * p_quantity;
  IF v_total > 2147483647 THEN RAISE EXCEPTION 'Montant de commande trop eleve'; END IF;
  v_commission := round(v_total * v_rate);
  v_reference := 'AFR-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.orders (
    buyer_id, seller_id, product_id, variant_id, product_name, product_image,
    quantity, unit_price, total_price, commission_rate, commission_amount,
    seller_amount, payment_operator, buyer_phone, delivery_address,
    delivery_lat, delivery_lng, buyer_note, status, payment_reference, stock_reservation_status
  ) VALUES (
    v_buyer, v_product.seller_id, v_product.id, p_variant_id, v_product.name, v_product.images[1],
    p_quantity, v_unit_price, v_total::integer, v_rate, v_commission::integer,
    (v_total - v_commission)::integer, p_operator, v_phone, btrim(p_delivery_address),
    p_delivery_lat, p_delivery_lng, nullif(btrim(coalesce(p_buyer_note, '')), ''),
    'en_attente', v_reference, 'reserved'
  ) RETURNING * INTO v_order;

  IF NOT coalesce(v_product.unlimited_stock, false) THEN
    IF p_variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock = stock - p_quantity, updated_at = now()
      WHERE id = p_variant_id AND stock >= p_quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock de la variante insuffisant'; END IF;
    ELSE
      UPDATE public.products SET stock = stock - p_quantity, updated_at = now()
      WHERE id = p_product_id AND stock >= p_quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;
    END IF;
  END IF;

  INSERT INTO public.payment_transactions (
    order_id, fedapay_ref, amount, commission_amount, seller_amount,
    currency, operator, buyer_phone, status, escrow_status
  ) VALUES (
    v_order.id, v_reference, v_order.total_price, v_order.commission_amount,
    v_order.seller_amount, 'XOF', p_operator, v_phone, 'initiated', 'held'
  ) RETURNING * INTO v_tx;

  INSERT INTO public.checkout_idempotency (buyer_id, idempotency_key, order_id)
  VALUES (v_buyer, v_key, v_order.id);

  RETURN jsonb_build_object(
    'order_id', v_order.id, 'order_ref', v_reference,
    'total_price', v_order.total_price, 'transaction_id', v_tx.id, 'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_payment_atomic(
  uuid, integer, text, text, text, text, double precision, double precision, uuid, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_order_stock_reservation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_product public.products%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role required';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('released', false, 'reason', 'order_not_found'); END IF;
  IF v_order.stock_reservation_status <> 'reserved' THEN
    RETURN jsonb_build_object('released', false, 'duplicate', true, 'status', v_order.stock_reservation_status);
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_order.product_id FOR UPDATE;
  IF FOUND AND NOT coalesce(v_product.unlimited_stock, false) THEN
    IF v_order.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET stock = stock + v_order.quantity, updated_at = now()
      WHERE id = v_order.variant_id;
    ELSE
      UPDATE public.products
      SET stock = coalesce(stock, 0) + v_order.quantity, updated_at = now()
      WHERE id = v_order.product_id;
    END IF;
  END IF;
  UPDATE public.orders SET stock_reservation_status = 'released' WHERE id = p_order_id;
  RETURN jsonb_build_object('released', true, 'status', 'released');
END;
$$;
REVOKE ALL ON FUNCTION public.release_order_stock_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock_reservation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_order_stock_reservation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'service_role required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF v_order.stock_reservation_status = 'consumed' THEN
    RETURN jsonb_build_object('consumed', true, 'duplicate', true);
  END IF;
  IF v_order.stock_reservation_status = 'none' THEN
    RETURN jsonb_build_object('consumed', false, 'legacy_order', true);
  END IF;
  IF v_order.stock_reservation_status <> 'reserved' THEN
    RAISE EXCEPTION 'Reservation de stock indisponible';
  END IF;
  UPDATE public.orders SET stock_reservation_status = 'consumed' WHERE id = p_order_id;
  RETURN jsonb_build_object('consumed', true, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_order_stock_reservation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_order_stock_reservation(uuid) TO service_role;



CREATE OR REPLACE FUNCTION public.add_cart_item(
  p_product_id uuid,
  p_quantity integer DEFAULT 1,
  p_variant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_item public.cart_items%ROWTYPE;
  v_new_quantity integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  SELECT * INTO v_product FROM public.products
  WHERE id = p_product_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit indisponible'; END IF;

  IF p_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants
    WHERE id = p_variant_id AND product_id = p_product_id AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible'; END IF;
    SELECT * INTO v_item FROM public.cart_items
    WHERE buyer_id = v_user AND product_id = p_product_id AND variant_id = p_variant_id
    FOR UPDATE;
  ELSE
    IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id AND is_active = true) THEN
      RAISE EXCEPTION 'Veuillez choisir une variante';
    END IF;
    SELECT * INTO v_item FROM public.cart_items
    WHERE buyer_id = v_user AND product_id = p_product_id AND variant_id IS NULL
    FOR UPDATE;
  END IF;

  v_new_quantity := coalesce(v_item.quantity, 0) + p_quantity;
  IF v_new_quantity > 50 THEN RAISE EXCEPTION 'Quantité maximale du panier dépassée'; END IF;
  IF NOT coalesce(v_product.unlimited_stock, false) THEN
    IF p_variant_id IS NOT NULL AND v_variant.stock < v_new_quantity THEN
      RAISE EXCEPTION 'Stock de la variante insuffisant';
    ELSIF p_variant_id IS NULL AND coalesce(v_product.stock, 0) < v_new_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant';
    END IF;
  END IF;

  IF FOUND THEN
    UPDATE public.cart_items SET quantity = v_new_quantity, updated_at = now()
    WHERE id = v_item.id RETURNING * INTO v_item;
  ELSE
    INSERT INTO public.cart_items (buyer_id, product_id, variant_id, quantity)
    VALUES (v_user, p_product_id, p_variant_id, p_quantity)
    RETURNING * INTO v_item;
  END IF;
  RETURN jsonb_build_object('success', true, 'cart_item_id', v_item.id, 'quantity', v_item.quantity);
END;
$$;
REVOKE ALL ON FUNCTION public.add_cart_item(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, integer, uuid) TO authenticated;



CREATE OR REPLACE FUNCTION public.get_my_shop_stats()
RETURNS TABLE (
  completed_sales bigint,
  orders_in_progress bigint,
  seller_amount_total bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    count(*) FILTER (WHERE o.status IN ('payee', 'en_preparation', 'expediee', 'livree', 'terminee')),
    count(*) FILTER (WHERE o.status IN ('en_attente', 'payee', 'en_preparation', 'expediee')),
    coalesce(sum(o.seller_amount) FILTER (WHERE o.status IN ('payee', 'en_preparation', 'expediee', 'livree', 'terminee')), 0)
  FROM public.orders AS o
  WHERE o.seller_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_shop_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_shop_stats() TO authenticated;


CREATE OR REPLACE FUNCTION public.cleanup_expired_checkout_reservations(
  p_older_than interval DEFAULT interval '30 minutes'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_cleaned integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'service_role required'; END IF;
  IF p_older_than < interval '10 minutes' OR p_older_than > interval '7 days' THEN
    RAISE EXCEPTION 'Invalid checkout expiration interval';
  END IF;

  FOR v_order IN
    SELECT o.*
    FROM public.orders o
    JOIN public.payment_transactions tx ON tx.order_id = o.id
    WHERE o.status = 'en_attente'
      AND o.stock_reservation_status = 'reserved'
      AND o.created_at < now() - p_older_than
      AND tx.status IN ('initiated', 'failed', 'cancelled')
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    UPDATE public.payment_transactions
    SET status = 'failed'
    WHERE order_id = v_order.id AND status IN ('initiated', 'failed', 'cancelled');
    UPDATE public.orders SET status = 'annulee' WHERE id = v_order.id AND status = 'en_attente';
    PERFORM public.release_order_stock_reservation(v_order.id);
    v_cleaned := v_cleaned + 1;
  END LOOP;
  RETURN v_cleaned;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_expired_checkout_reservations(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_checkout_reservations(interval) TO service_role;
