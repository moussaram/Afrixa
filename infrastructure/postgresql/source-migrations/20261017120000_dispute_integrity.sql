DROP POLICY IF EXISTS "Participants can update disputes" ON public.disputes;
DROP POLICY IF EXISTS "Buyers and sellers can create disputes" ON public.disputes;

CREATE POLICY "Buyers can open their own eligible order disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND status = 'ouvert'
    AND admin_decision IS NULL
    AND seller_evidence IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders AS order_row
      WHERE order_row.id = disputes.order_id
        AND order_row.buyer_id = auth.uid()
        AND order_row.seller_id = disputes.seller_id
        AND order_row.status IN ('payee', 'en_preparation', 'expediee', 'livree')
        AND order_row.escrow_released = false
    )
  );

CREATE POLICY "Buyer can add evidence to open dispute"
  ON public.disputes FOR UPDATE
  USING (auth.uid() = buyer_id AND status = 'ouvert')
  WITH CHECK (auth.uid() = buyer_id AND status = 'ouvert');

CREATE POLICY "Seller can add evidence to open dispute"
  ON public.disputes FOR UPDATE
  USING (auth.uid() = seller_id AND status = 'ouvert')
  WITH CHECK (auth.uid() = seller_id AND status = 'ouvert');

CREATE OR REPLACE FUNCTION public.enforce_dispute_integrity()
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

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid()
      OR NEW.status <> 'ouvert' OR NEW.admin_decision IS NOT NULL
      OR NEW.seller_evidence IS NOT NULL THEN
      RAISE EXCEPTION 'Only the buyer may open an unresolved dispute';
    END IF;

    SELECT * INTO order_row
    FROM public.orders
    WHERE id = NEW.order_id AND buyer_id = auth.uid();

    IF NOT FOUND OR order_row.seller_id IS DISTINCT FROM NEW.seller_id
      OR order_row.status NOT IN ('payee', 'en_preparation', 'expediee', 'livree')
      OR order_row.escrow_released THEN
      RAISE EXCEPTION 'This order is not eligible for a dispute';
    END IF;

    NEW.created_at := now();
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.seller_evidence IS DISTINCT FROM OLD.seller_evidence
      OR NEW.admin_decision IS DISTINCT FROM OLD.admin_decision
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Buyers may only add evidence to an open dispute';
    END IF;
  ELSIF auth.uid() = OLD.seller_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.buyer_evidence IS DISTINCT FROM OLD.buyer_evidence
      OR NEW.admin_decision IS DISTINCT FROM OLD.admin_decision
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Sellers may only add evidence to an open dispute';
    END IF;
  ELSE
    RAISE EXCEPTION 'Only dispute participants may add evidence';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispute_integrity ON public.disputes;
CREATE TRIGGER dispute_integrity
  BEFORE INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dispute_integrity();
