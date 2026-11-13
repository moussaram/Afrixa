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

  IF EXISTS (
    SELECT 1
    FROM public.video_comments AS legacy
    JOIN public.comments AS current ON current.id = legacy.id
    WHERE current.video_id IS DISTINCT FROM legacy.video_id
       OR current.user_id IS DISTINCT FROM legacy.user_id
       OR current.parent_id IS DISTINCT FROM legacy.parent_id
       OR current.content IS DISTINCT FROM legacy.content
       OR current.is_deleted IS DISTINCT FROM legacy.is_deleted
       OR current.created_at IS DISTINCT FROM legacy.created_at
  ) THEN
    RAISE EXCEPTION
      'Phase 2 migration stopped: a legacy comment ID conflicts with different canonical comment data';
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

-- A comment and a comment-like must always belong to a real authenticated
-- user and a real parent record. Stop rather than silently discard legacy rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.comments WHERE user_id IS NULL OR video_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.comment_likes WHERE user_id IS NULL OR comment_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.user_interests WHERE user_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.video_scores WHERE user_id IS NULL OR video_id IS NULL) THEN
    RAISE EXCEPTION
      'Phase 2 migration stopped: comments, likes, interests, or scores contain rows without required owner/parent references';
  END IF;

  ALTER TABLE public.comments
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN video_id SET NOT NULL;
  ALTER TABLE public.comment_likes
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN comment_id SET NOT NULL;
  ALTER TABLE public.user_interests
    ALTER COLUMN user_id SET NOT NULL;
  ALTER TABLE public.video_scores
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN video_id SET NOT NULL;
END;
$$;

-- Comments inherit the visibility of their parent video. The old permissive
-- policy exposed comments even when the corresponding video was private,
-- blocked, unapproved, or not yet ready.
DROP POLICY IF EXISTS comments_public_select ON public.comments;
CREATE POLICY comments_visible_with_video
  ON public.comments FOR SELECT
  TO anon, authenticated
  USING (
    is_deleted = false
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.videos AS video
        WHERE video.id = comments.video_id
          AND video.is_published = true
          AND video.moderation_status = 'approved'
          AND video.cloudflare_status = 'ready'
          AND public.can_view_creator_content(
            video.user_id,
            coalesce(video.privacy, 'public')
          )
      )
    )
  );

DROP POLICY IF EXISTS comments_owner_insert ON public.comments;
CREATE POLICY comments_owner_insert
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS comments_owner_update ON public.comments;
CREATE POLICY comments_owner_update
  ON public.comments FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS comment_likes_owner_all ON public.comment_likes;
CREATE POLICY comment_likes_owner_all
  ON public.comment_likes FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS user_interests_owner_all ON public.user_interests;
CREATE POLICY user_interests_owner_all
  ON public.user_interests FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);

DROP POLICY IF EXISTS video_scores_owner_select ON public.video_scores;
CREATE POLICY video_scores_owner_select
  ON public.video_scores FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.video_scores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.video_scores TO authenticated;

-- ---------------------------------------------------------------------------
-- DB-04: indexes for actual feed, reply, like, and follow access patterns.
-- Remove redundant indexes after confirming the composite replacements exist.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS comments_top_level_feed_idx
  ON public.comments (video_id, is_pinned DESC, created_at DESC)
  WHERE parent_id IS NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS comments_parent_created_idx
  ON public.comments (parent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS comment_likes_user_comment_idx
  ON public.comment_likes (user_id, comment_id);

-- Complete the foreign-key index gaps reported by the Supabase performance
-- advisor. Existing primary/composite indexes are intentionally not duplicated.
DO $$
DECLARE
  index_spec text[];
BEGIN
  FOREACH index_spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['ad_impressions', 'campaign_id'],
    ARRAY['ad_impressions', 'user_id'],
    ARRAY['challenge_submissions', 'challenge_id'],
    ARRAY['challenge_submissions', 'user_id'],
    ARRAY['challenge_submissions', 'video_id'],
    ARRAY['coin_purchases', 'user_id'],
    ARRAY['coin_transactions', 'user_id'],
    ARRAY['collab_requests', 'receiver_id'],
    ARRAY['collab_requests', 'sender_id'],
    ARRAY['collab_requests', 'video_id'],
    ARRAY['collab_videos', 'creator_1'],
    ARRAY['collab_videos', 'creator_2'],
    ARRAY['collab_videos', 'video_id'],
    ARRAY['comment_mentions', 'comment_id'],
    ARRAY['comment_mentions', 'mentioned_user_id'],
    ARRAY['comments', 'user_id'],
    ARRAY['commissions', 'order_id'],
    ARRAY['content_reports', 'reporter_id'],
    ARRAY['content_reports', 'reviewed_by'],
    ARRAY['conversations', 'last_sender_id'],
    ARRAY['conversations', 'participant_2'],
    ARRAY['creator_earnings', 'video_id'],
    ARRAY['disputes', 'order_id'],
    ARRAY['fan_club_memberships', 'fan_club_id'],
    ARRAY['fan_club_memberships', 'user_id'],
    ARRAY['gift_transactions', 'gift_id'],
    ARRAY['gift_transactions', 'receiver_id'],
    ARRAY['gift_transactions', 'sender_id'],
    ARRAY['live_sessions', 'pinned_product_id'],
    ARRAY['live_sessions', 'replay_video_id'],
    ARRAY['messages', 'product_id'],
    ARRAY['messages', 'sender_id'],
    ARRAY['moderation_actions', 'admin_id'],
    ARRAY['notifications', 'order_id'],
    ARRAY['order_timeline', 'order_id'],
    ARRAY['reviews', 'order_id'],
    ARRAY['seller_payouts', 'order_id'],
    ARRAY['series_episodes', 'series_id'],
    ARRAY['series_episodes', 'video_id'],
    ARRAY['series_subscriptions', 'user_id'],
    ARRAY['sounds', 'creator_id'],
    ARRAY['spotlights', 'user_id'],
    ARRAY['spotlights', 'video_id'],
    ARRAY['story_views', 'viewer_id'],
    ARRAY['typing_indicators', 'user_id'],
    ARRAY['user_blocks', 'blocked_id'],
    ARRAY['video_analytics', 'video_id'],
    ARRAY['video_comments', 'parent_id'],
    ARRAY['video_comments', 'user_id'],
    ARRAY['video_likes', 'user_id'],
    ARRAY['video_saves', 'user_id'],
    ARRAY['video_watch_history', 'video_id'],
    ARRAY['videos', 'series_id'],
    ARRAY['videos', 'sound_id']
  ]
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      index_spec[1] || '_' || index_spec[2] || '_idx',
      index_spec[1],
      index_spec[2]
    );
  END LOOP;
END;
$$;

-- Both existing indexes cover the same messages lookup; keep the DESC index
-- used by conversation history queries.
DROP INDEX IF EXISTS public.idx_messages_conversation_id;

-- The composite index (user_id, created_at DESC) already covers user_id-only
-- video lookups, so the standalone index is redundant.
DROP INDEX IF EXISTS public.idx_videos_user_id;

-- Remove identical indexes identified by the Supabase performance advisor.
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_products_seller_id;

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
