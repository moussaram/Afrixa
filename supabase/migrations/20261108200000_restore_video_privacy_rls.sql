-- Phase 1 / Security: restore video privacy after the moderation policy migration.
-- The previous moderation policy accidentally made every approved, published
-- video visible regardless of its privacy setting.
BEGIN;

DROP POLICY IF EXISTS "Videos publiees visibles par tous" ON public.videos;
DROP POLICY IF EXISTS "Videos visibles selon leur confidentialite" ON public.videos;
DROP POLICY IF EXISTS "Approved videos visible to public" ON public.videos;
DROP POLICY IF EXISTS "Videos visibles selon leur confidentialite v2" ON public.videos;

CREATE POLICY "Videos visibles selon leur confidentialite v2"
  ON public.videos
  FOR SELECT
  USING (
    -- Owners can always inspect their own uploads, including drafts and rejected items.
    auth.uid() = user_id

    -- Administrators can review content regardless of publication/privacy state.
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)

    -- Public content must be both published and approved.
    OR (
      is_published = true
      AND moderation_status = 'approved'
      AND privacy = 'public'
    )

    -- Followers-only content is visible only to authenticated followers.
    OR (
      is_published = true
      AND moderation_status = 'approved'
      AND privacy = 'followers'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.follows AS follow_relation
        WHERE follow_relation.follower_id = auth.uid()
          AND follow_relation.following_id = videos.user_id
      )
    )
    -- privacy = 'private' intentionally has no non-owner access branch.
  );

COMMENT ON POLICY "Videos visibles selon leur confidentialite v2" ON public.videos
  IS 'Owners and admins can review videos; public and followers-only videos require approval and publication; private videos remain owner-only.';

COMMIT;
