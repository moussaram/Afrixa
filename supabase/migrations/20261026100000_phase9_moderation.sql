-- =============================================================================
-- Phase 9 - Moderation, signalements et sanctions
--
-- 1. Les signalements passent par une fonction serveur : contenu verifie,
--    auteur identifie, doublons et limite quotidienne, auto-masquage apres
--    plusieurs signalements.
-- 2. File de moderation lisible par les moderateurs (platform_admins), avec
--    decisions : classer, avertir, restreindre 24 h, bannir 7 jours ou
--    definitivement. Chaque sanction est enregistree et notifiee.
-- 3. Les sanctions et les mots interdits graves sont appliques cote serveur :
--    un compte restreint ne peut plus publier, commenter ni ecrire en live.
-- 4. Les types de contenu signalables couvrent video, commentaire, produit,
--    message, profil, utilisateur, live, story et publicite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Signalements : types, auteur cible et resolution
-- -----------------------------------------------------------------------------

ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_action text,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS auto_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_content_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_content_type_check CHECK (
  content_type IN ('video', 'comment', 'product', 'message', 'profile', 'user', 'live', 'story', 'ad')
);

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_pending_unique
  ON public.content_reports(reporter_id, content_type, content_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_pending_content_idx
  ON public.content_reports(content_type, content_id)
  WHERE status = 'pending';

-- Le masquage automatique des videos doit etre respecte par la lecture.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS hidden_by_reports boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Videos visibles selon leur confidentialite" ON public.videos;
CREATE POLICY "Videos visibles selon leur confidentialite"
  ON public.videos FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      is_published = true
      AND moderation_status = 'approved'
      AND cloudflare_status = 'ready'
      AND hidden_by_reports = false
      AND public.can_view_creator_content(user_id, privacy)
    )
  );

DROP POLICY IF EXISTS "content_reports_owner_insert" ON public.content_reports;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.content_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.content_reports TO authenticated;

CREATE TABLE IF NOT EXISTS public.moderation_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  reports_to_hide integer NOT NULL DEFAULT 3 CHECK (reports_to_hide BETWEEN 0 AND 50),
  max_reports_per_day integer NOT NULL DEFAULT 20 CHECK (max_reports_per_day > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.moderation_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.moderation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moderation_settings_read" ON public.moderation_settings;
CREATE POLICY "moderation_settings_read"
  ON public.moderation_settings FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.moderation_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_settings TO service_role;

ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS source_report_id uuid REFERENCES public.content_reports(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.role(), '') = 'service_role' OR public.is_platform_admin();
$$;

REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;

DROP POLICY IF EXISTS "content_reports_moderator_select" ON public.content_reports;
CREATE POLICY "content_reports_moderator_select"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS "moderation_actions_moderator_select" ON public.moderation_actions;
CREATE POLICY "moderation_actions_moderator_select"
  ON public.moderation_actions FOR SELECT
  TO authenticated
  USING (public.is_moderator());

-- -----------------------------------------------------------------------------
-- 2. Masquage de contenu par la moderation
-- -----------------------------------------------------------------------------

-- Les triggers de la Phase 2 / Phase 5 autorisent deja l auteur, le createur
-- ou un co-animateur a masquer. La moderation doit pouvoir le faire aussi.
CREATE OR REPLACE FUNCTION public.enforce_comment_moderation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  video_owner uuid;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
    OR coalesce(current_setting('afrixa.moderation_writer', true), '') = 'on' THEN
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

CREATE OR REPLACE FUNCTION public.enforce_live_message_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('afrixa.moderation_writer', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.hide_reported_content(
  p_content_type text,
  p_content_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.moderation_writer', 'on', true);

  IF p_content_type = 'video' THEN
    UPDATE public.videos SET hidden_by_reports = true WHERE id = p_content_id;
  ELSIF p_content_type = 'comment' THEN
    UPDATE public.comments SET is_deleted = true WHERE id = p_content_id;
  ELSIF p_content_type = 'live' THEN
    UPDATE public.live_messages SET is_hidden = true WHERE session_id = p_content_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hide_reported_content(text, uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Signalement par un utilisateur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_report(
  p_content_type text,
  p_content_id uuid,
  p_reason text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_target uuid;
  v_settings public.moderation_settings%ROWTYPE;
  v_report_id uuid;
  v_pending integer;
  v_today integer;
  v_auto_hidden boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour signaler';
  END IF;
  IF p_content_type NOT IN ('video', 'comment', 'product', 'message', 'profile', 'user', 'live', 'story', 'ad') THEN
    RAISE EXCEPTION 'Type de contenu invalide';
  END IF;
  IF p_content_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) < 3 OR length(btrim(p_reason)) > 200 THEN
    RAISE EXCEPTION 'Motif de signalement invalide';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description de signalement trop longue';
  END IF;

  IF p_content_type = 'video' THEN
    SELECT user_id INTO v_target FROM public.videos WHERE id = p_content_id;
  ELSIF p_content_type = 'comment' THEN
    SELECT user_id INTO v_target FROM public.comments WHERE id = p_content_id AND is_deleted = false;
  ELSIF p_content_type = 'live' THEN
    SELECT host_id INTO v_target FROM public.live_sessions WHERE id = p_content_id;
  ELSIF p_content_type IN ('user', 'profile') THEN
    SELECT user_id INTO v_target FROM public.profiles WHERE user_id = p_content_id;
  ELSIF p_content_type = 'ad' THEN
    SELECT advertiser_id INTO v_target FROM public.ad_campaigns WHERE id = p_content_id;
  ELSIF p_content_type = 'product' THEN
    SELECT seller_id INTO v_target FROM public.products WHERE id = p_content_id;
  ELSIF p_content_type = 'message' THEN
    SELECT sender_id INTO v_target FROM public.messages WHERE id = p_content_id;
  ELSIF p_content_type = 'story' THEN
    SELECT user_id INTO v_target FROM public.stories WHERE id = p_content_id;
  END IF;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Contenu introuvable';
  END IF;
  IF v_target = v_user THEN
    RAISE EXCEPTION 'Impossible de signaler son propre contenu';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.content_reports
    WHERE reporter_id = v_user
      AND content_type = p_content_type
      AND content_id = p_content_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ce contenu a deja ete signale';
  END IF;

  SELECT * INTO v_settings FROM public.moderation_settings WHERE id = 1;
  SELECT count(*) INTO v_today
  FROM public.content_reports
  WHERE reporter_id = v_user AND created_at >= date_trunc('day', now());
  IF v_today >= coalesce(v_settings.max_reports_per_day, 20) THEN
    RAISE EXCEPTION 'Limite quotidienne de signalements atteinte';
  END IF;

  INSERT INTO public.content_reports (
    reporter_id, content_type, content_id, reason, description, status, target_user_id
  ) VALUES (
    v_user, p_content_type, p_content_id, btrim(p_reason),
    nullif(btrim(coalesce(p_description, '')), ''), 'pending', v_target
  )
  RETURNING id INTO v_report_id;

  SELECT count(*) INTO v_pending
  FROM public.content_reports
  WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending';

  IF coalesce(v_settings.reports_to_hide, 3) > 0 AND v_pending >= v_settings.reports_to_hide THEN
    PERFORM public.hide_reported_content(p_content_type, p_content_id);
    UPDATE public.content_reports
    SET auto_hidden = true
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending';
    v_auto_hidden := true;
  END IF;

  RETURN jsonb_build_object(
    'report_id', v_report_id,
    'status', 'pending',
    'auto_hidden', v_auto_hidden
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_report(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_report(text, uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. File et decisions de moderation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_moderation_reports(
  p_status text DEFAULT 'pending',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  content_type text,
  content_id uuid,
  reason text,
  description text,
  status text,
  auto_hidden boolean,
  created_at timestamptz,
  reporter_username text,
  target_user_id uuid,
  target_username text,
  reports_on_content bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Reserve a la moderation Afrixa';
  END IF;

  RETURN QUERY
  SELECT
    report.id,
    report.content_type,
    report.content_id,
    report.reason,
    report.description,
    report.status,
    report.auto_hidden,
    report.created_at,
    reporter.username,
    report.target_user_id,
    target.username,
    (
      SELECT count(*)
      FROM public.content_reports AS same
      WHERE same.content_type = report.content_type
        AND same.content_id = report.content_id
        AND same.status = 'pending'
    ) AS reports_on_content
  FROM public.content_reports AS report
  LEFT JOIN public.profiles AS reporter ON reporter.user_id = report.reporter_id
  LEFT JOIN public.profiles AS target ON target.user_id = report.target_user_id
  WHERE p_status IS NULL OR report.status = p_status
  ORDER BY report.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.list_moderation_reports(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_moderation_reports(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_user_sanction(
  p_user_id uuid,
  p_action text,
  p_reason text,
  p_content_type text DEFAULT NULL,
  p_content_id uuid DEFAULT NULL,
  p_source_report_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action_id uuid;
  v_expires timestamptz;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Reserve a la moderation Afrixa';
  END IF;
  IF p_user_id IS NULL OR p_action NOT IN ('warning', 'restrict_24h', 'ban_7days', 'ban_permanent') THEN
    RAISE EXCEPTION 'Sanction invalide';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Motif de sanction invalide';
  END IF;

  v_expires := CASE p_action
    WHEN 'restrict_24h' THEN now() + interval '24 hours'
    WHEN 'ban_7days' THEN now() + interval '7 days'
    ELSE NULL
  END;

  INSERT INTO public.moderation_actions (
    user_id, action_type, reason, content_type, content_id, admin_id,
    expires_at, is_active, source_report_id
  ) VALUES (
    p_user_id, p_action, left(btrim(p_reason), 300), p_content_type, p_content_id,
    auth.uid(), v_expires, true, p_source_report_id
  )
  RETURNING id INTO v_action_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    p_user_id,
    'Modération Afrixa',
    CASE p_action
      WHEN 'warning' THEN 'Avertissement : ' || left(btrim(p_reason), 200)
      WHEN 'restrict_24h' THEN 'Ton compte est restreint pendant 24 heures : ' || left(btrim(p_reason), 200)
      WHEN 'ban_7days' THEN 'Ton compte est suspendu 7 jours : ' || left(btrim(p_reason), 200)
      ELSE 'Ton compte est suspendu : ' || left(btrim(p_reason), 200)
    END,
    'moderation'
  );

  RETURN jsonb_build_object(
    'action_id', v_action_id,
    'action', p_action,
    'expires_at', v_expires,
    'active', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_user_sanction(uuid, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_user_sanction(uuid, text, text, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.moderate_report(
  p_report_id uuid,
  p_action text,
  p_note text DEFAULT NULL,
  p_hide_content boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_report public.content_reports%ROWTYPE;
  v_sanction jsonb;
BEGIN
  IF NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Reserve a la moderation Afrixa';
  END IF;
  IF p_action NOT IN ('dismiss', 'warning', 'restrict_24h', 'ban_7days', 'ban_permanent') THEN
    RAISE EXCEPTION 'Decision de moderation invalide';
  END IF;

  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signalement introuvable';
  END IF;
  IF v_report.status <> 'pending' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', v_report.status);
  END IF;

  UPDATE public.content_reports
  SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'action_taken' END,
      reviewed_by = auth.uid(),
      resolved_at = now(),
      resolution_action = p_action,
      resolution_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
  WHERE id = v_report.id;

  IF p_hide_content THEN
    PERFORM public.hide_reported_content(v_report.content_type, v_report.content_id);
  END IF;

  IF p_action <> 'dismiss' AND v_report.target_user_id IS NOT NULL THEN
    v_sanction := public.apply_user_sanction(
      v_report.target_user_id,
      p_action,
      coalesce(nullif(btrim(coalesce(p_note, '')), ''), v_report.reason),
      v_report.content_type,
      v_report.content_id,
      v_report.id
    );
  END IF;

  RETURN jsonb_build_object(
    'duplicate', false,
    'status', CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'action_taken' END,
    'sanction', v_sanction,
    'content_hidden', p_hide_content
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_report(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_report(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_moderation_status()
RETURNS TABLE (
  action_type text,
  reason text,
  content_type text,
  created_at timestamptz,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  RETURN QUERY
  SELECT
    action.action_type,
    action.reason,
    action.content_type,
    action.created_at,
    action.expires_at,
    (action.is_active AND (action.expires_at IS NULL OR action.expires_at > now()))
  FROM public.moderation_actions AS action
  WHERE action.user_id = auth.uid()
  ORDER BY action.created_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_moderation_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_moderation_status() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Application serveur des sanctions et des mots interdits graves
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contains_banned_high(p_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.banned_words AS word
    WHERE word.severity = 'high'
      AND p_text IS NOT NULL
      AND position(lower(word.word) in lower(p_text)) > 0
  );
$$;

REVOKE ALL ON FUNCTION public.contains_banned_high(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contains_banned_high(text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_community_sanctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_content text;
  v_restriction public.moderation_actions%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_restriction
  FROM public.moderation_actions AS action
  WHERE action.user_id = auth.uid()
    AND action.is_active = true
    AND action.action_type IN ('restrict_24h', 'ban_7days', 'ban_permanent')
    AND (action.expires_at IS NULL OR action.expires_at > now())
  ORDER BY action.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Compte restreint par la moderation : %', v_restriction.reason;
  END IF;

  IF TG_TABLE_NAME = 'comments' THEN
    v_content := NEW.content;
  ELSIF TG_TABLE_NAME = 'live_messages' THEN
    v_content := NEW.content;
  ELSE
    v_content := concat_ws(' ', NEW.title, NEW.description);
  END IF;

  IF public.contains_banned_high(v_content) THEN
    RAISE EXCEPTION 'Ce contenu contient des termes interdits par Afrixa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_community_sanctions ON public.comments;
CREATE TRIGGER enforce_community_sanctions
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_community_sanctions();

DROP TRIGGER IF EXISTS enforce_community_sanctions ON public.live_messages;
CREATE TRIGGER enforce_community_sanctions
  BEFORE INSERT ON public.live_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_community_sanctions();

DROP TRIGGER IF EXISTS enforce_community_sanctions ON public.videos;
CREATE TRIGGER enforce_community_sanctions
  BEFORE INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_community_sanctions();

COMMENT ON FUNCTION public.submit_report(text, uuid, text, text) IS
  'Signalement serveur : verifie le contenu, identifie l auteur, bloque les doublons et auto-masque.';
COMMENT ON FUNCTION public.moderate_report(uuid, text, text, boolean) IS
  'Decision de moderation : classement, avertissement, restriction ou bannissement, avec notification.';
COMMENT ON FUNCTION public.enforce_community_sanctions() IS
  'Bloque la publication des comptes restreints et des contenus contenant des mots interdits graves.';
