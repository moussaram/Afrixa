-- =============================================================================
-- Phase 4 - Profils et createurs
--
-- 1. Les compteurs d abonnes / abonnements vivent sur profiles et sont
--    maintenus par la base. Le client ne peut pas les falsifier.
-- 2. Afrixa Studio lisait profile_analytics / video_analytics sans que ces
--    tables ne soient jamais alimentees : une fonction serveur les recalcule
--    a la demande a partir des vraies videos et des vrais abonnes.
-- 3. get_profile_stats expose des statistiques publiques coherentes avec la
--    visibilite des videos (publiees, approuvees, pretes, confidentialite).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Compteurs de profil
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followers_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

UPDATE public.profiles AS profile
SET followers_count = (
      SELECT count(*) FROM public.follows AS follow WHERE follow.following_id = profile.user_id
    ),
    following_count = (
      SELECT count(*) FROM public.follows AS follow WHERE follow.follower_id = profile.user_id
    );

CREATE OR REPLACE FUNCTION public.enforce_profile_counters_integrity()
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

  IF NEW.followers_count IS DISTINCT FROM OLD.followers_count
    OR NEW.following_count IS DISTINCT FROM OLD.following_count THEN
    RAISE EXCEPTION 'Les compteurs de profil sont geres par Afrixa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_counters_integrity ON public.profiles;
CREATE TRIGGER enforce_profile_counters_integrity
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_counters_integrity();

CREATE OR REPLACE FUNCTION public.sync_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('afrixa.counter_writer', 'on', true);

  IF TG_OP = 'INSERT' THEN
    -- Un auto-abonnement ne doit pas gonfler les compteurs.
    IF NEW.follower_id = NEW.following_id THEN
      RETURN NEW;
    END IF;
    UPDATE public.profiles
    SET following_count = following_count + 1
    WHERE user_id = NEW.follower_id;
    UPDATE public.profiles
    SET followers_count = followers_count + 1
    WHERE user_id = NEW.following_id;
    RETURN NEW;
  END IF;

  IF OLD.follower_id = OLD.following_id THEN
    RETURN OLD;
  END IF;
  UPDATE public.profiles
  SET following_count = greatest(following_count - 1, 0)
  WHERE user_id = OLD.follower_id;
  UPDATE public.profiles
  SET followers_count = greatest(followers_count - 1, 0)
  WHERE user_id = OLD.following_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_follow_counts ON public.follows;
CREATE TRIGGER sync_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_follow_counts();

-- -----------------------------------------------------------------------------
-- 2. Statistiques createur recalculees a la demande
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS profile_analytics_user_date_uidx
  ON public.profile_analytics (user_id, recorded_date);

CREATE UNIQUE INDEX IF NOT EXISTS video_analytics_video_date_uidx
  ON public.video_analytics (video_id, recorded_date);

CREATE OR REPLACE FUNCTION public.refresh_creator_analytics(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Createur introuvable';
  END IF;

  -- Un createur ne peut recalculer que ses propres statistiques ; le
  -- service_role peut rafraichir n importe quel compte (taches planifiees).
  IF coalesce(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Statistiques reservees au createur';
  END IF;

  INSERT INTO public.profile_analytics (
    user_id, followers_count, following_count, total_views, total_likes,
    profile_visits, new_followers, lost_followers, recorded_date
  )
  SELECT
    profile.user_id,
    profile.followers_count,
    profile.following_count,
    coalesce(sum(video.views_count), 0),
    coalesce(sum(video.likes_count), 0),
    0,
    0,
    0,
    current_date
  FROM public.profiles AS profile
  LEFT JOIN public.videos AS video
    ON video.user_id = profile.user_id
   AND video.is_published = true
   AND video.moderation_status = 'approved'
   AND video.cloudflare_status = 'ready'
  WHERE profile.user_id = p_user_id
  GROUP BY profile.user_id, profile.followers_count, profile.following_count
  ON CONFLICT (user_id, recorded_date) DO UPDATE
  SET followers_count = excluded.followers_count,
      following_count = excluded.following_count,
      total_views = excluded.total_views,
      total_likes = excluded.total_likes;

  INSERT INTO public.video_analytics (
    video_id, user_id, views, likes, comments, shares, saves, recorded_date
  )
  SELECT
    video.id,
    video.user_id,
    video.views_count,
    video.likes_count,
    video.comments_count,
    video.shares_count,
    video.saves_count,
    current_date
  FROM public.videos AS video
  WHERE video.user_id = p_user_id
    AND video.is_published = true
    AND video.moderation_status = 'approved'
    AND video.cloudflare_status = 'ready'
  ON CONFLICT (video_id, recorded_date) DO UPDATE
  SET views = excluded.views,
      likes = excluded.likes,
      comments = excluded.comments,
      shares = excluded.shares,
      saves = excluded.saves;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_my_creator_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  PERFORM public.refresh_creator_analytics(auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_creator_analytics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_my_creator_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_my_creator_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_creator_analytics(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Statistiques publiques d un profil
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_profile_stats(p_user_id uuid)
RETURNS TABLE (
  followers_count integer,
  following_count integer,
  videos_count bigint,
  likes_count bigint,
  views_count bigint,
  comments_count bigint,
  is_following boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    coalesce(profile.followers_count, 0),
    coalesce(profile.following_count, 0),
    coalesce(aggregate.videos_count, 0),
    coalesce(aggregate.likes_count, 0),
    coalesce(aggregate.views_count, 0),
    coalesce(aggregate.comments_count, 0),
    EXISTS (
      SELECT 1
      FROM public.follows AS follow
      WHERE follow.follower_id = auth.uid()
        AND follow.following_id = p_user_id
    )
  FROM (SELECT 1) AS seed
  LEFT JOIN public.profiles AS profile ON profile.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS videos_count,
      coalesce(sum(video.likes_count), 0)::bigint AS likes_count,
      coalesce(sum(video.views_count), 0)::bigint AS views_count,
      coalesce(sum(video.comments_count), 0)::bigint AS comments_count
    FROM public.videos AS video
    WHERE video.user_id = p_user_id
      AND video.is_published = true
      AND video.moderation_status = 'approved'
      AND video.cloudflare_status = 'ready'
      AND (
        auth.uid() = p_user_id
        OR public.can_view_creator_content(video.user_id, coalesce(video.privacy, 'public'))
      )
  ) AS aggregate ON true;
$$;

REVOKE ALL ON FUNCTION public.get_profile_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_stats(uuid) TO authenticated;
