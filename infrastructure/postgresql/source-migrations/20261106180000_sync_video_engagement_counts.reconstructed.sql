-- RECONSTRUCTED from the live Supabase catalog on 2026-11-18.
-- This is NOT the original migration file. It captures the currently deployed function/trigger definitions.
-- Review and compare with the archived functions-and-triggers.sql before applying.
CREATE OR REPLACE FUNCTION public.sync_video_engagement_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$


CREATE TRIGGER sync_video_like_counts AFTER INSERT OR DELETE ON video_likes FOR EACH ROW EXECUTE FUNCTION sync_video_engagement_counts();

CREATE TRIGGER sync_video_save_counts AFTER INSERT OR DELETE ON video_saves FOR EACH ROW EXECUTE FUNCTION sync_video_engagement_counts();
