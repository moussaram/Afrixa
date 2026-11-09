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
FROM public.profiles
WHERE COALESCE(is_private, false) = false OR user_id = auth.uid();

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Subscription status is server-managed and must never be self-assigned by a client.
CREATE OR REPLACE FUNCTION public.protect_profile_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.is_premium IS DISTINCT FROM OLD.is_premium
    OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
  ) THEN
    RAISE EXCEPTION 'Profile subscription fields are server-managed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_entitlements ON public.profiles;
CREATE TRIGGER profiles_protect_entitlements
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_entitlements();
