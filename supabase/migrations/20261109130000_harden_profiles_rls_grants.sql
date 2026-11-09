-- Phase 1 hardening: make profile access owner-only at both the ACL and RLS layers.
-- Public profile cards must use public_profiles, never the private base table.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove legacy/public policies and recreate the three owner-only operations.
DROP POLICY IF EXISTS "Profils publics accessibles a tous" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
DROP POLICY IF EXISTS "profile_owner_select_private" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS "Utilisateur peut creer son profil" ON public.profiles;
DROP POLICY IF EXISTS "Utilisateur peut modifier son profil" ON public.profiles;

CREATE POLICY "profiles_owner_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_owner_insert"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_owner_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Do not rely on RLS alone: remove broad table grants, then grant only the
-- columns the client is allowed to create or edit. Verification, entitlement,
-- provider identifiers and timestamps remain server-managed.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;

GRANT INSERT (
  user_id,
  nom,
  prenom,
  deuxieme_prenom,
  date_naissance,
  lieu_naissance,
  profession,
  numero_mobile,
  avatar_url,
  bio,
  username,
  nationalite,
  nationalite_flag,
  inscription_complete,
  is_private,
  who_can_comment,
  who_can_message,
  allow_duet,
  allow_stitch
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  nom,
  prenom,
  deuxieme_prenom,
  date_naissance,
  lieu_naissance,
  profession,
  numero_mobile,
  avatar_url,
  bio,
  username,
  nationalite,
  nationalite_flag,
  inscription_complete,
  is_private,
  who_can_comment,
  who_can_message,
  allow_duet,
  allow_stitch
) ON TABLE public.profiles TO authenticated;

-- The projection is the only profile surface available to anonymous visitors.
REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

COMMENT ON TABLE public.profiles IS
  'Private account profile. Clients may read only their own row and may write only approved user-editable columns; public presentation uses public_profiles.';

COMMIT;
