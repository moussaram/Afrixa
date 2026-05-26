-- PRODUCTS TABLE
CREATE TABLE public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  promo_price INTEGER,
  stock INTEGER DEFAULT 0,
  unlimited_stock BOOLEAN DEFAULT false,
  images TEXT[] DEFAULT '{}',
  city TEXT,
  country TEXT,
  delivery_delay TEXT DEFAULT '3-5 jours',
  delivery_fee INTEGER DEFAULT 0,
  is_group_buy BOOLEAN DEFAULT false,
  group_price_5 INTEGER,
  group_price_10 INTEGER,
  group_duration TEXT,
  is_featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produits actifs visibles publiquement"
  ON public.products FOR SELECT
  USING (is_active = true OR auth.uid() = seller_id);

CREATE POLICY "Vendeur peut créer ses produits"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Vendeur peut modifier ses produits"
  ON public.products FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Vendeur peut supprimer ses produits"
  ON public.products FOR DELETE
  USING (auth.uid() = seller_id);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_products_seller ON public.products(seller_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active = true;

-- HELP MESSAGES TABLE
CREATE TABLE public.help_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_lu',
  admin_reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.help_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur envoie ses messages d'aide"
  ON public.help_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur voit ses messages d'aide"
  ON public.help_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_help_messages_updated_at
  BEFORE UPDATE ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS: add reference_id column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read);