-- Marketplace escrow release: immutable seller wallet credits after buyer confirmation.
-- This migration is committed to the feature branch only; it is not applied to any hosted database.

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

DROP POLICY IF EXISTS seller_wallet_ledger_owner_read ON public.seller_wallet_ledger;
CREATE POLICY seller_wallet_ledger_owner_read
  ON public.seller_wallet_ledger FOR SELECT
  TO authenticated
  USING (seller_id = (SELECT auth.uid()));

REVOKE ALL ON public.seller_wallet_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seller_wallet_ledger TO authenticated;
GRANT SELECT, INSERT ON public.seller_wallet_ledger TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_seller_wallet_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Le journal du portefeuille vendeur est immuable';
END;
$$;

DROP TRIGGER IF EXISTS seller_wallet_ledger_append_only ON public.seller_wallet_ledger;
CREATE TRIGGER seller_wallet_ledger_append_only
  BEFORE UPDATE OR DELETE ON public.seller_wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_wallet_ledger_mutation();

-- This RPC is callable only by service_role. The Edge Function authenticates the
-- buyer first, then passes the verified buyer ID. The order, payment, dispute,
-- ledger and notification changes are committed in one database transaction.
CREATE OR REPLACE FUNCTION public.release_marketplace_order(
  p_order_id uuid,
  p_buyer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Operation reservee au serveur Afrixa';
  END IF;

  IF p_order_id IS NULL OR p_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Commande ou acheteur invalide';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.buyer_id <> p_buyer_id THEN
    RAISE EXCEPTION 'Commande introuvable pour cet acheteur';
  END IF;

  IF v_order.escrow_released THEN
    RETURN jsonb_build_object('released', true, 'duplicate', true, 'order_id', v_order.id);
  END IF;

  IF v_order.status <> 'expediee' THEN
    RAISE EXCEPTION 'La commande doit etre expediee avant confirmation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.disputes d
    WHERE d.order_id = v_order.id AND d.status = 'ouvert'
  ) THEN
    RAISE EXCEPTION 'Un litige ouvert bloque la liberation des fonds';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE order_id = v_order.id
  FOR UPDATE;

  IF NOT FOUND OR v_payment.status <> 'successful'
    OR v_payment.escrow_status <> 'held'
    OR v_payment.amount <> v_order.total_price
    OR v_payment.seller_amount <> v_order.seller_amount THEN
    RAISE EXCEPTION 'Le paiement ne peut pas etre libere';
  END IF;

  UPDATE public.orders
  SET status = 'terminee',
      escrow_released = true,
      buyer_confirmed_at = now(),
      released_at = now()
  WHERE id = v_order.id;

  UPDATE public.payment_transactions
  SET escrow_status = 'released'
  WHERE id = v_payment.id;

  INSERT INTO public.seller_wallet_ledger (
    seller_id, order_id, amount, currency, entry_type, idempotency_key, metadata
  )
  VALUES (
    v_order.seller_id,
    v_order.id,
    v_order.seller_amount,
    'XOF',
    'order_release_credit',
    'marketplace-order-release:' || v_order.id::text,
    jsonb_build_object(
      'gross_amount', v_order.total_price,
      'commission_amount', v_order.commission_amount,
      'commission_rate', v_order.commission_rate
    )
  )
  ON CONFLICT (order_id, entry_type) DO NOTHING;

  UPDATE public.commission_splits
  SET status = 'percue'
  WHERE transaction_id = v_payment.id AND status <> 'percue';

  INSERT INTO public.notifications (user_id, title, message, type, order_id)
  VALUES (
    v_order.seller_id,
    'Paiement disponible',
    'L’acheteur a confirmé la réception. Le montant net de cette commande est maintenant disponible dans votre portefeuille Afrixa.',
    'order',
    v_order.id
  );

  RETURN jsonb_build_object(
    'released', true,
    'duplicate', false,
    'order_id', v_order.id,
    'seller_amount', v_order.seller_amount,
    'currency', 'XOF'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_marketplace_order(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_marketplace_order(uuid, uuid) TO service_role;
