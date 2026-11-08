-- Create the FedaPay payment intent in the same database transaction as
-- the order and stock reservation. The existing payment integrity trigger
-- derives amount, commission, seller amount and reference from the order.
CREATE OR REPLACE FUNCTION public.create_payment_intent_for_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_transactions (
    order_id,
    fedapay_ref,
    amount,
    commission_amount,
    seller_amount,
    currency,
    operator,
    buyer_phone,
    status,
    escrow_status
  ) VALUES (
    NEW.id,
    NEW.payment_reference,
    NEW.total_price,
    NEW.commission_amount,
    NEW.seller_amount,
    NEW.currency,
    NEW.payment_operator,
    NEW.buyer_phone,
    'initiated',
    'held'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_payment_intent_for_order ON public.orders;
CREATE TRIGGER create_payment_intent_for_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.create_payment_intent_for_order();
