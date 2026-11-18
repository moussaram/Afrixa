-- Afrixa marketplace order integrity and seller wallet ledger.
-- Applied to the Afrixa Supabase project as migration
-- afrixa_order_security_wallet_ledger_20261118.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_seller_active_idx
  ON public.orders (seller_id, created_at DESC)
  WHERE escrow_released = false;

CREATE TABLE IF NOT EXISTS public.seller_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  entry_type text NOT NULL CHECK (entry_type IN ('order_release_credit')),
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_wallet_ledger_one_release_per_order UNIQUE (order_id, entry_type)
);

ALTER TABLE public.seller_wallet_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_wallet_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seller_wallet_ledger TO authenticated;
GRANT SELECT, INSERT ON public.seller_wallet_ledger TO service_role;

DROP POLICY IF EXISTS seller_wallet_ledger_owner_read ON public.seller_wallet_ledger;
CREATE POLICY seller_wallet_ledger_owner_read
  ON public.seller_wallet_ledger FOR SELECT TO authenticated
  USING (seller_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_seller_wallet_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal du portefeuille vendeur est immuable';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_seller_wallet_ledger_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seller_wallet_ledger_append_only ON public.seller_wallet_ledger;
CREATE TRIGGER seller_wallet_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.seller_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_wallet_ledger_mutation();

CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  product_row public.products%ROWTYPE;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A buyer may only create their own order';
    END IF;
    IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      RAISE EXCEPTION 'A valid product and quantity are required';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = NEW.product_id AND is_active = true
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is unavailable';
    END IF;
    IF product_row.seller_id = NEW.buyer_id THEN
      RAISE EXCEPTION 'A seller cannot buy their own product';
    END IF;
    IF NOT product_row.unlimited_stock AND COALESCE(product_row.stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient product stock';
    END IF;

    NEW.seller_id := product_row.seller_id;
    NEW.product_name := product_row.name;
    NEW.product_image := product_row.images[1];
    NEW.unit_price := product_row.price;
    NEW.commission_rate := CASE WHEN product_row.is_group_buy THEN 0.03 ELSE 0.05 END;
    NEW.status := 'en_attente';
    NEW.escrow_released := false;
    NEW.tracking_number := NULL;
    NEW.shipped_at := NULL;
    NEW.buyer_confirmed_at := NULL;
    NEW.released_at := NULL;
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
    OR NEW.buyer_confirmed_at IS DISTINCT FROM OLD.buyer_confirmed_at
    OR NEW.released_at IS DISTINCT FROM OLD.released_at THEN
    RAISE EXCEPTION 'Checkout and escrow fields cannot be changed by a client';
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
    OR NEW.shipped_at IS DISTINCT FROM OLD.shipped_at THEN
    IF auth.uid() IS DISTINCT FROM OLD.seller_id THEN
      RAISE EXCEPTION 'Only the seller may update shipment tracking';
    END IF;
    IF OLD.status NOT IN ('payee', 'en_preparation', 'expediee') THEN
      RAISE EXCEPTION 'Shipment details cannot be changed in this order state';
    END IF;
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
$function$;

REVOKE ALL ON FUNCTION public.enforce_order_checkout_integrity() FROM PUBLIC, anon, authenticated;
