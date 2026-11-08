-- Phase 1 / Security: restore video privacy after the moderation policy migration.
-- The previous moderation policy accidentally made every approved, published
-- video visible regardless of its privacy setting.
BEGIN;

-- Used by RLS to respect account-level privacy without exposing private
-- profile columns to other users.
CREATE OR REPLACE FUNCTION public.is_publicly_followable(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (SELECT NOT COALESCE(profile.is_private, false)
     FROM public.profiles AS profile
     WHERE profile.user_id = target_user_id),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.is_publicly_followable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_publicly_followable(uuid) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.are_users_blocked(first_user_id uuid, second_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN first_user_id IS NULL OR second_user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_blocks AS block_relation
      WHERE (block_relation.blocker_id = first_user_id AND block_relation.blocked_id = second_user_id)
         OR (block_relation.blocker_id = second_user_id AND block_relation.blocked_id = first_user_id)
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.are_users_blocked(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_users_blocked(uuid, uuid) TO anon, authenticated;

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
      AND public.is_publicly_followable(user_id)
      AND NOT public.are_users_blocked(auth.uid(), user_id)
    )

    -- Followers-only videos and videos from private accounts are visible
    -- only to authenticated followers.
    OR (
      is_published = true
      AND moderation_status = 'approved'
      AND (
        privacy = 'followers'
        OR (privacy = 'public' AND NOT public.is_publicly_followable(user_id))
      )
      AND auth.uid() IS NOT NULL
      AND NOT public.are_users_blocked(auth.uid(), user_id)
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
