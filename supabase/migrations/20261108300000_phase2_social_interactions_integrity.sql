-- Phase 2 / Social interactions: authoritative counters, durable shares and
-- notifications for the tables actually used by the current application.
BEGIN;

-- Keep aggregate counters derived from the source rows, never from browser writes.
CREATE OR REPLACE FUNCTION public.sync_video_interaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_video_id uuid;
  delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_video_id := OLD.video_id;
    delta := -1;
  ELSE
    target_video_id := NEW.video_id;
    delta := 1;
  END IF;

  IF TG_TABLE_NAME = 'video_likes' THEN
    UPDATE public.videos
      SET likes_count = greatest(coalesce(likes_count, 0) + delta, 0)
      WHERE id = target_video_id;
  ELSIF TG_TABLE_NAME = 'video_saves' THEN
    UPDATE public.videos
      SET saves_count = greatest(coalesce(saves_count, 0) + delta, 0)
      WHERE id = target_video_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_like_counts ON public.video_likes;
CREATE TRIGGER sync_video_like_counts
AFTER INSERT OR DELETE ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_video_interaction_counts();

DROP TRIGGER IF EXISTS sync_video_save_counts ON public.video_saves;
CREATE TRIGGER sync_video_save_counts
AFTER INSERT OR DELETE ON public.video_saves
FOR EACH ROW EXECUTE FUNCTION public.sync_video_interaction_counts();

-- Backfill counters from canonical interaction tables.
UPDATE public.videos AS video
SET likes_count = (
  SELECT count(*) FROM public.video_likes AS item WHERE item.video_id = video.id
),
saves_count = (
  SELECT count(*) FROM public.video_saves AS item WHERE item.video_id = video.id
);

-- Record successful share intents in Afrixa, independently of external platforms.
CREATE TABLE IF NOT EXISTS public.video_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('copy_link', 'native', 'whatsapp', 'facebook', 'messenger', 'twitter', 'telegram')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_shares_owner_select ON public.video_shares;
CREATE POLICY video_shares_owner_select ON public.video_shares
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS video_shares_owner_insert ON public.video_shares;
CREATE POLICY video_shares_owner_insert ON public.video_shares
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.videos AS visible_video WHERE visible_video.id = video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_shares_video_created
ON public.video_shares(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_shares_user_created
ON public.video_shares(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_video_share_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_video_id uuid;
  delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_video_id := OLD.video_id;
    delta := -1;
  ELSE
    target_video_id := NEW.video_id;
    delta := 1;
  END IF;

  UPDATE public.videos
    SET shares_count = greatest(coalesce(shares_count, 0) + delta, 0)
    WHERE id = target_video_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_share_count ON public.video_shares;
CREATE TRIGGER sync_video_share_count
AFTER INSERT OR DELETE ON public.video_shares
FOR EACH ROW EXECUTE FUNCTION public.sync_video_share_count();

UPDATE public.videos AS video
SET shares_count = (
  SELECT count(*) FROM public.video_shares AS item WHERE item.video_id = video.id
);

-- Respect per-user notification preferences. Missing preference rows retain
-- the schema defaults (enabled for social activity).
CREATE OR REPLACE FUNCTION public.social_notification_enabled(
  target_user_id uuid,
  preference_column text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  enabled boolean;
BEGIN
  IF preference_column NOT IN ('likes_enabled', 'comments_enabled', 'follows_enabled') THEN
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT %I FROM public.notification_settings WHERE user_id = $1',
    preference_column
  ) INTO enabled USING target_user_id;

  RETURN coalesce(enabled, true);
END;
$$;

REVOKE ALL ON FUNCTION public.social_notification_enabled(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_notification_enabled(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id
     OR NOT public.social_notification_enabled(NEW.following_id, 'follows_enabled') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, 'Un utilisateur') INTO actor_name
  FROM public.profiles WHERE user_id = NEW.follower_id;

  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    NEW.following_id,
    'Nouvel abonné',
    COALESCE(actor_name, 'Un utilisateur') || ' vous suit maintenant.',
    'new_follower',
    NEW.follower_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_video_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.videos WHERE id = NEW.video_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id
     AND public.social_notification_enabled(owner_id, 'likes_enabled') THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (owner_id, 'Nouvelle mention J’aime', 'Une personne a aimé votre vidéo.', 'video_like', NEW.video_id);
  END IF;
  RETURN NEW;
END;
$$;

-- The UI writes to public.comments (not public.video_comments). Remove the
-- legacy trigger and notify both the video owner and the parent-comment author.
DROP TRIGGER IF EXISTS notify_on_video_comment ON public.video_comments;
DROP TRIGGER IF EXISTS notify_on_video_comment ON public.comments;

CREATE OR REPLACE FUNCTION public.notify_on_social_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_owner_id uuid;
  parent_owner_id uuid;
BEGIN
  IF NEW.is_deleted THEN RETURN NEW; END IF;
  SELECT user_id INTO video_owner_id FROM public.videos WHERE id = NEW.video_id;

  IF video_owner_id IS NOT NULL AND video_owner_id <> NEW.user_id
     AND public.social_notification_enabled(video_owner_id, 'comments_enabled') THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (
      video_owner_id,
      'Nouveau commentaire',
      'Une personne a commenté votre vidéo.',
      CASE WHEN NEW.parent_id IS NULL THEN 'video_comment' ELSE 'comment_reply' END,
      NEW.id
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner_id
    FROM public.comments WHERE id = NEW.parent_id;

    IF parent_owner_id IS NOT NULL
       AND parent_owner_id <> NEW.user_id
       AND parent_owner_id IS DISTINCT FROM video_owner_id
       AND public.social_notification_enabled(parent_owner_id, 'comments_enabled') THEN
      INSERT INTO public.notifications(user_id, title, message, type, reference_id)
      VALUES (parent_owner_id, 'Nouvelle réponse', 'Une personne a répondu à votre commentaire.', 'comment_reply', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_social_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_social_comment();

DROP TRIGGER IF EXISTS notify_on_comment_like ON public.comment_likes;
CREATE OR REPLACE FUNCTION public.notify_on_comment_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  comment_owner_id uuid;
BEGIN
  SELECT user_id INTO comment_owner_id
  FROM public.comments WHERE id = NEW.comment_id AND is_deleted = false;

  IF comment_owner_id IS NOT NULL AND comment_owner_id <> NEW.user_id
     AND public.social_notification_enabled(comment_owner_id, 'likes_enabled') THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (comment_owner_id, 'J’aime votre commentaire', 'Une personne a aimé votre commentaire.', 'comment_like', NEW.comment_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_comment_like
AFTER INSERT ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_like();

DROP TRIGGER IF EXISTS notify_on_comment_mention ON public.comment_mentions;
CREATE OR REPLACE FUNCTION public.notify_on_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid;
BEGIN
  SELECT user_id INTO actor_id
  FROM public.comments WHERE id = NEW.comment_id AND is_deleted = false;

  IF actor_id IS NOT NULL AND actor_id <> NEW.mentioned_user_id
     AND public.social_notification_enabled(NEW.mentioned_user_id, 'comments_enabled') THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (NEW.mentioned_user_id, 'Vous avez été mentionné', 'Une personne vous a mentionné dans un commentaire.', 'mention', NEW.comment_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_on_comment_mention
AFTER INSERT ON public.comment_mentions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_mention();

-- Enforce the video-level comments switch and keep replies attached to the
-- same video and to a root comment.
CREATE OR REPLACE FUNCTION public.enforce_comment_thread_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_video_id uuid;
  parent_parent_id uuid;
  video_owner_id uuid;
BEGIN
  IF NEW.is_deleted THEN RETURN NEW; END IF;

  SELECT user_id INTO video_owner_id
  FROM public.videos
  WHERE id = NEW.video_id AND COALESCE(comments_disabled, false) = false;

  IF video_owner_id IS NULL THEN
    RAISE EXCEPTION 'Les commentaires sont désactivés ou la vidéo est indisponible.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT video_id, parent_id INTO parent_video_id, parent_parent_id
    FROM public.comments WHERE id = NEW.parent_id AND is_deleted = false;

    IF parent_video_id IS DISTINCT FROM NEW.video_id OR parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'La réponse doit appartenir au même fil de discussion.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_thread_integrity ON public.comments;
CREATE TRIGGER enforce_comment_thread_integrity
BEFORE INSERT OR UPDATE OF video_id, parent_id, is_deleted
ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_thread_integrity();

ALTER TABLE public.video_shares REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_shares;

COMMIT;
