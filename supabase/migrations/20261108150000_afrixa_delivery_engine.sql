-- Afrixa Delivery: provider registry, seller delivery configuration, quotes,
-- shipments and append-only events. External providers remain disabled until
-- their account, coverage, API contract and credentials are verified.

CREATE TABLE IF NOT EXISTS public.delivery_providers (
  code text PRIMARY KEY CHECK (code IN ('ouigoo', 'yango', 'seller')),
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  access_status text NOT NULL DEFAULT 'access_pending'
    CHECK (access_status IN ('ready', 'access_pending', 'unverified', 'unavailable', 'disabled')),
  supported_countries text[] NOT NULL DEFAULT '{}',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.delivery_providers(code, display_name, enabled, access_status, supported_countries, capabilities)
VALUES
  ('seller', 'Livraison organisée par le vendeur', true, 'ready', '{}',
   '{"quote":true,"create":true,"tracking":false,"cancel":true}'::jsonb),
  ('ouigoo', 'OuiGoo', false, 'access_pending', ARRAY['BJ'],
   '{"rest_api_documented":true,"account_verified":false,"shipment_endpoints_verified":false,"webhook_signature_verified":false}'::jsonb),
  ('yango', 'Yango Delivery', false, 'unverified', '{}',
   '{"benin_coverage_verified":false,"business_api_access_verified":false}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  access_status = EXCLUDED.access_status,
  supported_countries = EXCLUDED.supported_countries,
  capabilities = EXCLUDED.capabilities,
  updated_at = now();
ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads delivery provider availability"
  ON public.delivery_providers FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  contact_name text,
  contact_phone text,
  address text NOT NULL,
  city text NOT NULL,
  country_code text NOT NULL,
  latitude double precision,
  longitude double precision,
  instructions text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, seller_id),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
  CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);
CREATE INDEX IF NOT EXISTS pickup_locations_seller_idx
  ON public.pickup_locations(seller_id, is_active);
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own pickup locations"
  ON public.pickup_locations FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE TABLE IF NOT EXISTS public.seller_delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  pickup_location_id uuid,
  preparation_minutes integer NOT NULL DEFAULT 60 CHECK (preparation_minutes BETWEEN 0 AND 10080),
  policy_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (pickup_location_id, seller_id) REFERENCES public.pickup_locations(id, seller_id) ON DELETE RESTRICT
);
ALTER TABLE public.seller_delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own delivery settings"
  ON public.seller_delivery_settings FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE TABLE IF NOT EXISTS public.seller_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  city text NOT NULL,
  zone_code text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seller_delivery_zone_unique
  ON public.seller_delivery_zones(seller_id, country_code, lower(city));
ALTER TABLE public.seller_delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own delivery zones"
  ON public.seller_delivery_zones FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE TABLE IF NOT EXISTS public.seller_delivery_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.seller_delivery_zones(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  eta_min_minutes integer NOT NULL DEFAULT 60 CHECK (eta_min_minutes >= 0),
  eta_max_minutes integer NOT NULL DEFAULT 1440 CHECK (eta_max_minutes >= eta_min_minutes),
  minimum_order_minor integer NOT NULL DEFAULT 0 CHECK (minimum_order_minor >= 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seller_delivery_rates_zone_unique ON public.seller_delivery_rates(zone_id);
ALTER TABLE public.seller_delivery_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own delivery rates"
  ON public.seller_delivery_rates FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.seller_delivery_zones z WHERE z.id = zone_id AND z.seller_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.delivery_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  provider_code text NOT NULL REFERENCES public.delivery_providers(code),
  zone_id uuid REFERENCES public.seller_delivery_zones(id) ON DELETE RESTRICT,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency = 'XOF'),
  eta_min_minutes integer,
  eta_max_minutes integer,
  quote_reference text,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delivery_quotes_buyer_idx
  ON public.delivery_quotes(buyer_id, created_at DESC);
ALTER TABLE public.delivery_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer reads own delivery quotes"
  ON public.delivery_quotes FOR SELECT USING (auth.uid() = buyer_id);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_code text NOT NULL REFERENCES public.delivery_providers(code),
  quote_id uuid REFERENCES public.delivery_quotes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','awaiting_seller','preparing','ready_for_pickup',
      'pickup_confirmed','in_transit','delivered_reported','delivered','failed','cancelled','issue_reported')),
  provider_reference text,
  idempotency_key text NOT NULL UNIQUE,
  tracking_url text,
  shipping_amount_minor integer NOT NULL DEFAULT 0 CHECK (shipping_amount_minor >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  pickup_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  parcel_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  eta_min timestamptz,
  eta_max timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS deliveries_seller_status_idx
  ON public.deliveries(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS deliveries_buyer_idx
  ON public.deliveries(buyer_id, created_at DESC);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants read deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  provider_event_id text,
  source text NOT NULL CHECK (source IN ('provider_webhook','provider_poll','seller','buyer','admin','system')),
  event_type text NOT NULL,
  normalized_status text NOT NULL,
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text,
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'processed'
    CHECK (processing_status IN ('received','processed','ignored','failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_events_provider_event_unique
  ON public.delivery_events(delivery_id, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS delivery_events_delivery_idx
  ON public.delivery_events(delivery_id, received_at DESC);
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants read delivery events"
  ON public.delivery_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_id AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid())
  ));

CREATE TABLE IF NOT EXISTS public.delivery_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code text NOT NULL REFERENCES public.delivery_providers(code),
  event_key text NOT NULL,
  signature_valid boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text,
  payload_hash text NOT NULL,
  UNIQUE(provider_code, event_key)
);
ALTER TABLE public.delivery_webhook_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  provider_code text NOT NULL REFERENCES public.delivery_providers(code),
  operation text NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  outcome text NOT NULL,
  provider_http_status integer,
  error_code text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.quote_seller_delivery(
  p_product_id uuid,
  p_country_code text,
  p_city text,
  p_quantity integer DEFAULT 1
)
RETURNS public.delivery_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  rate_row public.seller_delivery_rates%ROWTYPE;
  zone_row public.seller_delivery_zones%ROWTYPE;
  result_row public.delivery_quotes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 1000 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO product_row FROM public.products
  WHERE id = p_product_id AND is_active = true
    AND publication_status = 'published' AND product_type = 'physical'
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Physical product unavailable'; END IF;
  IF product_row.seller_id = auth.uid() THEN RAISE EXCEPTION 'Self-delivery quote is not allowed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.seller_delivery_settings s
    WHERE s.seller_id = product_row.seller_id AND s.enabled = true
  ) THEN RAISE EXCEPTION 'Seller delivery is not enabled'; END IF;

  SELECT * INTO zone_row FROM public.seller_delivery_zones z
  WHERE z.seller_id = product_row.seller_id
    AND z.enabled = true
    AND z.country_code = upper(p_country_code)
    AND lower(z.city) = lower(trim(p_city))
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination is outside seller delivery coverage'; END IF;

  SELECT * INTO rate_row FROM public.seller_delivery_rates r
  WHERE r.zone_id = zone_row.id AND r.seller_id = product_row.seller_id AND r.enabled = true
  ORDER BY r.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Seller delivery rate is not configured'; END IF;
  IF product_row.price * p_quantity < rate_row.minimum_order_minor THEN
    RAISE EXCEPTION 'Minimum order amount for seller delivery is not reached';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seller_delivery_settings s
    JOIN public.pickup_locations p ON p.id = s.pickup_location_id AND p.seller_id = s.seller_id
    WHERE s.seller_id = product_row.seller_id AND s.enabled = true AND p.is_active = true) THEN
    RAISE EXCEPTION 'Seller pickup location is not configured';
  END IF;

  INSERT INTO public.delivery_quotes(
    buyer_id, seller_id, product_id, provider_code, zone_id, amount_minor, currency,
    eta_min_minutes, eta_max_minutes, input_snapshot, expires_at
  ) VALUES (
    auth.uid(), product_row.seller_id, product_row.id, 'seller', zone_row.id,
    rate_row.amount_minor, rate_row.currency, rate_row.eta_min_minutes,
    rate_row.eta_max_minutes,
    jsonb_build_object('country_code', upper(p_country_code), 'city', trim(p_city)),
    now() + interval '15 minutes'
  ) RETURNING * INTO result_row;
  RETURN result_row;
END;
$$;

REVOKE ALL ON FUNCTION public.quote_seller_delivery(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_seller_delivery(uuid, text, text, integer) TO authenticated;

-- A quote is consumed exactly once by checkout. Server-derived totals include
-- shipping; commission is calculated only on merchandise, not on shipping.
CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  asset_row public.digital_product_assets%ROWTYPE;
  quote_row public.delivery_quotes%ROWTYPE;
  effective_price integer;
  merchandise_total integer;
  commission_rate_value numeric;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Order changes are restricted to trusted server workflows'; END IF;
  IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The authenticated buyer must own this order';
  END IF;
  IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 THEN
    RAISE EXCEPTION 'A valid product and positive quantity are required';
  END IF;

  SELECT * INTO product_row FROM public.products
  WHERE id = NEW.product_id AND is_active = true
    AND publication_status = 'published' AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
  IF product_row.seller_id = NEW.buyer_id THEN RAISE EXCEPTION 'A seller cannot purchase their own product'; END IF;

  effective_price := CASE
    WHEN product_row.promo_price IS NOT NULL AND product_row.promo_price > 0
      AND product_row.promo_price < product_row.price
    THEN product_row.promo_price ELSE product_row.price END;
  commission_rate_value := CASE WHEN COALESCE(product_row.is_group_buy, false) THEN 0.03 ELSE 0.05 END;
  merchandise_total := effective_price * NEW.quantity;

  NEW.seller_id := product_row.seller_id;
  NEW.product_name := product_row.name;
  NEW.product_image := product_row.images[1];
  NEW.unit_price := effective_price;
  NEW.commission_rate := commission_rate_value;
  NEW.product_type := product_row.product_type;
  NEW.currency := product_row.currency;
  NEW.status := 'en_attente';
  NEW.escrow_released := false;
  NEW.dispute_reason := NULL;
  NEW.auto_confirm_date := NULL;

  IF product_row.product_type = 'digital' THEN
    SELECT * INTO asset_row FROM public.digital_product_assets
    WHERE product_id = product_row.id AND seller_id = product_row.seller_id
      AND status = 'ready' AND scan_status IN ('clean', 'not_configured')
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Digital product file is not ready for delivery'; END IF;
    NEW.digital_asset_id := asset_row.id;
    NEW.delivery_method := 'digital';
    NEW.delivery_fee := 0;
    NEW.delivery_provider := NULL;
    NEW.delivery_quote_id := NULL;
    NEW.delivery_address := NULL;
    NEW.delivery_lat := NULL;
    NEW.delivery_lng := NULL;
  ELSE
    NEW.digital_asset_id := NULL;
    IF NEW.delivery_quote_id IS NOT NULL THEN
      SELECT * INTO quote_row FROM public.delivery_quotes
      WHERE id = NEW.delivery_quote_id AND buyer_id = auth.uid()
        AND product_id = product_row.id AND seller_id = product_row.seller_id
        AND status = 'quoted' AND expires_at > now()
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Delivery quote is invalid or expired'; END IF;
      IF quote_row.provider_code <> 'seller' OR quote_row.currency <> product_row.currency THEN
        RAISE EXCEPTION 'Delivery quote provider or currency is not valid';
      END IF;
      NEW.delivery_method := 'seller';
      NEW.delivery_provider := quote_row.provider_code;
      NEW.delivery_fee := quote_row.amount_minor;
      NEW.currency := quote_row.currency;
      UPDATE public.delivery_quotes SET status = 'consumed' WHERE id = quote_row.id;
    ELSE
      NEW.delivery_method := COALESCE(NEW.delivery_method, 'seller');
      IF NEW.delivery_method IN ('yango', 'ouigoo') THEN
        RAISE EXCEPTION 'Selected delivery provider is not enabled';
      END IF;
      IF NEW.delivery_method = 'seller' THEN
        RAISE EXCEPTION 'A current seller delivery quote is required';
      END IF;
      IF NEW.delivery_method <> 'pickup' THEN
        RAISE EXCEPTION 'Unsupported delivery method';
      END IF;
      NEW.delivery_provider := 'seller';
      NEW.delivery_fee := 0;
    END IF;

    IF NOT COALESCE(product_row.unlimited_stock, false) THEN
      IF COALESCE(product_row.stock, 0) < NEW.quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
      UPDATE public.products SET stock = stock - NEW.quantity, updated_at = now() WHERE id = product_row.id;
    END IF;
  END IF;

  NEW.commission_amount := round(merchandise_total * commission_rate_value)::integer;
  NEW.seller_amount := merchandise_total - NEW.commission_amount + COALESCE(NEW.delivery_fee, 0);
  NEW.total_price := merchandise_total + COALESCE(NEW.delivery_fee, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_order_checkout_integrity ON public.orders;
DROP TRIGGER IF EXISTS enforce_order_checkout_integrity ON public.orders;
CREATE TRIGGER a_order_checkout_integrity
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_checkout_integrity();

CREATE OR REPLACE FUNCTION public.create_seller_delivery_after_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pickup_row public.pickup_locations%ROWTYPE;
BEGIN
  IF NEW.product_type <> 'physical' OR NEW.delivery_method = 'pickup' THEN RETURN NEW; END IF;
  SELECT * INTO pickup_row FROM public.pickup_locations
  WHERE seller_id = NEW.seller_id AND is_default = true AND is_active = true
  ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.deliveries(
    order_id, buyer_id, seller_id, provider_code, quote_id, status, idempotency_key,
    shipping_amount_minor, currency, pickup_snapshot, recipient_snapshot, parcel_snapshot
  ) VALUES (
    NEW.id, NEW.buyer_id, NEW.seller_id, COALESCE(NEW.delivery_provider, 'seller'),
    NEW.delivery_quote_id, 'awaiting_payment',
    'AFR-DELIVERY-' || replace(NEW.id::text, '-', ''),
    COALESCE(NEW.delivery_fee, 0), NEW.currency,
    CASE WHEN FOUND THEN jsonb_build_object('label', pickup_row.label, 'address', pickup_row.address,
      'city', pickup_row.city, 'country_code', pickup_row.country_code,
      'latitude', pickup_row.latitude, 'longitude', pickup_row.longitude) ELSE '{}'::jsonb END,
    jsonb_build_object('address', NEW.delivery_address, 'latitude', NEW.delivery_lat, 'longitude', NEW.delivery_lng),
    jsonb_build_object('product_name', NEW.product_name, 'quantity', NEW.quantity)
  );
  INSERT INTO public.delivery_events(delivery_id, source, event_type, normalized_status)
  SELECT id, 'system', 'delivery.created', 'awaiting_payment'
  FROM public.deliveries WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_seller_delivery_after_order ON public.orders;
CREATE TRIGGER create_seller_delivery_after_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.create_seller_delivery_after_order();

CREATE OR REPLACE FUNCTION public.activate_delivery_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'successful' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.deliveries SET status = 'awaiting_seller', updated_at = now()
    WHERE order_id = NEW.order_id AND status = 'awaiting_payment';
    INSERT INTO public.delivery_events(delivery_id, source, event_type, normalized_status)
    SELECT id, 'system', 'delivery.payment_confirmed', 'awaiting_seller'
    FROM public.deliveries WHERE order_id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS activate_delivery_after_payment ON public.payment_transactions;
CREATE TRIGGER activate_delivery_after_payment
AFTER UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.activate_delivery_after_payment();
