-- Tables live presentes en production mais absentes des stubs precedents.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agora_channel text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Live Afrixa',
  cover_image text,
  status text NOT NULL DEFAULT 'live',
  privacy text NOT NULL DEFAULT 'public',
  viewers_count integer NOT NULL DEFAULT 0,
  peak_viewers integer NOT NULL DEFAULT 0,
  pinned_product_id uuid,
  replay_video_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lives publics visibles"
  ON public.live_sessions FOR SELECT USING (true);

CREATE POLICY "Createur peut demarrer un live"
  ON public.live_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Createur peut gerer son live"
  ON public.live_sessions FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_sessions TO authenticated;

-- Colonnes de profil utilisees par les listes de live.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS nom text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- service_role contourne la RLS mais a aussi besoin des privileges de table.
GRANT ALL ON public.live_sessions TO service_role;
