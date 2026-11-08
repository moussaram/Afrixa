-- Phase 1 / Privacy: comments and related metadata must inherit video visibility.
-- A public comments policy must not expose discussion attached to private or
-- followers-only videos, nor allow comments to be posted to inaccessible videos.

BEGIN;

DROP POLICY IF EXISTS "comments_public_select" ON public.comments;
DROP POLICY IF EXISTS "comments_visible_when_video_visible" ON public.comments;
CREATE POLICY "comments_visible_when_video_visible"
  ON public.comments
  FOR SELECT
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = comments.video_id
    )
  );

DROP POLICY IF EXISTS "comments_owner_insert" ON public.comments;
CREATE POLICY "comments_owner_insert"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = comments.video_id
    )
  );


DROP POLICY IF EXISTS "comments_owner_update" ON public.comments;
CREATE POLICY "comments_owner_update"
  ON public.comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = comments.video_id
    )
  );

DROP POLICY IF EXISTS "Commentaires visibles par tous" ON public.video_comments;
DROP POLICY IF EXISTS "video_comments_visible_when_video_visible" ON public.video_comments;
CREATE POLICY "video_comments_visible_when_video_visible"
  ON public.video_comments
  FOR SELECT
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = video_comments.video_id
    )
  );

DROP POLICY IF EXISTS "Utilisateur peut commenter" ON public.video_comments;
CREATE POLICY "Utilisateur peut commenter"
  ON public.video_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = video_comments.video_id
    )
  );


DROP POLICY IF EXISTS "Utilisateur peut modifier son commentaire" ON public.video_comments;
CREATE POLICY "Utilisateur peut modifier son commentaire"
  ON public.video_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.videos AS visible_video
      WHERE visible_video.id = video_comments.video_id
    )
  );

-- Mention records must not reveal users or comment activity for inaccessible videos.
DROP POLICY IF EXISTS "comment_mentions_public_select" ON public.comment_mentions;
DROP POLICY IF EXISTS "comment_mentions_visible_when_comment_visible" ON public.comment_mentions;
CREATE POLICY "comment_mentions_visible_when_comment_visible"
  ON public.comment_mentions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.comments AS visible_comment
      WHERE visible_comment.id = comment_mentions.comment_id
    )
  );

-- A user may only add a reaction to a comment they are allowed to read.
DROP POLICY IF EXISTS "comment_likes_owner_all" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_owner_select" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_owner_insert" ON public.comment_likes;
DROP POLICY IF EXISTS "comment_likes_owner_delete" ON public.comment_likes;

CREATE POLICY "comment_likes_owner_select"
  ON public.comment_likes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "comment_likes_owner_insert"
  ON public.comment_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.comments AS visible_comment
      WHERE visible_comment.id = comment_likes.comment_id
    )
  );

CREATE POLICY "comment_likes_owner_delete"
  ON public.comment_likes
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
