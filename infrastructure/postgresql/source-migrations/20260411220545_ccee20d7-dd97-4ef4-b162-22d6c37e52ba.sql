
-- Create orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  product_image text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price integer NOT NULL,
  total_price integer NOT NULL,
  commission_rate float NOT NULL DEFAULT 0.05,
  commission_amount integer NOT NULL DEFAULT 0,
  seller_amount integer NOT NULL DEFAULT 0,
  payment_operator text,
  buyer_phone text,
  delivery_address text,
  buyer_note text,
  status text NOT NULL DEFAULT 'en_attente',
  payment_reference text,
  escrow_released boolean NOT NULL DEFAULT false,
  dispute_reason text,
  auto_confirm_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers and sellers can update their orders"
ON public.orders FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create order_timeline table
CREATE TABLE public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view timeline of their orders"
ON public.order_timeline FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_timeline.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
);

CREATE POLICY "System can insert timeline entries"
ON public.order_timeline FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_timeline.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
);

-- Create commissions table
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  rate float NOT NULL,
  type text NOT NULL DEFAULT 'normale',
  status text NOT NULL DEFAULT 'en_attente',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only system can manage commissions"
ON public.commissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = commissions.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
);

CREATE POLICY "Commissions can be inserted by order participants"
ON public.commissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = commissions.order_id
    AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
  )
);

-- Create seller_payouts table
CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  operator text,
  phone text,
  status text NOT NULL DEFAULT 'en_attente',
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their payouts"
ON public.seller_payouts FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can request payouts"
ON public.seller_payouts FOR INSERT
WITH CHECK (auth.uid() = seller_id);

-- Create disputes table
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  reason text NOT NULL,
  buyer_evidence text,
  seller_evidence text,
  admin_decision text,
  status text NOT NULL DEFAULT 'ouvert',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispute participants can view"
ON public.disputes FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers and sellers can create disputes"
ON public.disputes FOR INSERT
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Participants can update disputes"
ON public.disputes FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Create reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are public"
ON public.reviews FOR SELECT
USING (true);

CREATE POLICY "Buyers can create reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Function: calculate commission on order insert
CREATE OR REPLACE FUNCTION public.calculate_order_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_price := NEW.unit_price * NEW.quantity;
  NEW.commission_amount := ROUND(NEW.total_price * NEW.commission_rate);
  NEW.seller_amount := NEW.total_price - NEW.commission_amount;
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_commission_before_insert
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.calculate_order_commission();

CREATE TRIGGER calculate_commission_before_update
BEFORE UPDATE OF unit_price, quantity, commission_rate ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.calculate_order_commission();

-- Function: record status changes in timeline
CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_message text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'en_attente' THEN status_message := 'Commande créée';
      WHEN 'payee' THEN status_message := 'Paiement confirmé';
      WHEN 'en_preparation' THEN status_message := 'Le vendeur prépare votre commande';
      WHEN 'expediee' THEN status_message := 'Commande expédiée';
      WHEN 'livree' THEN status_message := 'Livraison confirmée';
      WHEN 'terminee' THEN status_message := 'Commande terminée';
      WHEN 'litige' THEN status_message := 'Litige ouvert';
      WHEN 'annulee' THEN status_message := 'Commande annulée';
      ELSE status_message := 'Statut mis à jour';
    END CASE;

    INSERT INTO public.order_timeline (order_id, status, message)
    VALUES (NEW.id, NEW.status, status_message);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_change();

-- Function: release escrow when delivered
CREATE OR REPLACE FUNCTION public.release_escrow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'livree' AND NEW.escrow_released = false THEN
    -- Mark escrow as released
    NEW.escrow_released := true;

    -- Create commission entry
    INSERT INTO public.commissions (order_id, amount, rate, type, status)
    VALUES (NEW.id, NEW.commission_amount, NEW.commission_rate, 'normale', 'percue');

    -- Create seller payout entry
    INSERT INTO public.seller_payouts (seller_id, order_id, amount, operator, phone, status)
    VALUES (NEW.seller_id, NEW.id, NEW.seller_amount, NEW.payment_operator, '', 'en_attente');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER release_escrow_on_delivery
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_escrow();

-- Insert initial timeline entry on order creation
CREATE OR REPLACE FUNCTION public.record_order_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.order_timeline (order_id, status, message)
  VALUES (NEW.id, NEW.status, 'Commande créée');
  RETURN NEW;
END;
$$;

CREATE TRIGGER record_order_creation
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_creation();

-- Enable realtime for orders and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
