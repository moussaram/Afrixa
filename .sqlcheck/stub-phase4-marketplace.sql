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
