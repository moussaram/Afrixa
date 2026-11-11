-- =============================================================================
-- Phase 5 - Lives
--
-- 1. Le chat des lives etait local a chaque navigateur : il est remplace par
--    live_messages, persiste et diffuse en Realtime, avec moderation.
-- 2. Les co-animateurs peuvent publier via le token Agora et moderer le chat.
-- 3. La presence (live_viewers) alimente des compteurs reels : spectateurs,
--    pic, likes et commentaires, au lieu de valeurs inventees cote client.
-- 4. La visibilite d un live respecte public / abonnes / prive, les blocages
--    et l etat du live (en direct / termine).
-- =============================================================================

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.live_cohosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('invited', 'accepted', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.live_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 300),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_messages_session_created_idx
  ON public.live_messages (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_reactions_session_idx
  ON public.live_reactions (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.live_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS live_viewers_session_active_idx
  ON public.live_viewers (session_id)
  WHERE left_at IS NULL;

ALTER TABLE public.live_cohosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Helpers de visibilite / moderation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_live_moderator(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.live_sessions AS session
      WHERE session.id = p_session_id AND session.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.live_cohosts AS cohost
      WHERE cohost.session_id = p_session_id
        AND cohost.user_id = auth.uid()
        AND cohost.status = 'accepted'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_live(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.live_sessions AS session
    WHERE session.id = p_session_id
      AND (
        session.host_id = auth.uid()
        OR public.can_view_creator_content(session.host_id, session.privacy)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_live_moderator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_live(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_live_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_live(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Politiques
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Lives publics visibles" ON public.live_sessions;
DROP POLICY IF EXISTS "Lives visibles selon leur confidentialite" ON public.live_sessions;
CREATE POLICY "Lives visibles selon leur confidentialite"
  ON public.live_sessions FOR SELECT
  TO authenticated
  USING (
    host_id = auth.uid()
    OR public.can_view_creator_content(host_id, privacy)
    OR public.is_live_moderator(id)
  );

CREATE POLICY "live_cohosts_select"
  ON public.live_cohosts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_live_moderator(session_id));

CREATE POLICY "live_cohosts_insert"
  ON public.live_cohosts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_live_moderator(session_id)
    AND invited_by = auth.uid()
  );

CREATE POLICY "live_cohosts_update"
  ON public.live_cohosts FOR UPDATE
  TO authenticated
  USING (public.is_live_moderator(session_id))
  WITH CHECK (public.is_live_moderator(session_id));

CREATE POLICY "live_cohosts_delete"
  ON public.live_cohosts FOR DELETE
  TO authenticated
  USING (public.is_live_moderator(session_id));

CREATE POLICY "live_messages_select"
  ON public.live_messages FOR SELECT
  TO authenticated
  USING (
    (is_hidden = false OR user_id = auth.uid() OR public.is_live_moderator(session_id))
    AND public.can_view_live(session_id)
  );

CREATE POLICY "live_messages_insert"
  ON public.live_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_live(session_id)
    AND EXISTS (
      SELECT 1
      FROM public.live_sessions AS session
      WHERE session.id = session_id
        AND session.status = 'live'
        AND session.comments_enabled = true
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_blocks AS block
          WHERE block.blocker_id = session.host_id
            AND block.blocked_id = auth.uid()
        )
    )
  );

CREATE POLICY "live_messages_update"
  ON public.live_messages FOR UPDATE
  TO authenticated
  USING (public.is_live_moderator(session_id))
  WITH CHECK (public.is_live_moderator(session_id));

CREATE POLICY "live_messages_delete"
  ON public.live_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_live_moderator(session_id));

CREATE POLICY "live_reactions_select"
  ON public.live_reactions FOR SELECT
  TO authenticated
  USING (public.can_view_live(session_id));

CREATE POLICY "live_reactions_insert"
  ON public.live_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_live(session_id)
    AND EXISTS (
      SELECT 1 FROM public.live_sessions AS session
      WHERE session.id = session_id AND session.status = 'live'
    )
  );

CREATE POLICY "live_viewers_select"
  ON public.live_viewers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_live_moderator(session_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_messages TO authenticated;
GRANT SELECT, INSERT ON public.live_reactions TO authenticated;
GRANT SELECT ON public.live_cohosts TO authenticated;
GRANT SELECT ON public.live_viewers TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Integrite et compteurs reels
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_live_message_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'Un message de live ne peut pas etre reecrit';
  END IF;

  IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
    AND NOT public.is_live_moderator(OLD.session_id) THEN
    RAISE EXCEPTION 'Seul le createur ou un co-animateur peut masquer un message';
  END IF;

  IF OLD.is_hidden = true AND NEW.is_hidden = false AND auth.uid() IS NOT NULL
    AND NOT public.is_live_moderator(OLD.session_id) THEN
    RAISE EXCEPTION 'Seul le createur ou un co-animateur peut restaurer un message';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_live_message_integrity ON public.live_messages;
CREATE TRIGGER enforce_live_message_integrity
  BEFORE UPDATE ON public.live_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_message_integrity();

CREATE OR REPLACE FUNCTION public.enforce_live_counters_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('afrixa.counter_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.viewers_count IS DISTINCT FROM OLD.viewers_count
    OR NEW.peak_viewers IS DISTINCT FROM OLD.peak_viewers
    OR NEW.likes_count IS DISTINCT FROM OLD.likes_count
    OR NEW.comments_count IS DISTINCT FROM OLD.comments_count THEN
    RAISE EXCEPTION 'Les compteurs de live sont geres par Afrixa';
  END IF;

  IF OLD.status = 'ended' AND NEW.status <> 'ended' THEN
    RAISE EXCEPTION 'Un live termine ne peut pas etre relance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_live_counters_integrity ON public.live_sessions;
CREATE TRIGGER enforce_live_counters_integrity
  BEFORE UPDATE ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_counters_integrity();

CREATE OR REPLACE FUNCTION public.sync_live_message_counts()
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
    old_active := NOT OLD.is_hidden;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    new_active := NOT NEW.is_hidden;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.live_sessions
    SET comments_count = greatest(comments_count - (CASE WHEN old_active THEN 1 ELSE 0 END), 0)
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_sessions
    SET comments_count = comments_count + (CASE WHEN new_active THEN 1 ELSE 0 END)
    WHERE id = NEW.session_id;
    RETURN NEW;
  END IF;

  UPDATE public.live_sessions
  SET comments_count = greatest(
    comments_count + (CASE WHEN new_active THEN 1 ELSE 0 END)
                   - (CASE WHEN old_active THEN 1 ELSE 0 END),
    0
  )
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_live_message_counts ON public.live_messages;
CREATE TRIGGER sync_live_message_counts
  AFTER INSERT OR UPDATE OF is_hidden OR DELETE ON public.live_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_live_message_counts();

CREATE OR REPLACE FUNCTION public.sync_live_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_sessions SET likes_count = likes_count + 1 WHERE id = NEW.session_id;
    RETURN NEW;
  END IF;
  UPDATE public.live_sessions
  SET likes_count = greatest(likes_count - 1, 0)
  WHERE id = OLD.session_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_live_reaction_counts ON public.live_reactions;
CREATE TRIGGER sync_live_reaction_counts
  AFTER INSERT OR DELETE ON public.live_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_live_reaction_counts();

-- Limite les rafales de reactions (une par seconde et par utilisateur).
CREATE OR REPLACE FUNCTION public.enforce_live_reaction_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.live_reactions
    WHERE session_id = NEW.session_id
      AND user_id = NEW.user_id
      AND created_at > now() - interval '1 second'
  ) THEN
    RAISE EXCEPTION 'Trop de reactions envoyees';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_live_reaction_rate ON public.live_reactions;
CREATE TRIGGER enforce_live_reaction_rate
  BEFORE INSERT ON public.live_reactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_live_reaction_rate();

-- -----------------------------------------------------------------------------
-- 5. Presence et statistiques
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_live(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_viewers integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  IF NOT public.can_view_live(p_session_id) THEN
    RAISE EXCEPTION 'Live indisponible';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = p_session_id AND status = 'live'
  ) THEN
    RAISE EXCEPTION 'Live termine';
  END IF;

  PERFORM set_config('afrixa.counter_writer', 'on', true);

  INSERT INTO public.live_viewers (session_id, user_id, joined_at, last_seen_at, left_at)
  VALUES (p_session_id, auth.uid(), now(), now(), NULL)
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET last_seen_at = now(), left_at = NULL;

  SELECT count(*) INTO active_viewers
  FROM public.live_viewers
  WHERE session_id = p_session_id
    AND left_at IS NULL
    AND last_seen_at > now() - interval '2 minutes';

  UPDATE public.live_sessions
  SET viewers_count = active_viewers,
      peak_viewers = greatest(peak_viewers, active_viewers)
  WHERE id = p_session_id;

  RETURN active_viewers;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_live(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_viewers integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('afrixa.counter_writer', 'on', true);

  UPDATE public.live_viewers
  SET left_at = now()
  WHERE session_id = p_session_id AND user_id = auth.uid() AND left_at IS NULL;

  SELECT count(*) INTO active_viewers
  FROM public.live_viewers
  WHERE session_id = p_session_id
    AND left_at IS NULL
    AND last_seen_at > now() - interval '2 minutes';

  UPDATE public.live_sessions
  SET viewers_count = active_viewers
  WHERE id = p_session_id;

  RETURN active_viewers;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_live(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_viewers integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = p_session_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Seul le createur peut terminer ce live';
  END IF;

  PERFORM set_config('afrixa.counter_writer', 'on', true);

  SELECT count(*) INTO total_viewers
  FROM public.live_viewers
  WHERE session_id = p_session_id;

  UPDATE public.live_sessions
  SET status = 'ended',
      ended_at = coalesce(ended_at, now()),
      viewers_count = greatest(viewers_count, total_viewers),
      peak_viewers = greatest(peak_viewers, total_viewers)
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_live_cohost(p_session_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = p_session_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Seul le createur peut nommer un co-animateur';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Le createur anime deja le live';
  END IF;

  INSERT INTO public.live_cohosts (session_id, user_id, invited_by, status)
  VALUES (p_session_id, p_user_id, auth.uid(), 'accepted')
  ON CONFLICT (session_id, user_id) DO UPDATE
  SET status = 'accepted', invited_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_live_cohost(p_session_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions
    WHERE id = p_session_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Seul le createur peut retirer un co-animateur';
  END IF;

  UPDATE public.live_cohosts
  SET status = 'removed'
  WHERE session_id = p_session_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_live_viewers(p_session_id uuid)
RETURNS TABLE (user_id uuid, username text, avatar_url text, is_cohost boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    viewer.user_id,
    profile.username,
    profile.avatar_url,
    EXISTS (
      SELECT 1 FROM public.live_cohosts AS cohost
      WHERE cohost.session_id = p_session_id
        AND cohost.user_id = viewer.user_id
        AND cohost.status = 'accepted'
    )
  FROM public.live_viewers AS viewer
  LEFT JOIN public.profiles AS profile ON profile.user_id = viewer.user_id
  WHERE viewer.session_id = p_session_id
    AND viewer.left_at IS NULL
    AND viewer.last_seen_at > now() - interval '2 minutes'
    AND public.is_live_moderator(p_session_id)
  ORDER BY viewer.joined_at;
$$;

CREATE OR REPLACE FUNCTION public.get_live_stats(p_session_id uuid)
RETURNS TABLE (
  viewers_total bigint,
  peak_viewers integer,
  likes_count integer,
  comments_count integer,
  duration_seconds integer,
  started_at timestamptz,
  ended_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.live_viewers AS viewer WHERE viewer.session_id = session.id)::bigint,
    session.peak_viewers,
    session.likes_count,
    session.comments_count,
    greatest(
      extract(epoch FROM (coalesce(session.ended_at, now()) - session.started_at))::integer,
      0
    ),
    session.started_at,
    session.ended_at
  FROM public.live_sessions AS session
  WHERE session.id = p_session_id
    AND public.is_live_moderator(p_session_id);
$$;

REVOKE ALL ON FUNCTION public.join_live(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_live(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_live(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_live_cohost(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_live_cohost(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_live_viewers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_live_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_live_cohost(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_live_cohost(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_live_viewers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_stats(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Diffusion Realtime du chat (si la publication existe)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
