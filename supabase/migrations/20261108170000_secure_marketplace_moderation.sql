-- Secure creator and seller publication. New marketplace content remains
-- private until an administrator explicitly approves it through a server action.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';

UPDATE public.products
SET moderation_status = 'approved'
WHERE is_active = true AND publication_status = 'published';

ALTER TABLE public.products
  ALTER COLUMN moderation_status SET DEFAULT 'pending',
  DROP CONSTRAINT IF EXISTS products_moderation_status_check,
  ADD CONSTRAINT products_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')) NOT VALID;

CREATE INDEX IF NOT EXISTS products_moderation_queue_idx
  ON public.products(moderation_status, created_at DESC)
  WHERE moderation_status = 'pending';

CREATE OR REPLACE FUNCTION public.protect_product_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  content_changed boolean;
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.publication_status := 'draft';
    NEW.is_active := false;
    RETURN NEW;
  END IF;

  content_changed :=
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.images IS DISTINCT FROM OLD.images
    OR NEW.product_type IS DISTINCT FROM OLD.product_type;

  IF content_changed THEN
    NEW.moderation_status := 'pending';
    NEW.publication_status := 'draft';
    NEW.is_active := false;
  ELSE
    NEW.moderation_status := OLD.moderation_status;
    NEW.publication_status := OLD.publication_status;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_product_moderation ON public.products;
CREATE TRIGGER protect_product_moderation
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.protect_product_moderation();

DROP POLICY IF EXISTS "Public catalog and owner product access" ON public.products;
CREATE POLICY "Approved public catalog and owner product access"
  ON public.products FOR SELECT
  USING (
    (is_active = true AND publication_status = 'published'
      AND moderation_status = 'approved' AND deleted_at IS NULL)
    OR auth.uid() = seller_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false))
  );

DROP POLICY IF EXISTS "Admins review pending products" ON public.products;
CREATE POLICY "Admins review pending products"
  ON public.products FOR SELECT
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- A creator cannot mark a video approved or public from a browser session.
CREATE OR REPLACE FUNCTION public.protect_video_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  content_changed boolean;
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.is_published := false;
    RETURN NEW;
  END IF;

  content_changed :=
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url
    OR NEW.hls_url IS DISTINCT FROM OLD.hls_url
    OR NEW.tagged_products IS DISTINCT FROM OLD.tagged_products;

  IF content_changed THEN
    NEW.moderation_status := 'pending';
    NEW.is_published := false;
  ELSE
    NEW.moderation_status := OLD.moderation_status;
    NEW.is_published := OLD.is_published;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_video_publication ON public.videos;
CREATE TRIGGER protect_video_publication
BEFORE INSERT OR UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.protect_video_publication();

DROP POLICY IF EXISTS "Videos publiees visibles par tous" ON public.videos;
CREATE POLICY "Approved videos visible to public"
  ON public.videos FOR SELECT
  USING (
    (is_published = true AND moderation_status = 'approved')
    OR auth.uid() = user_id
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content_type text NOT NULL CHECK (content_type IN ('product', 'video')),
  content_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_decisions_content_idx
  ON public.moderation_decisions(content_type, content_id, created_at DESC);
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read moderation decisions"
  ON public.moderation_decisions FOR SELECT
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

