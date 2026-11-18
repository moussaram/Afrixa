CREATE OR REPLACE FUNCTION public.sync_comment_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_active boolean := false;
  new_active boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_active := NOT OLD.is_deleted;
    IF old_active THEN
      IF OLD.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
        WHERE id = OLD.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = greatest(coalesce(replies_count, 0) - 1, 0)
        WHERE id = OLD.parent_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_active := NOT NEW.is_deleted;
    IF new_active THEN
      IF NEW.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = coalesce(comments_count, 0) + 1
        WHERE id = NEW.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = coalesce(replies_count, 0) + 1
        WHERE id = NEW.parent_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_comment_counts ON public.comments;
CREATE TRIGGER sync_comment_counts
  AFTER INSERT OR UPDATE OF is_deleted OR DELETE
  ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_comment_counts();

CREATE OR REPLACE FUNCTION public.sync_comment_like_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_comment_id uuid;
  count_delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_comment_id := OLD.comment_id;
    count_delta := -1;
  ELSE
    target_comment_id := NEW.comment_id;
    count_delta := 1;
  END IF;

  UPDATE public.comments
  SET likes_count = greatest(coalesce(likes_count, 0) + count_delta, 0)
  WHERE id = target_comment_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_comment_like_counts ON public.comment_likes;
CREATE TRIGGER sync_comment_like_counts
  AFTER INSERT OR DELETE
  ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_comment_like_counts();

UPDATE public.videos AS video
SET comments_count = (
  SELECT count(*)
  FROM public.comments AS comment
  WHERE comment.video_id = video.id
    AND comment.parent_id IS NULL
    AND comment.is_deleted = false
);

UPDATE public.comments AS comment
SET replies_count = (
  SELECT count(*)
  FROM public.comments AS reply
  WHERE reply.parent_id = comment.id
    AND reply.is_deleted = false
);

UPDATE public.comments AS comment
SET likes_count = (
  SELECT count(*)
  FROM public.comment_likes AS comment_like
  WHERE comment_like.comment_id = comment.id
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
