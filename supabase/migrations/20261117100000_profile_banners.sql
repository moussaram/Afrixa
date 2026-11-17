-- Persistent profile cover images with owner-scoped Storage writes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS banner_path text,
  ADD COLUMN IF NOT EXISTS banner_position text NOT NULL DEFAULT '50% 50%';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_banner_position_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_banner_position_check
  CHECK (banner_position ~ '^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-banners', 'profile-banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Profile banners are publicly readable" ON storage.objects;
CREATE POLICY "Profile banners are publicly readable"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'profile-banners');

DROP POLICY IF EXISTS "Users upload their own profile banners" ON storage.objects;
CREATE POLICY "Users upload their own profile banners"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users replace their own profile banners" ON storage.objects;
CREATE POLICY "Users replace their own profile banners"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete their own profile banners" ON storage.objects;
CREATE POLICY "Users delete their own profile banners"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-banners' AND (storage.foldername(name))[1] = auth.uid()::text);
