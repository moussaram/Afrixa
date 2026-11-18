-- FedaPay replaces the previous marketplace payment provider. Preserve IDs
-- and transaction history while changing provider-specific column names.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='flutterwave_ref')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='fedapay_ref') THEN
    ALTER TABLE public.payment_transactions RENAME COLUMN flutterwave_ref TO fedapay_ref;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='flutterwave_tx_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='fedapay_transaction_id') THEN
    ALTER TABLE public.payment_transactions RENAME COLUMN flutterwave_tx_id TO fedapay_transaction_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='flutterwave_response')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_transactions' AND column_name='fedapay_response') THEN
    ALTER TABLE public.payment_transactions RENAME COLUMN flutterwave_response TO fedapay_response;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='premium_subscriptions' AND column_name='flutterwave_sub_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='premium_subscriptions' AND column_name='fedapay_sub_id') THEN
    ALTER TABLE public.premium_subscriptions RENAME COLUMN flutterwave_sub_id TO fedapay_sub_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='coin_purchases' AND column_name='flutterwave_ref')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='coin_purchases' AND column_name='fedapay_ref') THEN
    ALTER TABLE public.coin_purchases RENAME COLUMN flutterwave_ref TO fedapay_ref;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fan_club_memberships' AND column_name='flutterwave_subscription_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fan_club_memberships' AND column_name='fedapay_subscription_id') THEN
    ALTER TABLE public.fan_club_memberships RENAME COLUMN flutterwave_subscription_id TO fedapay_subscription_id;
  END IF;
END;
$$;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS fedapay_payment_ref text;

ALTER TABLE public.seller_payouts
  ADD COLUMN IF NOT EXISTS fedapay_transfer_id text,
  ADD COLUMN IF NOT EXISTS fedapay_transfer_ref text,
  ADD COLUMN IF NOT EXISTS fedapay_response jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS numero_mobile_operateur text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_numero_mobile_operateur_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_numero_mobile_operateur_check CHECK (
  numero_mobile_operateur IS NULL OR numero_mobile_operateur IN (
    'mtn_open', 'moov', 'sbin', 'mtn_ci', 'moov_tg', 'togocel', 'orange-bf',
    'moov_bf', 'mtn_open_gn', 'moov_ci', 'wave_ci', 'orange_ci', 'wave_sn', 'orange_sn'
  )
);

-- Keep the server-side transaction guard valid after renaming the provider field.
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for this buyer'; END IF;
  IF order_row.status <> 'en_attente'
    OR NEW.fedapay_ref IS DISTINCT FROM order_row.payment_reference THEN
    RAISE EXCEPTION 'Payment reference is not valid for this order';
  END IF;

  NEW.amount := order_row.total_price;
  NEW.commission_amount := order_row.commission_amount;
  NEW.seller_amount := order_row.seller_amount;
  NEW.currency := 'XOF';
  NEW.status := 'initiated';
  NEW.fedapay_transaction_id := NULL;
  NEW.fedapay_payment_ref := NULL;
  NEW.fedapay_response := NULL;
  NEW.escrow_status := 'held';
  RETURN NEW;
END;
$$;
