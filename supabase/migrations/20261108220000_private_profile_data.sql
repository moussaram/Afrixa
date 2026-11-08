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

REVOKE SELECT ON TABLE public.profiles FROM anon;
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
FROM public.profiles;

REVOKE ALL ON TABLE public.public_profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Safe public profile projection. Private identity and contact fields remain available only through the owner-protected profiles table.';

COMMIT;
