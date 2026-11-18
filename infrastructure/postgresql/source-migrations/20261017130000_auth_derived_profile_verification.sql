-- Verification status must be derived from Supabase Auth confirmation data.
-- Profile clients may edit their profile, but cannot claim a verified phone/email.

CREATE OR REPLACE FUNCTION public.set_profile_verification_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(auth_user.phone_confirmed_at IS NOT NULL, false),
    COALESCE(auth_user.email_confirmed_at IS NOT NULL, false)
  INTO NEW.mobile_verifie, NEW.email_verifie
  FROM auth.users AS auth_user
  WHERE auth_user.id = NEW.user_id;

  IF NOT FOUND THEN
    NEW.mobile_verifie := false;
    NEW.email_verifie := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_verification_from_auth ON public.profiles;
CREATE TRIGGER profiles_verification_from_auth
  BEFORE INSERT OR UPDATE OF user_id, mobile_verifie, email_verifie
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_verification_from_auth();

CREATE OR REPLACE FUNCTION public.sync_profile_verification_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO UPDATE
    SET mobile_verifie = EXCLUDED.mobile_verifie,
        email_verifie = EXCLUDED.email_verifie;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_verification_changed ON auth.users;
CREATE TRIGGER on_auth_user_verification_changed
  AFTER INSERT OR UPDATE OF phone_confirmed_at, email_confirmed_at
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_verification_from_auth();

-- Reconcile existing profile flags with the authoritative auth.users values.
UPDATE public.profiles AS profile
SET mobile_verifie = COALESCE(auth_user.phone_confirmed_at IS NOT NULL, false),
    email_verifie = COALESCE(auth_user.email_confirmed_at IS NOT NULL, false)
FROM auth.users AS auth_user
WHERE auth_user.id = profile.user_id;
