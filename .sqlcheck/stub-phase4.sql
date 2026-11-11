-- Colonnes de profil presentes en production mais absentes du stub Phase 1.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS deuxieme_prenom text,
  ADD COLUMN IF NOT EXISTS nom text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS nationalite text,
  ADD COLUMN IF NOT EXISTS nationalite_flag text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS is_vendor boolean DEFAULT false;

-- Tables d analytics presentes en production mais absentes du stub Phase 1.
CREATE TABLE IF NOT EXISTS public.profile_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  total_views integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  profile_visits integer DEFAULT 0,
  new_followers integer DEFAULT 0,
  lost_followers integer DEFAULT 0,
  recorded_date date DEFAULT current_date
);

CREATE TABLE IF NOT EXISTS public.video_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  views integer DEFAULT 0,
  unique_views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  avg_watch_duration double precision DEFAULT 0,
  completion_rate double precision DEFAULT 0,
  traffic_source jsonb DEFAULT '{}'::jsonb,
  audience_countries jsonb DEFAULT '{}'::jsonb,
  recorded_date date DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_analytics TO authenticated;
