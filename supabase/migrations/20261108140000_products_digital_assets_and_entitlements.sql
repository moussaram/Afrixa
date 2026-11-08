-- Afrixa marketplace: physical/digital product foundation.
-- Expand existing data without deleting historical products or orders.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS dimensions_mm jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.products
SET publication_status = CASE WHEN is_active THEN 'published' ELSE 'draft' END
WHERE publication_status IS NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check,
  ADD CONSTRAINT products_product_type_check
    CHECK (product_type IN ('physical', 'digital')) NOT VALID,
  DROP CONSTRAINT IF EXISTS products_publication_status_check,
  ADD CONSTRAINT products_publication_status_check
    CHECK (publication_status IN ('draft', 'published', 'archived', 'rejected')) NOT VALID,
  DROP CONSTRAINT IF EXISTS products_currency_check,
  ADD CONSTRAINT products_currency_check
    CHECK (currency = 'XOF') NOT VALID,
  DROP CONSTRAINT IF EXISTS products_weight_nonnegative_check,
  ADD CONSTRAINT products_weight_nonnegative_check
    CHECK (weight_grams IS NULL OR weight_grams >= 0) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS products_seller_sku_unique
  ON public.products(seller_id, lower(sku))
  WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_public_catalog_idx
  ON public.products(product_type, category, created_at DESC)
  WHERE is_active = true AND publication_status = 'published' AND deleted_at IS NULL;

DROP POLICY IF EXISTS "Produits actifs visibles publiquement" ON public.products;
CREATE POLICY "Public catalog and owner product access"
  ON public.products FOR SELECT
  USING (
    (is_active = true AND publication_status = 'published' AND deleted_at IS NULL)
    OR auth.uid() = seller_id
  );

CREATE OR REPLACE FUNCTION public.protect_product_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A seller can only create products for their own account';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'Product ownership cannot be transferred by a client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_product_owner ON public.products;
CREATE TRIGGER protect_product_owner
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_product_owner();

CREATE OR REPLACE FUNCTION public.enforce_product_type_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.product_type IS DISTINCT FROM OLD.product_type
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.product_id = OLD.id) THEN
    RAISE EXCEPTION 'Product type cannot change after an order exists';
  END IF;
  IF NEW.product_type = 'digital' THEN
    NEW.unlimited_stock := true;
    NEW.stock := 0;
    NEW.is_group_buy := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_type_rules ON public.products;
CREATE TRIGGER enforce_product_type_rules
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_type_rules();

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sku text,
  label text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_override integer,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  unlimited_stock boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx
  ON public.product_variants(product_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_seller_sku_unique
  ON public.product_variants(seller_id, lower(sku)) WHERE sku IS NOT NULL;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Seller manages own product variants" ON public.product_variants;
CREATE POLICY "Seller manages own product variants"
  ON public.product_variants FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.digital_product_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  bucket_id text NOT NULL DEFAULT 'afrixa-digital-private',
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  detected_mime_type text,
  byte_size bigint,
  sha256 text,
  version_label text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'quarantined'
    CHECK (status IN ('quarantined', 'ready', 'rejected', 'revoked')),
  scan_status text NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'clean', 'suspicious', 'failed', 'not_configured')),
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);
CREATE INDEX IF NOT EXISTS digital_assets_product_status_idx
  ON public.digital_product_assets(product_id, status, created_at DESC);
ALTER TABLE public.digital_product_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller reads own digital asset metadata"
  ON public.digital_product_assets FOR SELECT
  USING (auth.uid() = seller_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS digital_asset_id uuid REFERENCES public.digital_product_assets(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS delivery_method text,
  ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_provider text,
  ADD COLUMN IF NOT EXISTS delivery_quote_id uuid;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check,
  ADD CONSTRAINT orders_product_type_check
    CHECK (product_type IN ('physical', 'digital')) NOT VALID,
  DROP CONSTRAINT IF EXISTS orders_delivery_fee_nonnegative_check,
  ADD CONSTRAINT orders_delivery_fee_nonnegative_check CHECK (delivery_fee >= 0) NOT VALID;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_type text NOT NULL CHECK (product_type IN ('physical', 'digital')),
  product_name text NOT NULL,
  product_image text,
  sku text,
  variant_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL CHECK (unit_price > 0),
  total_price integer NOT NULL CHECK (total_price > 0),
  currency text NOT NULL DEFAULT 'XOF',
  digital_asset_id uuid REFERENCES public.digital_product_assets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_seller_idx ON public.order_items(seller_id, created_at DESC);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  ));

-- Preserve historical single-product orders as immutable line snapshots.
INSERT INTO public.order_items (
  order_id, product_id, seller_id, product_type, product_name, product_image,
  quantity, unit_price, total_price, currency
)
SELECT o.id, o.product_id, o.seller_id, 'physical', o.product_name, o.product_image,
       o.quantity, o.unit_price, o.total_price, 'XOF'
FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id);

CREATE TABLE IF NOT EXISTS public.digital_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.digital_product_assets(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(user_id, order_id, product_id)
);
CREATE INDEX IF NOT EXISTS digital_entitlements_user_idx
  ON public.digital_entitlements(user_id, status, granted_at DESC);
ALTER TABLE public.digital_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer reads own digital entitlements"
  ON public.digital_entitlements FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.digital_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES public.digital_entitlements(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.digital_product_assets(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL UNIQUE,
  outcome text NOT NULL CHECK (outcome IN ('url_issued', 'denied', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_download_events_user_idx
  ON public.digital_download_events(user_id, created_at DESC);
ALTER TABLE public.digital_download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer reads own digital download history"
  ON public.digital_download_events FOR SELECT USING (auth.uid() = user_id);

-- Public product media and private paid files are intentionally separate buckets.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('afrixa-product-media', 'afrixa-product-media', true, NULL,
   ARRAY['image/jpeg','image/png','image/webp','image/avif']),
  ('afrixa-digital-private', 'afrixa-digital-private', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public reads Afrixa product media" ON storage.objects;
CREATE POLICY "Public reads Afrixa product media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'afrixa-product-media');

DROP POLICY IF EXISTS "Seller uploads Afrixa product media" ON storage.objects;
CREATE POLICY "Seller uploads Afrixa product media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'afrixa-product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Seller updates Afrixa product media" ON storage.objects;
CREATE POLICY "Seller updates Afrixa product media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'afrixa-product-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'afrixa-product-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Seller deletes Afrixa product media" ON storage.objects;
CREATE POLICY "Seller deletes Afrixa product media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'afrixa-product-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- No authenticated SELECT/INSERT policy is granted for paid digital objects.
-- Signed URLs are issued only by a server function after entitlement checks.

CREATE OR REPLACE FUNCTION public.create_order_item_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_items (
    order_id, product_id, seller_id, product_type, product_name, product_image,
    quantity, unit_price, total_price, currency, digital_asset_id
  ) VALUES (
    NEW.id, NEW.product_id, NEW.seller_id, NEW.product_type, NEW.product_name,
    NEW.product_image, NEW.quantity, NEW.unit_price, NEW.total_price,
    NEW.currency, NEW.digital_asset_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_order_item_snapshot ON public.orders;
CREATE TRIGGER create_order_item_snapshot
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.create_order_item_snapshot();

CREATE OR REPLACE FUNCTION public.grant_digital_entitlement_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF NEW.status = 'successful' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO order_row FROM public.orders WHERE id = NEW.order_id FOR UPDATE;
    IF FOUND AND order_row.product_type = 'digital' AND order_row.digital_asset_id IS NOT NULL THEN
      INSERT INTO public.digital_entitlements(user_id, product_id, order_id, asset_id)
      VALUES (order_row.buyer_id, order_row.product_id, order_row.id, order_row.digital_asset_id)
      ON CONFLICT (user_id, order_id, product_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_digital_entitlement_after_payment ON public.payment_transactions;
CREATE TRIGGER grant_digital_entitlement_after_payment
AFTER UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.grant_digital_entitlement_after_payment();

-- The checkout integrity function from the previous remediation also handles
-- digital products: no physical stock is decremented and a ready asset is required.
CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  asset_row public.digital_product_assets%ROWTYPE;
  effective_price integer;
  commission_rate_value numeric;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Order changes are restricted to trusted server workflows';
  END IF;
  IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The authenticated buyer must own this order';
  END IF;
  IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 THEN
    RAISE EXCEPTION 'A valid product and positive quantity are required';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = NEW.product_id AND is_active = true
    AND publication_status = 'published' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
  IF product_row.seller_id = NEW.buyer_id THEN
    RAISE EXCEPTION 'A seller cannot purchase their own product';
  END IF;

  effective_price := CASE
    WHEN product_row.promo_price IS NOT NULL
      AND product_row.promo_price > 0
      AND product_row.promo_price < product_row.price
    THEN product_row.promo_price ELSE product_row.price END;
  commission_rate_value := CASE WHEN COALESCE(product_row.is_group_buy, false) THEN 0.03 ELSE 0.05 END;

  NEW.seller_id := product_row.seller_id;
  NEW.product_name := product_row.name;
  NEW.product_image := product_row.images[1];
  NEW.unit_price := effective_price;
  NEW.quantity := GREATEST(1, NEW.quantity);
  NEW.commission_rate := commission_rate_value;
  NEW.product_type := product_row.product_type;
  NEW.currency := product_row.currency;
  NEW.total_price := effective_price * NEW.quantity;
  NEW.commission_amount := round(NEW.total_price * commission_rate_value)::integer;
  NEW.seller_amount := NEW.total_price - NEW.commission_amount;
  NEW.status := 'en_attente';
  NEW.escrow_released := false;
  NEW.dispute_reason := NULL;
  NEW.auto_confirm_date := NULL;

  IF product_row.product_type = 'digital' THEN
    SELECT * INTO asset_row
    FROM public.digital_product_assets
    WHERE product_id = product_row.id AND seller_id = product_row.seller_id
      AND status = 'ready' AND scan_status = 'clean'
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Digital product file is not ready'; END IF;
    NEW.digital_asset_id := asset_row.id;
    NEW.delivery_fee := 0;
    NEW.delivery_address := NULL;
    NEW.delivery_lat := NULL;
    NEW.delivery_lng := NULL;
    NEW.delivery_method := 'digital';
  ELSE
    NEW.digital_asset_id := NULL;
    IF NOT COALESCE(product_row.unlimited_stock, false) THEN
      IF COALESCE(product_row.stock, 0) < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock';
      END IF;
      UPDATE public.products SET stock = stock - NEW.quantity, updated_at = now()
      WHERE id = product_row.id;
    END IF;
    IF NEW.delivery_method IS NULL THEN NEW.delivery_method := 'seller'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure exactly one checkout trigger calls the canonical function.
DROP TRIGGER IF EXISTS a_order_checkout_integrity ON public.orders;
DROP TRIGGER IF EXISTS enforce_order_checkout_integrity ON public.orders;
CREATE TRIGGER a_order_checkout_integrity
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_checkout_integrity();

-- Record physical stock reservation movements and release movements.
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('reserved', 'released', 'adjustment')),
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx
  ON public.inventory_movements(product_id, created_at DESC);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller reads own inventory movements"
  ON public.inventory_movements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_inventory_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_type = 'physical' THEN
    INSERT INTO public.inventory_movements(product_id, order_id, movement_type, quantity, reason)
    VALUES (NEW.product_id, NEW.id, 'reserved', NEW.quantity, 'checkout_reservation');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS record_inventory_reservation ON public.orders;
CREATE TRIGGER record_inventory_reservation
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_inventory_reservation();

CREATE OR REPLACE FUNCTION public.restore_order_stock_after_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'en_attente' AND NEW.status = 'annulee'
    AND NEW.product_id IS NOT NULL AND NEW.product_type = 'physical' THEN
    UPDATE public.products
    SET stock = COALESCE(stock, 0) + NEW.quantity, updated_at = now()
    WHERE id = NEW.product_id AND COALESCE(unlimited_stock, false) = false;
    INSERT INTO public.inventory_movements(product_id, order_id, movement_type, quantity, reason)
    VALUES (NEW.product_id, NEW.id, 'released', NEW.quantity, 'payment_failed_or_cancelled');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS restore_order_stock_after_cancellation ON public.orders;
CREATE TRIGGER restore_order_stock_after_cancellation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_order_stock_after_cancellation();

