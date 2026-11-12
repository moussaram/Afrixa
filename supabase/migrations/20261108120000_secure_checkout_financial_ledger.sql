-- Afrixa: secure checkout and financial write paths.
-- Apply only after reviewing on a non-production Supabase project.

CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
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
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product is unavailable';
  END IF;

  IF product_row.seller_id = NEW.buyer_id THEN
    RAISE EXCEPTION 'A seller cannot purchase their own product';
  END IF;

  commission_rate_value := CASE WHEN COALESCE(product_row.is_group_buy, false) THEN 0.03 ELSE 0.05 END;

  IF NOT COALESCE(product_row.unlimited_stock, false) THEN
    IF COALESCE(product_row.stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock';
    END IF;
    UPDATE public.products
    SET stock = stock - NEW.quantity,
        updated_at = now()
    WHERE id = product_row.id;
  END IF;

  effective_price := CASE
    WHEN product_row.promo_price IS NOT NULL
      AND product_row.promo_price > 0
      AND product_row.promo_price < product_row.price
    THEN product_row.promo_price
    ELSE product_row.price
  END;

  NEW.seller_id := product_row.seller_id;
  NEW.product_name := product_row.name;
  NEW.product_image := product_row.images[1];
  NEW.unit_price := effective_price;
  NEW.total_price := effective_price * NEW.quantity;
  NEW.commission_rate := commission_rate_value;
  NEW.commission_amount := round(NEW.total_price * commission_rate_value)::integer;
  NEW.seller_amount := NEW.total_price - NEW.commission_amount;
  NEW.status := 'en_attente';
  NEW.escrow_released := false;
  NEW.dispute_reason := NULL;
  NEW.auto_confirm_date := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_order_checkout_integrity ON public.orders;
DROP TRIGGER IF EXISTS enforce_order_checkout_integrity ON public.orders;
CREATE TRIGGER a_order_checkout_integrity
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_checkout_integrity();


-- Release stock only when a reserved, unpaid order is cancelled. The transition
-- guard makes the operation idempotent and keeps stock restoration atomic.
CREATE OR REPLACE FUNCTION public.restore_order_stock_after_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'en_attente' AND NEW.status = 'annulee'
    AND NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = COALESCE(stock, 0) + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id
      AND COALESCE(unlimited_stock, false) = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restore_order_stock_after_cancellation ON public.orders;
CREATE TRIGGER restore_order_stock_after_cancellation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_order_stock_after_cancellation();

-- Keep an append-only status history. Clients have no direct INSERT policy;
-- this trigger records only actual database transitions.
CREATE OR REPLACE FUNCTION public.append_order_timeline_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_message := 'Commande créée, en attente de paiement';
  ELSE
    event_message := CASE NEW.status
      WHEN 'payee' THEN 'Paiement confirmé'
      WHEN 'en_preparation' THEN 'Le vendeur prépare la commande'
      WHEN 'expediee' THEN 'Commande expédiée'
      WHEN 'livree' THEN 'Livraison confirmée'
      WHEN 'terminee' THEN 'Commande terminée'
      WHEN 'annulee' THEN 'Commande annulée'
      WHEN 'litige' THEN 'Un litige a été ouvert'
      ELSE 'Statut de commande mis à jour'
    END;
  END IF;

  INSERT INTO public.order_timeline(order_id, status, message)
  VALUES (NEW.id, NEW.status, event_message);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_status_change ON public.orders;
DROP TRIGGER IF EXISTS append_order_timeline_event ON public.orders;
DROP TRIGGER IF EXISTS append_order_timeline_on_insert ON public.orders;
DROP TRIGGER IF EXISTS append_order_timeline_on_status_update ON public.orders;
CREATE TRIGGER append_order_timeline_on_insert
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.append_order_timeline_event();
CREATE TRIGGER append_order_timeline_on_status_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.append_order_timeline_event();

-- Buyers and sellers must not edit financial amounts, ownership, status or escrow
-- directly. Trusted Edge Functions use the service_role key on the server.
DROP POLICY IF EXISTS "Buyers and sellers can update their orders" ON public.orders;

-- A participant must not forge timeline events or status history.
DROP POLICY IF EXISTS "System can insert timeline entries" ON public.order_timeline;

-- Commission splits and commission rows are accounting records, not client input.
DROP POLICY IF EXISTS "Buyers can create splits" ON public.commission_splits;
DROP POLICY IF EXISTS "Commissions can be inserted by order participants" ON public.commissions;

-- Payment transaction state changes are webhook/server responsibilities.
DROP POLICY IF EXISTS "Participants can update transactions" ON public.payment_transactions;

-- A user's wallet row may be initialized, but its balance can never be self-funded.
CREATE OR REPLACE FUNCTION public.protect_coin_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Wallet owner mismatch';
    END IF;
    NEW.balance := 0;
    NEW.lifetime_earned := 0;
    NEW.lifetime_spent := 0;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Wallet balances can only be changed by trusted server workflows';
END;
$$;

DROP TRIGGER IF EXISTS protect_coin_balance_before_write ON public.coin_balances;
CREATE TRIGGER protect_coin_balance_before_write
BEFORE INSERT OR UPDATE ON public.coin_balances
FOR EACH ROW EXECUTE FUNCTION public.protect_coin_balance();

-- User-submitted coin purchase requests may only start pending; confirmation is
-- exclusively performed by a verified provider webhook.
CREATE OR REPLACE FUNCTION public.protect_coin_purchase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Coin purchase status is server-managed';
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Coin purchase owner mismatch';
  END IF;
  IF NEW.coins_amount <= 0 OR NEW.fcfa_paid <= 0 THEN
    RAISE EXCEPTION 'Coin purchase amounts must be positive';
  END IF;

  NEW.status := 'pending';
  NEW.fedapay_ref := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_coin_purchase_before_write ON public.coin_purchases;
CREATE TRIGGER protect_coin_purchase_before_write
BEFORE INSERT OR UPDATE ON public.coin_purchases
FOR EACH ROW EXECUTE FUNCTION public.protect_coin_purchase();

-- Immutable, idempotent accounting journal. No client-side write policy exists.
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN (
    'payment_received', 'commission_charged', 'seller_payable',
    'refund_issued', 'payout_sent', 'coin_purchase', 'coin_spent',
    'coin_received', 'adjustment'
  )),
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'XOF',
  provider text,
  provider_reference text,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_ledger_user_created_idx
  ON public.financial_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_ledger_order_idx
  ON public.financial_ledger(order_id, created_at DESC);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own financial ledger" ON public.financial_ledger;
CREATE POLICY "Users can read their own financial ledger"
  ON public.financial_ledger FOR SELECT
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.financial_ledger FROM anon, authenticated;
GRANT SELECT ON public.financial_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Financial ledger entries are immutable';
END;
$$;

DROP TRIGGER IF EXISTS financial_ledger_immutable ON public.financial_ledger;
CREATE TRIGGER financial_ledger_immutable
BEFORE UPDATE OR DELETE ON public.financial_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

-- Generic client-side transaction rows cannot be used to credit wallets.
DROP POLICY IF EXISTS "Utilisateur cree ses transactions" ON public.transactions;
