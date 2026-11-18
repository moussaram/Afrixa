DROP POLICY IF EXISTS "creator_program_own_all" ON public.creator_program;

CREATE POLICY "creator_program_owner_insert"
  ON public.creator_program FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "creator_program_owner_update"
  ON public.creator_program FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_creator_program_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_followers integer;
  caller_role text := coalesce(auth.role(), '');
BEGIN
  IF caller_role <> 'service_role' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Creator program rows may only be changed by their owner';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*)::integer INTO actual_followers
    FROM public.follows
    WHERE following_id = NEW.user_id;

    IF actual_followers < 500 THEN
      RAISE EXCEPTION 'At least 500 followers are required to join the creator program';
    END IF;

    NEW.followers_at_join := actual_followers;
    NEW.level := CASE
      WHEN actual_followers >= 500000 THEN 'elite'
      WHEN actual_followers >= 50000 THEN 'verified'
      WHEN actual_followers >= 5000 THEN 'rising'
      ELSE 'starter'
    END;
    NEW.is_active := true;
    RETURN NEW;
  END IF;

  IF caller_role <> 'service_role' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.level IS DISTINCT FROM OLD.level
      OR NEW.followers_at_join IS DISTINCT FROM OLD.followers_at_join
      OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
      RAISE EXCEPTION 'Creator program level and join details are managed by Afrixa';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_program_integrity ON public.creator_program;
CREATE TRIGGER creator_program_integrity
  BEFORE INSERT OR UPDATE ON public.creator_program
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_program_integrity();
