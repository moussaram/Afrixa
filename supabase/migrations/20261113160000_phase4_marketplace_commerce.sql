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
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
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
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

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
