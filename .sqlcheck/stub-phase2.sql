-- Phase 2 additions to the minimal Supabase-shaped schema.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS who_can_comment text DEFAULT 'everyone';
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS comments_disabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.video_likes (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes visibles par tous" ON public.video_likes FOR SELECT USING (true);
CREATE POLICY "Utilisateur peut aimer une video" ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utilisateur peut retirer son like" ON public.video_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.video_saves (
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
ALTER TABLE public.video_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit ses sauvegardes" ON public.video_saves FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Utilisateur peut sauvegarder une video" ON public.video_saves FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utilisateur peut retirer sa sauvegarde" ON public.video_saves FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) <= 500),
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_select" ON public.comments FOR SELECT USING (is_deleted = false);
CREATE POLICY "comments_owner_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_owner_update" ON public.comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.comment_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes_owner_all" ON public.comment_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.comment_mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_mentions_public_select" ON public.comment_mentions FOR SELECT USING (true);

CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commentaires legacy visibles" ON public.video_comments FOR SELECT USING (is_deleted = false);
CREATE POLICY "Utilisateur peut commenter legacy" ON public.video_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
GRANT INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;

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
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_settings_owner" ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  order_id uuid,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_reports_owner_insert" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "content_reports_owner_select" ON public.content_reports FOR SELECT USING (auth.uid() = reporter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
