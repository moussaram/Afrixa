-- =============================================================================
-- Phase 3 - Fil d actualite, recommandations et pagination
--
-- 1. Le fil est construit cote serveur : le client ne peut ni choisir des
--    videos invisibles, ni contourner la moderation, Cloudflare, la
--    confidentialite ou les blocages.
-- 2. "Abonnements" ne renvoie que les createurs suivis, du plus recent au plus
--    ancien. "Pour toi" classe par score d engagement decroissant dans le
--    temps (likes, commentaires, partages, favoris) avec un bonus pour les
--    createurs suivis, afin de recommander du contenu sans le limiter aux
--    abonnements.
-- 3. La pagination est stable (OFFSET/LIMIT avec tri deterministe) pour
--    alimenter le scroll infini.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_feed(
  p_mode text DEFAULT 'foryou',
  p_limit integer DEFAULT 8,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.videos
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  viewer uuid := auth.uid();
  page_size integer := least(greatest(coalesce(p_limit, 8), 1), 50);
  page_offset integer := greatest(coalesce(p_offset, 0), 0);
BEGIN
  -- Le fil est personnel : sans session, il n y a rien a recommander.
  IF viewer IS NULL THEN
    RETURN;
  END IF;

  IF p_mode NOT IN ('foryou', 'following') THEN
    RAISE EXCEPTION 'Mode de fil inconnu: %', p_mode;
  END IF;

  IF p_mode = 'following' THEN
    RETURN QUERY
    SELECT video.*
    FROM public.videos AS video
    WHERE video.is_published = true
      AND video.moderation_status = 'approved'
      AND video.cloudflare_status = 'ready'
      AND public.can_view_creator_content(video.user_id, coalesce(video.privacy, 'public'))
      AND EXISTS (
        SELECT 1
        FROM public.follows AS follow
        WHERE follow.follower_id = viewer
          AND follow.following_id = video.user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_blocks AS block
        WHERE (block.blocker_id = viewer AND block.blocked_id = video.user_id)
           OR (block.blocker_id = video.user_id AND block.blocked_id = viewer)
      )
    ORDER BY video.created_at DESC, video.id DESC
    LIMIT page_size OFFSET page_offset;

    RETURN;
  END IF;

  -- Score "Pour toi" : engagement pondere, divise par l age en heures (le
  -- contenu recent remonte), bonus de 35 % pour les createurs suivis.
  RETURN QUERY
  SELECT video.*
  FROM public.videos AS video
  WHERE video.is_published = true
    AND video.moderation_status = 'approved'
    AND video.cloudflare_status = 'ready'
    AND public.can_view_creator_content(video.user_id, coalesce(video.privacy, 'public'))
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks AS block
      WHERE (block.blocker_id = viewer AND block.blocked_id = video.user_id)
         OR (block.blocker_id = video.user_id AND block.blocked_id = viewer)
    )
  ORDER BY
    (
      (
        coalesce(video.likes_count, 0) * 3
        + coalesce(video.comments_count, 0) * 4
        + coalesce(video.shares_count, 0) * 6
        + coalesce(video.saves_count, 0) * 5
      )::numeric
      / (2 + extract(epoch FROM (now() - video.created_at)) / 3600)
      * CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.follows AS follow
            WHERE follow.follower_id = viewer
              AND follow.following_id = video.user_id
          ) THEN 1.35
          ELSE 1
        END
    ) DESC,
    video.created_at DESC,
    video.id DESC
  LIMIT page_size OFFSET page_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feed(text, integer, integer) TO authenticated;

-- Tri de base du fil (les deux modes filtrent sur ces trois colonnes).
CREATE INDEX IF NOT EXISTS videos_feed_published_idx
  ON public.videos (created_at DESC)
  WHERE is_published = true
    AND moderation_status = 'approved'
    AND cloudflare_status = 'ready';
