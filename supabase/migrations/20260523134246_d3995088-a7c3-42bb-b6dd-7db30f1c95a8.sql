-- payment_transactions
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  flutterwave_tx_id text,
  flutterwave_ref text NOT NULL UNIQUE,
  amount integer NOT NULL,
  commission_amount integer NOT NULL DEFAULT 0,
  seller_amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XOF',
  operator text,
  buyer_phone text,
  status text NOT NULL DEFAULT 'initiated',
  flutterwave_response jsonb,
  escrow_status text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_tx_order ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_tx_ref ON public.payment_transactions(flutterwave_ref);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can view transactions"
ON public.payment_transactions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.orders o
  WHERE o.id = payment_transactions.order_id
  AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));

CREATE POLICY "Buyers can create transactions"
ON public.payment_transactions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o
  WHERE o.id = payment_transactions.order_id
  AND o.buyer_id = auth.uid()));

CREATE POLICY "Participants can update transactions"
ON public.payment_transactions FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.orders o
  WHERE o.id = payment_transactions.order_id
  AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));

CREATE TRIGGER update_payment_tx_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- commission_splits
CREATE TABLE public.commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  afrixa_amount integer NOT NULL,
  seller_amount integer NOT NULL,
  split_type text NOT NULL DEFAULT 'normale',
  split_rate double precision NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_splits_tx ON public.commission_splits(transaction_id);

ALTER TABLE public.commission_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can view splits"
ON public.commission_splits FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.id = commission_splits.transaction_id
  AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
));

CREATE POLICY "Buyers can create splits"
ON public.commission_splits FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.id = commission_splits.transaction_id
  AND o.buyer_id = auth.uid()
));