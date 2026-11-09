-- Protect private profile data while keeping a minimal public identity projection.
-- The base table contains phone numbers, birth details and other private fields.

DROP POLICY IF EXISTS "Profils publics accessibles a tous" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_select" ON public.profiles;
DROP POLICY IF EXISTS "Utilisateur peut modifier son profil" ON public.profiles;
DROP POLICY IF EXISTS "Utilisateur peut creer son profil" ON public.profiles;

CREATE POLICY "profiles_owner_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_owner_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Public identity fields only; the view owner can read the base table,
-- while callers cannot use this view to retrieve private profile columns.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT user_id, username, prenom, nom, avatar_url, bio, is_private, created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
