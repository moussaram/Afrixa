-- Phase 1 / Privacy: stories and live sessions inherit account privacy and blocks.
-- Public SELECT policies must not bypass private-account or block settings.

BEGIN;

DROP POLICY IF EXISTS "Approved active stories visible to public" ON public.stories;
CREATE POLICY "Approved active stories visible to public"
  ON public.stories
  FOR SELECT
  USING (
    expires_at > now()
    AND is_archived = false
    AND moderation_status = 'approved'
    AND EXISTS (
      SELECT 1
      FROM public.public_profiles AS visible_profile
      WHERE visible_profile.user_id = stories.user_id
    )
  );

DROP POLICY IF EXISTS "Users record views of approved stories" ON public.story_views;
CREATE POLICY "Users record views of approved stories"
  ON public.story_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = viewer_id
    AND EXISTS (
      SELECT 1
      FROM public.stories AS story
      WHERE story.id = story_id
        AND story.moderation_status = 'approved'
        AND story.expires_at > now()
        AND story.is_archived = false
        AND EXISTS (
          SELECT 1
          FROM public.public_profiles AS visible_profile
          WHERE visible_profile.user_id = story.user_id
        )
    )
  );

DROP POLICY IF EXISTS "Lives publics visibles" ON public.live_sessions;
DROP POLICY IF EXISTS "Lives visibles selon confidentialité" ON public.live_sessions;
CREATE POLICY "Lives visibles selon confidentialité"
  ON public.live_sessions
  FOR SELECT
  USING (
    auth.uid() = host_id
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
    OR (
      status = 'live'
      AND EXISTS (
        SELECT 1
        FROM public.public_profiles AS visible_profile
        WHERE visible_profile.user_id = live_sessions.host_id
      )
    )
  );

COMMIT;
