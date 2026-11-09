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
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_owner_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Remove broad table grants. The client can only write profile fields intended
-- to be user-editable; verification, billing, provider IDs and timestamps stay
-- server-managed.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

GRANT INSERT (
  user_id, nom, prenom, deuxieme_prenom, date_naissance, lieu_naissance,
  profession, avatar_url, bio, username, nationalite, nationalite_flag,
  inscription_complete, is_private, who_can_comment, who_can_message,
  allow_duet, allow_stitch
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  nom, prenom, deuxieme_prenom, date_naissance, lieu_naissance,
  profession, avatar_url, bio, username, nationalite, nationalite_flag,
  inscription_complete, is_private, who_can_comment, who_can_message,
  allow_duet, allow_stitch
) ON TABLE public.profiles TO authenticated;

-- The phone stored in profiles is a mirror of Supabase Auth, not a client-editable
-- identity field. Keep it synchronized when an Auth phone is created or changed.
CREATE OR REPLACE FUNCTION public.sync_profile_phone_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT auth_user.phone
    INTO NEW.numero_mobile
    FROM auth.users AS auth_user
    WHERE auth_user.id = NEW.user_id;

  IF NOT FOUND THEN
    NEW.numero_mobile := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_phone_from_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_phone_from_auth ON public.profiles;
CREATE TRIGGER profiles_phone_from_auth
  BEFORE INSERT OR UPDATE OF user_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_from_auth();

CREATE OR REPLACE FUNCTION public.sync_profile_phone_after_auth_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
    SET numero_mobile = NEW.phone
    WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_phone_after_auth_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_phone_changed ON auth.users;
CREATE TRIGGER on_auth_user_phone_changed
  AFTER INSERT OR UPDATE OF phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_after_auth_change();

-- Prevent a client from marking an incomplete identity form as complete.
CREATE OR REPLACE FUNCTION public.validate_profile_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.inscription_complete AND (
    NULLIF(btrim(NEW.nom), '') IS NULL
    OR NULLIF(btrim(NEW.prenom), '') IS NULL
    OR NEW.date_naissance IS NULL
    OR NULLIF(btrim(NEW.lieu_naissance), '') IS NULL
    OR NULLIF(btrim(NEW.profession), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Le profil doit contenir les informations obligatoires avant validation.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_completion ON public.profiles;
CREATE TRIGGER validate_profile_completion
  BEFORE INSERT OR UPDATE OF inscription_complete, nom, prenom, date_naissance, lieu_naissance, profession
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_completion();

-- The safe projection is the only profile surface available to anonymous users.
REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

COMMENT ON TABLE public.profiles IS
  'Private account profile. Clients may read only their own row and may write only approved user-editable columns; public presentation uses public_profiles.';

COMMIT;
