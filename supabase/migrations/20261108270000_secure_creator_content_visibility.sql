-- Phase 1 / Privacy: creator collections and discovery records inherit content visibility.

BEGIN;

DROP POLICY IF EXISTS "challenge_submissions_select_all" ON public.challenge_submissions;
CREATE POLICY "challenge_submissions_visible_video_only"
  ON public.challenge_submissions
  FOR SELECT
  USING (
    video_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = challenge_submissions.video_id
    )
  );

DROP POLICY IF EXISTS "collab_videos_select_all" ON public.collab_videos;
CREATE POLICY "collab_videos_visible_video_only"
  ON public.collab_videos
  FOR SELECT
  USING (
    video_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = collab_videos.video_id
    )
  );

DROP POLICY IF EXISTS "series_episodes_select_all" ON public.series_episodes;
CREATE POLICY "series_episodes_visible_video_only"
  ON public.series_episodes
  FOR SELECT
  USING (
    video_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.videos AS visible_video
      WHERE visible_video.id = series_episodes.video_id
    )
  );

DROP POLICY IF EXISTS "series_select_all" ON public.series;
CREATE POLICY "series_visible_creator_only"
  ON public.series
  FOR SELECT
  USING (
    creator_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.public_profiles AS visible_profile
      WHERE visible_profile.user_id = series.creator_id
    )
  );

DROP POLICY IF EXISTS "fan_clubs_select_all" ON public.fan_clubs;
CREATE POLICY "fan_clubs_visible_creator_only"
  ON public.fan_clubs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.public_profiles AS visible_profile
      WHERE visible_profile.user_id = fan_clubs.creator_id
    )
  );

DROP POLICY IF EXISTS "spotlights_select_active" ON public.spotlights;
CREATE POLICY "spotlights_visible_content_only"
  ON public.spotlights
  FOR SELECT
  USING (
    is_active = true
    AND (
      user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.public_profiles AS visible_profile
        WHERE visible_profile.user_id = spotlights.user_id
      )
    )
    AND (
      video_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.videos AS visible_video
        WHERE visible_video.id = spotlights.video_id
      )
    )
  );

COMMIT;
