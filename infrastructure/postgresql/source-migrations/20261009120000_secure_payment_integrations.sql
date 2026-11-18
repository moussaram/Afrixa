-- Keep checkout values server-derived and make payment state transitions
-- available only to trusted Supabase Edge Functions.

CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN
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
    OR NEW.escrow_released IS DISTINCT FROM OLD.escrow_released THEN
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

CREATE OR REPLACE FUNCTION public.enforce_payment_transaction_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Payment transaction updates are server-only';
  END IF;

  SELECT * INTO order_row
  FROM public.orders
  WHERE id = NEW.order_id AND buyer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for this buyer';
  END IF;
  IF order_row.status <> 'en_attente'
    OR NEW.flutterwave_ref IS DISTINCT FROM order_row.payment_reference THEN
    RAISE EXCEPTION 'Payment reference is not valid for this order';
  END IF;

  NEW.amount := order_row.total_price;
  NEW.commission_amount := order_row.commission_amount;
  NEW.seller_amount := order_row.seller_amount;
  NEW.currency := 'XOF';
  NEW.status := 'initiated';
  NEW.flutterwave_tx_id := NULL;
  NEW.flutterwave_response := NULL;
  NEW.escrow_status := 'held';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_transaction_integrity ON public.payment_transactions;
CREATE TRIGGER payment_transaction_integrity
BEFORE INSERT OR UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_transaction_integrity();

DROP POLICY IF EXISTS "Participants can update transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Buyers can create splits" ON public.commission_splits;
DROP POLICY IF EXISTS "Sellers can request payouts" ON public.seller_payouts;
DROP POLICY IF EXISTS "Commissions can be inserted by order participants" ON public.commissions;

-- Delivery confirmation updates the order only. The payment Edge Function
-- marks escrow released after Flutterwave confirms the payout.
DROP TRIGGER IF EXISTS release_escrow_on_delivery ON public.orders;
DROP FUNCTION IF EXISTS public.release_escrow();

CREATE UNIQUE INDEX IF NOT EXISTS seller_payouts_reference_unique
  ON public.seller_payouts (payout_reference)
  WHERE payout_reference IS NOT NULL;
