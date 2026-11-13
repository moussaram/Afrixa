-- Afrixa Phase 1: profile privacy and creator-content visibility.
-- Apply to a dedicated staging database only after reviewing its schema.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "profiles_owner_select"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "profiles_owner_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

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

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  profile.user_id,
  profile.username,
  profile.prenom,
  profile.nom,
  profile.avatar_url,
  CASE
    WHEN COALESCE(profile.is_private, false) = false OR auth.uid() = profile.user_id
      THEN profile.bio
    ELSE NULL
  END AS bio,
  COALESCE(profile.is_private, false) AS is_private,
  profile.created_at
FROM public.profiles AS profile
WHERE
  (auth.uid() IS NOT NULL OR COALESCE(profile.is_private, false) = false)
  AND (
    auth.uid() IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.user_blocks AS blocked
      WHERE (blocked.blocker_id = auth.uid() AND blocked.blocked_id = profile.user_id)
         OR (blocked.blocker_id = profile.user_id AND blocked.blocked_id = auth.uid())
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_view_creator_content(
  p_creator_id uuid,
  p_privacy text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_creator_id IS NOT NULL
    AND (
      auth.uid() IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks AS blocked
        WHERE (blocked.blocker_id = p_creator_id AND blocked.blocked_id = auth.uid())
           OR (blocked.blocker_id = auth.uid() AND blocked.blocked_id = p_creator_id)
      )
    )
    AND (
      (
        p_privacy = 'public'
        AND (
          auth.uid() IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.profiles AS creator
            WHERE creator.user_id = p_creator_id
              AND COALESCE(creator.is_private, false) = true
          )
          OR EXISTS (
            SELECT 1 FROM public.follows AS follow
            WHERE follow.follower_id = auth.uid()
              AND follow.following_id = p_creator_id
          )
        )
      )
      OR (
        auth.uid() IS NOT NULL
        AND p_privacy = 'followers'
        AND EXISTS (
          SELECT 1 FROM public.follows AS follow
          WHERE follow.follower_id = auth.uid()
            AND follow.following_id = p_creator_id
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_creator_content(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_creator_content(uuid, text) TO anon, authenticated;

COMMIT;
