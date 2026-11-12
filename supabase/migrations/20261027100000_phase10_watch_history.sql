-- =============================================================================
-- Phase 10 : historique de visionnage reel
-- La table video_watch_history existait mais n etait jamais alimentee : la
-- reprise de lecture, la detection des videos deja vues et les gains de vues
-- (Phase 7) ne pouvaient donc pas fonctionner.
-- =============================================================================

CREATE INDEX IF NOT EXISTS video_watch_history_user_recent_idx
  ON public.video_watch_history (user_id, last_watched_at DESC);

CREATE OR REPLACE FUNCTION public.record_video_watch(
  p_video_id uuid,
  p_position double precision,
  p_duration double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_video public.videos%ROWTYPE;
  v_existing public.video_watch_history%ROWTYPE;
  v_position double precision := greatest(coalesce(p_position, 0), 0);
  v_duration double precision := greatest(coalesce(p_duration, 0), 0);
  v_completion double precision := 0;
  v_new_view boolean := false;
  v_saved_position double precision;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour enregistrer une lecture';
  END IF;

  SELECT * INTO v_video FROM public.videos WHERE id = p_video_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Video introuvable';
  END IF;

  -- Le proprietaire voit toujours ses videos ; les autres doivent y avoir acces
  -- (meme regle de confidentialite que la politique de lecture).
  IF v_video.user_id <> v_user AND NOT (
    v_video.is_published = true
    AND v_video.moderation_status = 'approved'
    AND v_video.cloudflare_status = 'ready'
    AND v_video.hidden_by_reports = false
    AND public.can_view_creator_content(v_video.user_id, v_video.privacy)
  ) THEN
    RAISE EXCEPTION 'Video indisponible';
  END IF;

  IF v_duration > 0 THEN
    v_completion := least(greatest(v_position / v_duration, 0), 1);
  END IF;

  SELECT * INTO v_existing
  FROM public.video_watch_history
  WHERE user_id = v_user AND video_id = p_video_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_new_view := true;
  ELSIF v_existing.last_watched_at < now() - interval '30 minutes' THEN
    v_new_view := true;
  END IF;

  -- Une video terminee repart du debut a la prochaine ouverture.
  v_saved_position := CASE WHEN v_completion >= 0.95 THEN 0 ELSE v_position END;

  IF v_new_view THEN
    INSERT INTO public.video_watch_history (
      user_id, video_id, watch_duration, completion_rate, last_position, watch_count, last_watched_at
    ) VALUES (
      v_user, p_video_id, v_position, v_completion, v_saved_position, 1, now()
    )
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      watch_duration = EXCLUDED.watch_duration,
      completion_rate = EXCLUDED.completion_rate,
      last_position = EXCLUDED.last_position,
      watch_count = public.video_watch_history.watch_count + 1,
      last_watched_at = now();
  ELSE
    UPDATE public.video_watch_history AS history
    SET
      watch_duration = greatest(history.watch_duration, v_position),
      completion_rate = greatest(history.completion_rate, v_completion),
      last_position = v_saved_position,
      last_watched_at = now()
    WHERE history.user_id = v_user AND history.video_id = p_video_id;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'watch_duration', history.watch_duration,
      'completion_rate', history.completion_rate,
      'last_position', history.last_position,
      'watch_count', history.watch_count,
      'is_new_view', v_new_view
    )
    FROM public.video_watch_history AS history
    WHERE history.user_id = v_user AND history.video_id = p_video_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_video_watch(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_video_watch(uuid, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_watch_states(p_video_ids uuid[])
RETURNS TABLE (
  video_id uuid,
  last_position double precision,
  completion_rate double precision,
  watch_count integer,
  completed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    history.video_id,
    history.last_position,
    history.completion_rate,
    history.watch_count,
    history.completion_rate >= 0.95 AS completed
  FROM public.video_watch_history AS history
  WHERE history.user_id = auth.uid()
    AND history.video_id = ANY (coalesce(p_video_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public.get_watch_states(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_watch_states(uuid[]) TO authenticated;
