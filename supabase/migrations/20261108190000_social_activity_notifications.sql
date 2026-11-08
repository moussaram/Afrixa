-- Emit durable notifications from actual social interactions.
CREATE OR REPLACE FUNCTION public.notify_on_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  SELECT COALESCE(username, 'Un utilisateur') INTO actor_name
  FROM public.profiles WHERE user_id = NEW.follower_id;
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    NEW.following_id,
    'Nouvel abonné',
    COALESCE(actor_name, 'Un utilisateur') || ' vous suit maintenant.',
    'new_follower',
    NEW.follower_id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_follow ON public.follows;
CREATE TRIGGER notify_on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_follow();

CREATE OR REPLACE FUNCTION public.notify_on_video_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.videos WHERE id = NEW.video_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (owner_id, 'Nouvelle mention J’aime', 'Une personne a aimé votre vidéo.', 'video_like', NEW.video_id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_video_like ON public.video_likes;
CREATE TRIGGER notify_on_video_like
AFTER INSERT ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_video_like();

CREATE OR REPLACE FUNCTION public.notify_on_video_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.videos WHERE id = NEW.video_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id AND NEW.is_deleted = false THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (owner_id, 'Nouveau commentaire', 'Une personne a commenté votre vidéo.', 'video_comment', NEW.video_id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_video_comment ON public.video_comments;
CREATE TRIGGER notify_on_video_comment
AFTER INSERT ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_video_comment();
