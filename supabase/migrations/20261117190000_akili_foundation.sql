-- Akili foundation: private conversations, feedback and server-enforced daily chat quotas.
-- Apply only to the intended Supabase staging project after reviewing the project ref.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS akili_plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_akili_plan_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_akili_plan_check
      CHECK (akili_plan IN ('free', 'creator', 'business', 'pro'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.akili_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Porto-Novo')::date,
  messages_sent integer NOT NULL DEFAULT 0 CHECK (messages_sent >= 0),
  images_generated integer NOT NULL DEFAULT 0 CHECK (images_generated >= 0),
  scripts_generated integer NOT NULL DEFAULT 0 CHECK (scripts_generated >= 0),
  videos_generated integer NOT NULL DEFAULT 0 CHECK (videos_generated >= 0),
  hashtags_generated integer NOT NULL DEFAULT 0 CHECK (hashtags_generated >= 0),
  descriptions_generated integer NOT NULL DEFAULT 0 CHECK (descriptions_generated >= 0),
  prices_generated integer NOT NULL DEFAULT 0 CHECK (prices_generated >= 0),
  UNIQUE (user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS public.akili_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  context text NOT NULL DEFAULT 'general'
    CHECK (context IN ('marketplace', 'creator', 'support', 'vendor', 'general')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS akili_conversations_user_updated_idx
  ON public.akili_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS akili_usage_user_date_idx
  ON public.akili_usage(user_id, usage_date DESC);

CREATE TABLE IF NOT EXISTS public.akili_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_content text NOT NULL CHECK (char_length(message_content) <= 4000),
  rating smallint NOT NULL CHECK (rating IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.akili_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akili_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akili_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS akili_usage_owner_read ON public.akili_usage;
CREATE POLICY akili_usage_owner_read ON public.akili_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS akili_conversations_owner_all ON public.akili_conversations;
CREATE POLICY akili_conversations_owner_all ON public.akili_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS akili_feedback_owner_insert ON public.akili_feedback;
CREATE POLICY akili_feedback_owner_insert ON public.akili_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS akili_feedback_owner_read ON public.akili_feedback;
CREATE POLICY akili_feedback_owner_read ON public.akili_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.akili_usage FROM anon, authenticated;
GRANT SELECT ON public.akili_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.akili_conversations TO authenticated;
GRANT SELECT, INSERT ON public.akili_feedback TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_akili_message(p_user_id uuid)
RETURNS TABLE(allowed boolean, plan text, used integer, daily_limit integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan text;
  v_limit integer;
  v_used integer;
  v_today date := (now() AT TIME ZONE 'Africa/Porto-Novo')::date;
BEGIN
  SELECT coalesce(p.akili_plan, 'free') INTO v_plan
  FROM public.profiles p WHERE p.user_id = p_user_id;
  v_plan := coalesce(v_plan, 'free');
  v_limit := CASE v_plan
    WHEN 'creator' THEN 100
    WHEN 'business' THEN 300
    WHEN 'pro' THEN 2147483647
    ELSE 10
  END;

  INSERT INTO public.akili_usage(user_id, usage_date, messages_sent)
  VALUES (p_user_id, v_today, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT u.messages_sent INTO v_used
  FROM public.akili_usage u
  WHERE u.user_id = p_user_id AND u.usage_date = v_today
  FOR UPDATE;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT false, v_plan, v_used, v_limit, 0;
    RETURN;
  END IF;

  UPDATE public.akili_usage u
  SET messages_sent = u.messages_sent + 1
  WHERE u.user_id = p_user_id AND u.usage_date = v_today
  RETURNING u.messages_sent INTO v_used;

  RETURN QUERY SELECT true, v_plan, v_used, v_limit,
    CASE WHEN v_limit = 2147483647 THEN 2147483647 ELSE greatest(0, v_limit - v_used) END;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_akili_message(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.akili_usage
  SET messages_sent = greatest(0, messages_sent - 1)
  WHERE user_id = p_user_id
    AND usage_date = (now() AT TIME ZONE 'Africa/Porto-Novo')::date;
$$;

REVOKE ALL ON FUNCTION public.consume_akili_message(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_akili_message(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_akili_message(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_akili_message(uuid) TO service_role;
