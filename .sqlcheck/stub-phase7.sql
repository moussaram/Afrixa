-- Historique de visionnage : present en production, absent des stubs precedents.
CREATE TABLE IF NOT EXISTS public.video_watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  watch_duration double precision DEFAULT 0,
  completion_rate double precision DEFAULT 0,
  last_position double precision DEFAULT 0,
  watch_count integer DEFAULT 1,
  last_watched_at timestamptz DEFAULT now(),
  UNIQUE (user_id, video_id)
);

ALTER TABLE public.video_watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_watch_history_owner_all" ON public.video_watch_history;
CREATE POLICY "video_watch_history_owner_all"
  ON public.video_watch_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_watch_history TO authenticated;
GRANT ALL ON public.video_watch_history TO service_role;
