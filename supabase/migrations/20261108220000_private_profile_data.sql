-- Phase 1 / Privacy: separate public profile presentation from private identity data.
-- The profiles table contains birth details, phone numbers, provider identifiers
-- and verification flags. Those fields must be readable only by the profile owner
-- (or trusted server-side service_role code).

BEGIN;

DROP POLICY IF EXISTS "Profils publics accessibles a tous" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "profile_owner_select_private" ON public.profiles;

CREATE POLICY "profile_owner_select_private"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- This owner-rights view deliberately exposes only fields intended for public
-- identity cards, search, comments and conversation headers. It omits date of
-- birth, birthplace, phone, phone operator, Google ID and verification flags.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  user_id,
  username,
  prenom,
  nom,
  avatar_url,
  bio,
  created_at
FROM public.profiles
WHERE (
  COALESCE(profiles.is_private, false) = false
  OR auth.uid() = profiles.user_id
  OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)
  OR EXISTS (
    SELECT 1
    FROM public.follows AS existing_follow
    WHERE existing_follow.follower_id = auth.uid()
      AND existing_follow.following_id = profiles.user_id
  )
)
AND (
  auth.uid() IS NULL
  OR NOT EXISTS (
    SELECT 1
    FROM public.user_blocks AS block_relation
    WHERE (block_relation.blocker_id = auth.uid() AND block_relation.blocked_id = profiles.user_id)
       OR (block_relation.blocker_id = profiles.user_id AND block_relation.blocked_id = auth.uid())
  )
);

REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Safe public profile projection. Private identity and contact fields remain available only through the owner-protected profiles table; private and blocked profiles are hidden from unauthorized viewers.';

-- A direct follow is permitted only for a public profile. Private profiles
-- must use a target-approved follow-request workflow, never a direct INSERT.
CREATE OR REPLACE FUNCTION public.is_publicly_followable(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT COALESCE(
    (SELECT NOT COALESCE(profile.is_private, false)
     FROM public.profiles AS profile
     WHERE profile.user_id = target_user_id),
    false
  );
$;

REVOKE ALL ON FUNCTION public.is_publicly_followable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_publicly_followable(uuid) TO authenticated;

DROP POLICY IF EXISTS "Utilisateur peut suivre" ON public.follows;
CREATE POLICY "Utilisateur peut suivre"
  ON public.follows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND public.is_publicly_followable(following_id)
  );

COMMIT;
