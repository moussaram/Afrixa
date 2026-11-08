-- Phase 1 / Privacy: hide private social-graph edges and engagement on inaccessible videos.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_follow_edge(edge_follower_id uuid, edge_following_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    NOT public.are_users_blocked(auth.uid(), edge_follower_id)
    AND NOT public.are_users_blocked(auth.uid(), edge_following_id)
    AND (
      auth.uid() = edge_follower_id
      OR public.is_publicly_followable(edge_follower_id)
      OR EXISTS (
        SELECT 1 FROM public.follows AS viewer_follow
        WHERE viewer_follow.follower_id = auth.uid()
          AND viewer_follow.following_id = edge_follower_id
      )
    )
    AND (
      auth.uid() = edge_following_id
      OR public.is_publicly_followable(edge_following_id)
      OR EXISTS (
        SELECT 1 FROM public.follows AS viewer_follow
        WHERE viewer_follow.follower_id = auth.uid()
          AND viewer_follow.following_id = edge_following_id
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_view_follow_edge(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_follow_edge(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Abonnements visibles par tous" ON public.follows;
CREATE POLICY "Abonnements visibles selon confidentialité"
  ON public.follows
  FOR SELECT
  USING (public.can_view_follow_edge(follower_id, following_id));

DROP POLICY IF EXISTS "Likes visibles par tous" ON public.video_likes;
CREATE POLICY "Likes visibles selon vidéo"
  ON public.video_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = video_likes.video_id
    )
  );

DROP POLICY IF EXISTS "Utilisateur peut aimer une video" ON public.video_likes;
CREATE POLICY "Utilisateur peut aimer une video"
  ON public.video_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = video_likes.video_id
    )
  );

DROP POLICY IF EXISTS "Utilisateur peut sauvegarder une video" ON public.video_saves;
CREATE POLICY "Utilisateur peut sauvegarder une video"
  ON public.video_saves
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = video_saves.video_id
    )
  );

COMMIT;
