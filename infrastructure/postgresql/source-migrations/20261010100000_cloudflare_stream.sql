-- Store privacy and Cloudflare processing state for resumable Stream uploads.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS privacy text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS cloudflare_status text NOT NULL DEFAULT 'ready';

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_duration_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_duration_check
  CHECK (duration >= 0 AND duration <= 600);

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_privacy_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_privacy_check
  CHECK (privacy IN ('public', 'followers', 'private'));

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_cloudflare_status_check;
ALTER TABLE public.videos ADD CONSTRAINT videos_cloudflare_status_check
  CHECK (cloudflare_status IN ('uploading', 'processing', 'ready', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS videos_cloudflare_uid_unique
  ON public.videos(cloudflare_uid) WHERE cloudflare_uid IS NOT NULL;

DROP POLICY IF EXISTS "Videos publiees visibles par tous" ON public.videos;
CREATE POLICY "Videos visibles selon leur confidentialite"
  ON public.videos FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      is_published = true
      AND privacy = 'public'
    )
    OR (
      is_published = true
      AND privacy = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid() AND following_id = videos.user_id
      )
    )
  );
