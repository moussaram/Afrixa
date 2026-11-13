ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auto_confirm_date timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Autre',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  buyer_evidence text,
  seller_evidence text,
  admin_decision text,
  status text NOT NULL DEFAULT 'ouvert',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
CREATE POLICY "Buyers can create reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
CREATE POLICY orders_participant_select ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY orders_buyer_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY orders_participant_update ON public.orders
  FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
CREATE POLICY "Dispute participants can view" ON public.disputes
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyers can open their own eligible order disputes" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id AND status = 'ouvert' AND admin_decision IS NULL AND seller_evidence IS NULL);
CREATE POLICY "Buyer can add evidence to open dispute" ON public.disputes
  FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id AND status = 'ouvert')
  WITH CHECK (auth.uid() = buyer_id AND status = 'ouvert');
CREATE POLICY "Seller can add evidence to open dispute" ON public.disputes
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id AND status = 'ouvert')
  WITH CHECK (auth.uid() = seller_id AND status = 'ouvert');
