-- Afrixa core social commerce schema.
-- Adds the tables described in the project context that were not yet present.

CREATE TABLE public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cloudflare_uid text,
  hls_url text NOT NULL,
  thumbnail_url text,
  title text,
  description text,
  duration integer NOT NULL DEFAULT 0 CHECK (duration >= 0 AND duration <= 300),
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  shares_count integer NOT NULL DEFAULT 0,
  saves_count integer NOT NULL DEFAULT 0,
  location_name text,
  lat double precision,
  lng double precision,
  moderation_status text NOT NULL DEFAULT 'pending',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Videos publiees visibles par tous"
  ON public.videos FOR SELECT
  USING (is_published = true OR auth.uid() = user_id);

CREATE POLICY "Createur peut publier ses videos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Createur peut modifier ses videos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Createur peut supprimer ses videos"
  ON public.videos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_videos_feed ON public.videos(is_published, created_at DESC);
CREATE INDEX idx_videos_user ON public.videos(user_id, created_at DESC);
CREATE INDEX idx_videos_moderation ON public.videos(moderation_status);

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Abonnements visibles par tous"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Utilisateur peut suivre"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Utilisateur peut se desabonner"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_following ON public.follows(following_id);

CREATE TABLE public.video_likes (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes visibles par tous"
  ON public.video_likes FOR SELECT
  USING (true);

CREATE POLICY "Utilisateur peut aimer une video"
  ON public.video_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut retirer son like"
  ON public.video_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE public.video_saves (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses sauvegardes"
  ON public.video_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut sauvegarder une video"
  ON public.video_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut retirer sa sauvegarde"
  ON public.video_saves FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 1000),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Commentaires visibles par tous"
  ON public.video_comments FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "Utilisateur peut commenter"
  ON public.video_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut modifier son commentaire"
  ON public.video_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_video_comments_video ON public.video_comments(video_id, created_at DESC);

CREATE TRIGGER update_video_comments_updated_at
  BEFORE UPDATE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agora_channel text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Live Afrixa',
  cover_image text,
  status text NOT NULL DEFAULT 'live',
  viewers_count integer NOT NULL DEFAULT 0,
  peak_viewers integer NOT NULL DEFAULT 0,
  pinned_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  replay_video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lives publics visibles"
  ON public.live_sessions FOR SELECT
  USING (true);

CREATE POLICY "Createur peut demarrer un live"
  ON public.live_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Createur peut gerer son live"
  ON public.live_sessions FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE INDEX idx_live_sessions_status ON public.live_sessions(status, started_at DESC);
CREATE INDEX idx_live_sessions_host ON public.live_sessions(host_id, started_at DESC);

CREATE TABLE public.coin_balances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit son wallet coins"
  ON public.coin_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur initialise son wallet coins"
  ON public.coin_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_coin_balances_updated_at
  BEFORE UPDATE ON public.coin_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount_fcfa integer NOT NULL DEFAULT 0,
  coins_amount integer,
  flw_tx_ref text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur voit ses transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur cree ses transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON public.transactions(status);

CREATE TABLE public.user_fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur gere ses tokens FCM"
  ON public.user_fcm_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_fcm_tokens_user ON public.user_fcm_tokens(user_id);

CREATE TRIGGER update_user_fcm_tokens_updated_at
  BEFORE UPDATE ON public.user_fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  likes_enabled boolean NOT NULL DEFAULT true,
  comments_enabled boolean NOT NULL DEFAULT true,
  follows_enabled boolean NOT NULL DEFAULT true,
  lives_enabled boolean NOT NULL DEFAULT true,
  messages_enabled boolean NOT NULL DEFAULT true,
  orders_enabled boolean NOT NULL DEFAULT true,
  promotions_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateur gere ses preferences notification"
  ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.videos REPLICA IDENTITY FULL;
ALTER TABLE public.video_comments REPLICA IDENTITY FULL;
ALTER TABLE public.live_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.coin_balances REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
