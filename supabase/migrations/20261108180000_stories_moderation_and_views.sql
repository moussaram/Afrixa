-- Stories are ephemeral, account-owned content. New stories require approval.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';

UPDATE public.stories
SET moderation_status = 'approved'
WHERE expires_at > now() AND is_archived = false;

ALTER TABLE public.stories
  ALTER COLUMN moderation_status SET DEFAULT 'pending',
  DROP CONSTRAINT IF EXISTS stories_moderation_status_check,
  ADD CONSTRAINT stories_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')) NOT VALID;

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_text_content_length_check,
  ADD CONSTRAINT stories_text_content_length_check
    CHECK (text_content IS NULL OR char_length(text_content) <= 400) NOT VALID;

CREATE INDEX IF NOT EXISTS stories_moderation_queue_idx
  ON public.stories(moderation_status, created_at DESC)
  WHERE moderation_status = 'pending';

CREATE OR REPLACE FUNCTION public.protect_story_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.moderation_status := 'pending';
    NEW.expires_at := now() + interval '24 hours';
    NEW.is_archived := false;
    NEW.views_count := 0;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Story owner cannot change';
  END IF;
  IF NEW.text_content IS DISTINCT FROM OLD.text_content
    OR NEW.media_url IS DISTINCT FROM OLD.media_url
    OR NEW.background_color IS DISTINCT FROM OLD.background_color
    OR NEW.type IS DISTINCT FROM OLD.type THEN
    NEW.moderation_status := 'pending';
  ELSE
    NEW.moderation_status := OLD.moderation_status;
  END IF;
  NEW.expires_at := OLD.expires_at;
  NEW.views_count := OLD.views_count;
  IF OLD.is_archived THEN NEW.is_archived := true; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_story_publication ON public.stories;
CREATE TRIGGER protect_story_publication
BEFORE INSERT OR UPDATE ON public.stories
FOR EACH ROW EXECUTE FUNCTION public.protect_story_publication();

DROP POLICY IF EXISTS "stories_public_select" ON public.stories;
CREATE POLICY "Approved active stories visible to public"
  ON public.stories FOR SELECT
  USING (expires_at > now() AND is_archived = false AND moderation_status = 'approved');

DROP POLICY IF EXISTS "Admins review pending stories" ON public.stories;
CREATE POLICY "Admins review pending stories"
  ON public.stories FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR COALESCE((auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin', false)));

DROP POLICY IF EXISTS "story_views_owner_all" ON public.story_views;
CREATE POLICY "Users read own story views"
  ON public.story_views FOR SELECT USING (auth.uid() = viewer_id);
CREATE POLICY "Users record views of approved stories"
  ON public.story_views FOR INSERT
  WITH CHECK (
    auth.uid() = viewer_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.moderation_status = 'approved'
        AND s.expires_at > now() AND s.is_archived = false
    )
  );

CREATE OR REPLACE FUNCTION public.increment_story_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stories SET views_count = views_count + 1
  WHERE id = NEW.story_id AND expires_at > now() AND is_archived = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_story_view_count ON public.story_views;
CREATE TRIGGER increment_story_view_count
AFTER INSERT ON public.story_views
FOR EACH ROW EXECUTE FUNCTION public.increment_story_view_count();

ALTER TABLE public.moderation_decisions
  DROP CONSTRAINT IF EXISTS moderation_decisions_content_type_check,
  ADD CONSTRAINT moderation_decisions_content_type_check
    CHECK (content_type IN ('product', 'video', 'story')) NOT VALID;
