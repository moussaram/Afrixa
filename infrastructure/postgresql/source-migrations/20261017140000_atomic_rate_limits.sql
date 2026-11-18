-- Rate-limit mutations are performed only through the authenticated Edge Function.
DROP POLICY IF EXISTS "rate_limits_owner_insert" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_owner_update" ON public.rate_limits;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window interval
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rate_row public.rate_limits%ROWTYPE;
  next_count integer;
BEGIN
  IF p_user_id IS NULL OR p_limit < 1 OR p_window <= interval '0 seconds'
    OR p_action NOT IN ('comment', 'message', 'video_upload', 'product_create', 'follow', 'report', 'tip') THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  -- One transaction-level lock per user and action prevents parallel requests
  -- from reading and updating the same counter concurrently.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_action));

  SELECT * INTO rate_row
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND window_start >= now() - p_window
  ORDER BY window_start DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action, count, window_start)
    VALUES (p_user_id, p_action, 1, now());
    RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - 1, 'limit', p_limit);
  END IF;

  IF COALESCE(rate_row.count, 0) >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'limit', p_limit);
  END IF;

  next_count := COALESCE(rate_row.count, 0) + 1;
  UPDATE public.rate_limits
  SET count = next_count
  WHERE id = rate_row.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit - next_count, 0),
    'limit', p_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(uuid, text, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(uuid, text, integer, interval) TO service_role;
