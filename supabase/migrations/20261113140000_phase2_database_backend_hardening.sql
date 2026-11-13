-- Afrixa Phase 2: canonical comments, query indexes and batched scoring.
-- This migration is intentionally staged in Git only. Validate it on a dedicated
-- Supabase staging database before applying it anywhere.

BEGIN;

-- ---------------------------------------------------------------------------
-- DB-01: public.comments is the canonical comment model.
-- Preserve legacy video_comments rows (including nested replies) before locking
-- the old table against client writes. Roots are copied first; descendants are
-- copied iteratively so every parent exists before its child.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  inserted_rows integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.video_comments WHERE char_length(content) > 500
  ) THEN
    RAISE EXCEPTION
      'Phase 2 migration stopped: legacy video_comments contains content longer than the canonical 500-character limit';
  END IF;

  INSERT INTO public.comments (
    id, video_id, user_id, parent_id, content, is_deleted, created_at
  )
  SELECT
    legacy.id, legacy.video_id, legacy.user_id, NULL, legacy.content,
    legacy.is_deleted, legacy.created_at
  FROM public.video_comments AS legacy
  WHERE legacy.parent_id IS NULL
  ON CONFLICT (id) DO NOTHING;

  LOOP
    INSERT INTO public.comments (
      id, video_id, user_id, parent_id, content, is_deleted, created_at
    )
    SELECT
      legacy.id, legacy.video_id, legacy.user_id, legacy.parent_id,
      legacy.content, legacy.is_deleted, legacy.created_at
    FROM public.video_comments AS legacy
    WHERE legacy.parent_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.comments AS parent
        WHERE parent.id = legacy.parent_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.comments AS existing
        WHERE existing.id = legacy.id
      )
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS inserted_rows = ROW_COUNT;
    EXIT WHEN inserted_rows = 0;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.video_comments AS legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM public.comments AS migrated
      WHERE migrated.id = legacy.id
    )
  ) THEN
    RAISE EXCEPTION
      'Phase 2 migration stopped: one or more legacy comments could not be mapped to the canonical comments table';
  END IF;
END;
$$;

-- video_comments is retained temporarily for rollback/audit, but it is no
-- longer an application write target.
REVOKE ALL PRIVILEGES ON TABLE public.video_comments FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- DB-04: indexes for actual feed, reply, like, and follow access patterns.
-- Remove redundant indexes after confirming the composite replacements exist.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS comments_top_level_feed_idx
  ON public.comments (video_id, is_pinned DESC, created_at DESC)
  WHERE parent_id IS NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS comments_parent_created_idx
  ON public.comments (parent_id, created_at ASC)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS comment_likes_user_comment_idx
  ON public.comment_likes (user_id, comment_id);

CREATE INDEX IF NOT EXISTS follows_follower_following_idx
  ON public.follows (follower_id, following_id);

-- Both existing indexes cover the same messages lookup; keep the DESC index
-- used by conversation history queries.
DROP INDEX IF EXISTS public.idx_messages_conversation_id;

-- The composite index (user_id, created_at DESC) already covers user_id-only
-- video lookups, so the standalone index is redundant.
DROP INDEX IF EXISTS public.idx_videos_user_id;

-- ---------------------------------------------------------------------------
-- PERF-01 / PERF-02: calculate scores in set-based video batches.
-- The browser/Edge Function no longer builds a users x videos array in memory,
-- and the algorithm walks every eligible video rather than stopping at 500.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_video_scores_batch(
  p_after_video_id uuid DEFAULT NULL,
  p_batch_size integer DEFAULT 200
)
RETURNS TABLE (
  processed_videos integer,
  scored_rows bigint,
  next_after_video_id uuid,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  batch_limit integer := least(greatest(coalesce(p_batch_size, 200), 1), 500);
  processed_count integer := 0;
  score_count bigint := 0;
  last_video_id uuid := NULL;
  more_videos boolean := false;
  calculated_at timestamptz := now();
BEGIN
  WITH batch_videos AS MATERIALIZED (
    SELECT
      video.id,
      video.title,
      video.description,
      video.views_count,
      video.likes_count,
      video.comments_count,
      video.shares_count,
      video.created_at
    FROM public.videos AS video
    WHERE video.is_published = true
      AND video.moderation_status = 'approved'
      AND video.cloudflare_status = 'ready'
      AND (p_after_video_id IS NULL OR video.id > p_after_video_id)
    ORDER BY video.id
    LIMIT batch_limit
  ),
  score_rows AS (
    SELECT
      interest.user_id,
      video.id AS video_id,
      round(
        (
          CASE WHEN EXISTS (
            SELECT 1
            FROM unnest(coalesce(interest.categories, ARRAY[]::text[])) AS category(value)
            WHERE nullif(btrim(category.value), '') IS NOT NULL
              AND position(
                lower(btrim(category.value))
                IN lower(concat_ws(' ', video.title, video.description))
              ) > 0
          ) THEN 30 ELSE 0 END
        )
        +
        least(
          (
            coalesce(video.likes_count, 0)::numeric
            + coalesce(video.comments_count, 0)::numeric
            + coalesce(video.shares_count, 0)::numeric
          ) / greatest(coalesce(video.views_count, 0), 1),
          1
        ) * 25
        +
        CASE
          WHEN extract(epoch FROM (calculated_at - coalesce(video.created_at, calculated_at))) / 3600.0 < 48
            THEN 10
          ELSE greatest(
            0,
            1 - (
              extract(epoch FROM (calculated_at - coalesce(video.created_at, calculated_at))) / 3600.0
            ) / 720.0
          ) * 10
        END
        )::numeric
      )::double precision AS score
    FROM public.user_interests AS interest
    CROSS JOIN batch_videos AS video
    WHERE NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(interest.not_interested, ARRAY[]::text[])) AS excluded(value)
      WHERE nullif(btrim(excluded.value), '') IS NOT NULL
        AND position(
          lower(btrim(excluded.value))
          IN lower(concat_ws(' ', video.title, video.description))
        ) > 0
    )
  ),
  upserted AS (
    INSERT INTO public.video_scores (user_id, video_id, score, last_calculated)
    SELECT user_id, video_id, score, calculated_at
    FROM score_rows
    ON CONFLICT (video_id, user_id) DO UPDATE
      SET score = EXCLUDED.score,
          last_calculated = EXCLUDED.last_calculated
    RETURNING 1
  )
  SELECT
    (SELECT count(*)::integer FROM batch_videos),
    (SELECT count(*)::bigint FROM upserted),
    (SELECT max(id) FROM batch_videos)
  INTO processed_count, score_count, last_video_id;

  IF processed_count > 0 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.videos AS video
      WHERE video.is_published = true
        AND video.moderation_status = 'approved'
        AND video.cloudflare_status = 'ready'
        AND video.id > last_video_id
    ) INTO more_videos;
  END IF;

  RETURN QUERY
  SELECT processed_count, score_count, last_video_id, more_videos;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_video_scores_batch(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_video_scores_batch(uuid, integer)
  TO service_role;

COMMIT;
