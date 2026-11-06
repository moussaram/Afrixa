-- Keep video engagement counters consistent with the authoritative relation tables.
-- The relation tables already enforce one row per user/video with composite PKs.
CREATE OR REPLACE FUNCTION public.sync_video_engagement_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_video_id uuid;
  count_delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_video_id := OLD.video_id;
    count_delta := -1;
  ELSE
    target_video_id := NEW.video_id;
    count_delta := 1;
  END IF;

  IF TG_TABLE_NAME = 'video_likes' THEN
    UPDATE public.videos
    SET likes_count = greatest(coalesce(likes_count, 0) + count_delta, 0)
    WHERE id = target_video_id;
  ELSIF TG_TABLE_NAME = 'video_saves' THEN
    UPDATE public.videos
    SET saves_count = greatest(coalesce(saves_count, 0) + count_delta, 0)
    WHERE id = target_video_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_like_counts ON public.video_likes;
CREATE TRIGGER sync_video_like_counts
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_video_engagement_counts();

DROP TRIGGER IF EXISTS sync_video_save_counts ON public.video_saves;
CREATE TRIGGER sync_video_save_counts
  AFTER INSERT OR DELETE ON public.video_saves
  FOR EACH ROW EXECUTE FUNCTION public.sync_video_engagement_counts();

-- Reconcile existing counters once when this migration is applied.
UPDATE public.videos AS video
SET likes_count = (
  SELECT count(*) FROM public.video_likes AS relation WHERE relation.video_id = video.id
),
saves_count = (
  SELECT count(*) FROM public.video_saves AS relation WHERE relation.video_id = video.id
);
