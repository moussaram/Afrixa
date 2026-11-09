-- Phase 1 / Social privacy: expose only safe profile cards and complete private follow requests.

BEGIN;

-- Authenticated users may discover a private account's safe identity card and
-- request access; anonymous visitors still see public accounts only.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  user_id,
  username,
  prenom,
  nom,
  avatar_url,
  CASE
    WHEN COALESCE(profiles.is_private, false) = false OR auth.uid() = profiles.user_id
      THEN bio
    ELSE NULL
  END AS bio,
  COALESCE(profiles.is_private, false) AS is_private,
  created_at
FROM public.profiles
WHERE
  (auth.uid() IS NOT NULL OR COALESCE(profiles.is_private, false) = false)
  AND (
    auth.uid() IS NULL
    OR NOT public.are_users_blocked(auth.uid(), profiles.user_id)
  );

REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Safe profile card. Authenticated viewers can discover private accounts to request access; private bios and all sensitive identity fields remain hidden. Blocked users cannot see one another.';

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_requests_participants_select" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_requester_insert" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_target_update" ON public.follow_requests;
DROP POLICY IF EXISTS "follow_requests_requester_delete" ON public.follow_requests;

CREATE POLICY "follow_requests_participants_select"
  ON public.follow_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "follow_requests_requester_insert"
  ON public.follow_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> target_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS target_profile
      WHERE target_profile.user_id = target_id
        AND COALESCE(target_profile.is_private, false) = true
    )
    AND NOT public.are_users_blocked(requester_id, target_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.follows AS existing_follow
      WHERE existing_follow.follower_id = requester_id
        AND existing_follow.following_id = target_id
    )
  );

CREATE POLICY "follow_requests_target_update"
  ON public.follow_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = target_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = target_id
    AND status IN ('accepted', 'declined')
  );

CREATE POLICY "follow_requests_requester_delete"
  ON public.follow_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id AND status = 'pending');

REVOKE ALL PRIVILEGES ON TABLE public.follow_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.follow_requests TO authenticated;

-- A recipient may only accept or decline a pending request; request identity
-- and ownership cannot be rewritten by the client.
CREATE OR REPLACE FUNCTION public.protect_follow_request_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
    OR NEW.target_id IS DISTINCT FROM OLD.target_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Follow request identity is immutable';
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.target_id
    OR OLD.status <> 'pending'
    OR NEW.status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Only the recipient may accept or decline a pending follow request';
  END IF;

  IF NEW.status = 'accepted'
    AND public.are_users_blocked(OLD.requester_id, OLD.target_id) THEN
    RAISE EXCEPTION 'A blocked user cannot be accepted as a follower';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_follow_request_update ON public.follow_requests;
CREATE TRIGGER protect_follow_request_update
  BEFORE UPDATE ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_follow_request_update();

-- Acceptance creates the actual follow edge atomically in the same transaction.
CREATE OR REPLACE FUNCTION public.create_follow_from_accepted_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (NEW.requester_id, NEW.target_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_follow_from_accepted_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS follow_request_accept_creates_follow ON public.follow_requests;
CREATE TRIGGER follow_request_accept_creates_follow
  AFTER UPDATE OF status ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_follow_from_accepted_request();

COMMIT;
