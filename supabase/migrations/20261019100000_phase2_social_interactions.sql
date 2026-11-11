-- =============================================================================
-- Phase 2 - Interactions sociales fiables
--
-- 1. Compteurs videos synchronises par trigger depuis video_likes,
--    video_saves, video_shares et comments (plus aucune mise a jour locale
--    persistante cote client).
-- 2. Partages reellement enregistres dans video_shares (externe et interne).
-- 3. Commentaires : permissions (commentaires desactives, blocage, profil
--    qui_peut_commenter), reponses validees, epinglage et suppression par le
--    createur, visibilite alignee sur celle de la video.
-- 4. Notifications reelles pour les likes (groupees), commentaires, reponses
--    et abonnements, en respectant notification_settings et les blocages.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Compteurs videos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_video_counters_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
    OR coalesce(current_setting('afrixa.counter_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.likes_count IS DISTINCT FROM OLD.likes_count
    OR NEW.saves_count IS DISTINCT FROM OLD.saves_count
    OR NEW.shares_count IS DISTINCT FROM OLD.shares_count
    OR NEW.comments_count IS DISTINCT FROM OLD.comments_count
    OR NEW.views_count IS DISTINCT FROM OLD.views_count THEN
    RAISE EXCEPTION 'Les compteurs video sont geres par Afrixa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_video_counters_integrity ON public.videos;
CREATE TRIGGER enforce_video_counters_integrity
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_video_counters_integrity();

CREATE OR REPLACE FUNCTION public.sync_video_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET likes_count = greatest(coalesce(likes_count, 0) + 1, 0)
    WHERE id = NEW.video_id;
    RETURN NEW;
  END IF;

  UPDATE public.videos
  SET likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
  WHERE id = OLD.video_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_like_count ON public.video_likes;
CREATE TRIGGER sync_video_like_count
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_video_like_count();

CREATE OR REPLACE FUNCTION public.sync_video_save_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET saves_count = greatest(coalesce(saves_count, 0) + 1, 0)
    WHERE id = NEW.video_id;
    RETURN NEW;
  END IF;

  UPDATE public.videos
  SET saves_count = greatest(coalesce(saves_count, 0) - 1, 0)
  WHERE id = OLD.video_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_save_count ON public.video_saves;
CREATE TRIGGER sync_video_save_count
  AFTER INSERT OR DELETE ON public.video_saves
  FOR EACH ROW EXECUTE FUNCTION public.sync_video_save_count();

-- -----------------------------------------------------------------------------
-- 2. Partages enregistres
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.video_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN (
    'internal', 'link', 'native', 'whatsapp', 'facebook', 'messenger',
    'twitter', 'telegram', 'other'
  )),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_shares_owner_insert" ON public.video_shares;
CREATE POLICY "video_shares_owner_insert"
  ON public.video_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "video_shares_owner_select" ON public.video_shares;
CREATE POLICY "video_shares_owner_select"
  ON public.video_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.video_shares TO authenticated;
REVOKE UPDATE, DELETE ON public.video_shares FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS video_shares_video_idx ON public.video_shares(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_shares_user_idx ON public.video_shares(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_video_share_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET shares_count = greatest(coalesce(shares_count, 0) + 1, 0)
    WHERE id = NEW.video_id;
    RETURN NEW;
  END IF;

  UPDATE public.videos
  SET shares_count = greatest(coalesce(shares_count, 0) - 1, 0)
  WHERE id = OLD.video_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_video_share_count ON public.video_shares;
CREATE TRIGGER sync_video_share_count
  AFTER INSERT OR DELETE ON public.video_shares
  FOR EACH ROW EXECUTE FUNCTION public.sync_video_share_count();

-- -----------------------------------------------------------------------------
-- 3. Commentaires : permissions, moderation et visibilite
-- -----------------------------------------------------------------------------

-- Le trigger de comptage des commentaires doit pouvoir ecrire le compteur.
CREATE OR REPLACE FUNCTION public.sync_comment_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_active boolean := false;
  new_active boolean := false;
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);

  IF TG_OP <> 'INSERT' THEN
    old_active := NOT OLD.is_deleted;
    IF old_active THEN
      IF OLD.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
        WHERE id = OLD.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = greatest(coalesce(replies_count, 0) - 1, 0)
        WHERE id = OLD.parent_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_active := NOT NEW.is_deleted;
    IF new_active THEN
      IF NEW.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = coalesce(comments_count, 0) + 1
        WHERE id = NEW.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = coalesce(replies_count, 0) + 1
        WHERE id = NEW.parent_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

-- La Phase 2 depend de ce compteur : on garantit le trigger meme si la
-- migration d origine (20261017150000) n a pas ete appliquee.
DROP TRIGGER IF EXISTS sync_comment_counts ON public.comments;
CREATE TRIGGER sync_comment_counts
  AFTER INSERT OR UPDATE OF is_deleted OR DELETE
  ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_comment_counts();

-- Les commentaires suivent la visibilite de leur video : ceux d'une video
-- privee ou reservee aux abonnes ne sont plus accessibles directement.
DROP POLICY IF EXISTS "comments_public_select" ON public.comments;
DROP POLICY IF EXISTS "comments_visible_with_video" ON public.comments;
CREATE POLICY "comments_visible_with_video"
  ON public.comments FOR SELECT
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1
      FROM public.videos AS video
      WHERE video.id = comments.video_id
    )
  );

-- Le createur de la video peut moderer (epingler / masquer) les commentaires.
DROP POLICY IF EXISTS "comments_video_owner_update" ON public.comments;
CREATE POLICY "comments_video_owner_update"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.videos AS video
      WHERE video.id = comments.video_id
        AND video.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.videos AS video
      WHERE video.id = comments.video_id
        AND video.user_id = auth.uid()
    )
  );

-- Necessaire pour que l UPDATE d un commentaire masque reste possible : la
-- politique de lecture publique exclut is_deleted = true, l auteur et le
-- proprietaire de la video doivent donc continuer a voir la ligne.
DROP POLICY IF EXISTS "Auteur ou proprietaire voit les commentaires masques" ON public.comments;
CREATE POLICY "Auteur ou proprietaire voit les commentaires masques"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.videos AS video
      WHERE video.id = comments.video_id
        AND video.user_id = auth.uid()
    )
  );

-- L auteur peut masquer son propre commentaire ; le createur de la video peut
-- moderer tous les commentaires (politique permissive additionnelle).
DROP POLICY IF EXISTS "Auteur met a jour son commentaire" ON public.comments;
CREATE POLICY "Auteur met a jour son commentaire"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_comment_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_row public.videos%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  parent_row public.comments%ROWTYPE;
BEGIN
  SELECT * INTO video_row FROM public.videos WHERE id = NEW.video_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video introuvable';
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
    AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Un commentaire doit etre publie par son auteur';
  END IF;

  IF coalesce(video_row.comments_disabled, false) THEN
    RAISE EXCEPTION 'Les commentaires sont desactives pour cette video';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = video_row.user_id AND blocked_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas commenter cette video';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE user_id = video_row.user_id;
  IF FOUND AND NEW.user_id IS DISTINCT FROM video_row.user_id THEN
    IF profile_row.who_can_comment = 'nobody' THEN
      RAISE EXCEPTION 'Les commentaires sont reserves au createur';
    END IF;
    IF profile_row.who_can_comment = 'followers'
      AND NOT EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = NEW.user_id AND following_id = video_row.user_id
      ) THEN
      RAISE EXCEPTION 'Seuls les abonnes du createur peuvent commenter';
    END IF;
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO parent_row FROM public.comments WHERE id = NEW.parent_id;
    IF NOT FOUND OR parent_row.video_id IS DISTINCT FROM NEW.video_id THEN
      RAISE EXCEPTION 'La reponse doit appartenir a la meme video';
    END IF;
    IF parent_row.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Les reponses ne peuvent pas etre imbriquees';
    END IF;
    IF NEW.is_pinned THEN
      RAISE EXCEPTION 'Une reponse ne peut pas etre epinglee';
    END IF;
  END IF;

  IF NEW.is_pinned AND NEW.user_id IS DISTINCT FROM video_row.user_id THEN
    RAISE EXCEPTION 'Seul le createur de la video peut epingler un commentaire';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_permissions ON public.comments;
CREATE TRIGGER enforce_comment_permissions
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_permissions();

CREATE OR REPLACE FUNCTION public.enforce_comment_moderation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_owner uuid;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO video_owner FROM public.videos WHERE id = OLD.video_id;

  IF NEW.video_id IS DISTINCT FROM OLD.video_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'Le rattachement d un commentaire ne peut pas etre modifie';
  END IF;

  IF NEW.content IS DISTINCT FROM OLD.content
    AND auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Seul l auteur peut modifier son commentaire';
  END IF;

  IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
    AND auth.uid() IS DISTINCT FROM video_owner THEN
    RAISE EXCEPTION 'Seul le createur de la video peut epingler un commentaire';
  END IF;

  IF NEW.is_pinned AND NEW.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Une reponse ne peut pas etre epinglee';
  END IF;

  IF NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
    AND auth.uid() IS DISTINCT FROM OLD.user_id
    AND auth.uid() IS DISTINCT FROM video_owner THEN
    RAISE EXCEPTION 'Seul l auteur ou le createur peut masquer ce commentaire';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_comment_moderation_integrity ON public.comments;
CREATE TRIGGER enforce_comment_moderation_integrity
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_moderation_integrity();

-- L ancienne table video_comments n est plus utilisee par l interface : elle
-- reste consultable mais ne doit plus diverger de comments.
REVOKE INSERT, UPDATE, DELETE ON public.video_comments FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Notifications reelles
-- -----------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aggregate_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS notifications_user_type_ref_idx
  ON public.notifications(user_id, type, reference_id, is_read);

CREATE OR REPLACE FUNCTION public.notification_enabled(p_user_id uuid, p_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE p_type
        WHEN 'like' THEN settings.likes_enabled
        WHEN 'comment' THEN settings.comments_enabled
        WHEN 'follow' THEN settings.follows_enabled
        ELSE true
      END
      FROM public.notification_settings AS settings
      WHERE settings.user_id = p_user_id
    ),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.notification_enabled(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_enabled(uuid, text) TO service_role;

-- Likes : notification groupee sur 24 h pour eviter le spam.
CREATE OR REPLACE FUNCTION public.notify_video_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_owner uuid;
  actor_name text;
  existing_id uuid;
  existing_count integer;
  next_count integer;
BEGIN
  SELECT user_id INTO video_owner FROM public.videos WHERE id = NEW.video_id;
  IF video_owner IS NULL OR video_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_enabled(video_owner, 'like') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = video_owner AND blocked_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT username INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

  SELECT id, aggregate_count INTO existing_id, existing_count
  FROM public.notifications
  WHERE user_id = video_owner
    AND type = 'like'
    AND reference_id = NEW.video_id
    AND is_read = false
    AND created_at > now() - interval '24 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    next_count := coalesce(existing_count, 1) + 1;
    UPDATE public.notifications
    SET aggregate_count = next_count,
        actor_id = NEW.user_id,
        updated_at = now(),
        message = coalesce(actor_name, 'Quelqu un') || ' et ' || (next_count - 1)::text
          || ' autre(s) personne(s) ont aime votre video'
    WHERE id = existing_id;
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, actor_id)
  VALUES (
    video_owner,
    'Nouveau j aime',
    coalesce(actor_name, 'Quelqu un') || ' a aime votre video',
    'like',
    NEW.video_id,
    NEW.user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_video_like ON public.video_likes;
CREATE TRIGGER notify_video_like
  AFTER INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_video_like();

-- Commentaires et reponses.
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_owner uuid;
  parent_author uuid;
  recipient uuid;
  actor_name text;
  notification_type text;
BEGIN
  SELECT user_id INTO video_owner FROM public.videos WHERE id = NEW.video_id;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    recipient := coalesce(parent_author, video_owner);
    notification_type := 'reply';
  ELSE
    recipient := video_owner;
    notification_type := 'comment';
  END IF;

  IF recipient IS NULL OR recipient = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_enabled(recipient, 'comment') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = recipient AND blocked_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT username INTO actor_name FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, actor_id)
  VALUES (
    recipient,
    CASE WHEN notification_type = 'reply' THEN 'Nouvelle reponse' ELSE 'Nouveau commentaire' END,
    CASE
      WHEN notification_type = 'reply'
        THEN coalesce(actor_name, 'Quelqu un') || ' a repondu a votre commentaire'
      ELSE coalesce(actor_name, 'Quelqu un') || ' a commente votre video'
    END,
    notification_type,
    NEW.id,
    NEW.user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_comment ON public.comments;
CREATE TRIGGER notify_new_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

-- Abonnements.
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_name text;
BEGIN
  IF NEW.following_id = NEW.follower_id THEN
    RETURN NEW;
  END IF;

  IF NOT public.notification_enabled(NEW.following_id, 'follow') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = NEW.following_id AND blocked_id = NEW.follower_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT username INTO actor_name FROM public.profiles WHERE user_id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, actor_id)
  VALUES (
    NEW.following_id,
    'Nouvel abonne',
    coalesce(actor_name, 'Quelqu un') || ' a commence a vous suivre',
    'follow',
    NEW.follower_id,
    NEW.follower_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_follower ON public.follows;
CREATE TRIGGER notify_new_follower
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

-- -----------------------------------------------------------------------------
-- 5. Reconciliation des compteurs existants
-- -----------------------------------------------------------------------------

SELECT set_config('afrixa.counter_writer', 'on', true);

UPDATE public.videos AS video
SET likes_count = (
      SELECT count(*) FROM public.video_likes AS liked WHERE liked.video_id = video.id
    ),
    saves_count = (
      SELECT count(*) FROM public.video_saves AS saved WHERE saved.video_id = video.id
    ),
    shares_count = (
      SELECT count(*) FROM public.video_shares AS shared WHERE shared.video_id = video.id
    ),
    comments_count = (
      SELECT count(*)
      FROM public.comments AS comment
      WHERE comment.video_id = video.id
        AND comment.parent_id IS NULL
        AND comment.is_deleted = false
    );

UPDATE public.comments AS parent
SET replies_count = (
  SELECT count(*)
  FROM public.comments AS reply
  WHERE reply.parent_id = parent.id AND reply.is_deleted = false
);

UPDATE public.comments AS comment
SET likes_count = (
  SELECT count(*) FROM public.comment_likes AS liked WHERE liked.comment_id = comment.id
);

SELECT set_config('afrixa.counter_writer', 'off', true);

COMMENT ON TABLE public.video_shares IS
  'Chaque partage externe ou interne est enregistre pour alimenter shares_count.';
COMMENT ON FUNCTION public.notify_video_like() IS
  'Cree ou regroupe une notification de j aime pour le createur de la video.';
