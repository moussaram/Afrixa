import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const limits = {
  comment: { limit: 30, hours: 1 },
  message: { limit: 100, hours: 1 },
  video_upload: { limit: 10, hours: 24 },
  product_create: { limit: 20, hours: 24 },
  follow: { limit: 200, hours: 24 },
  report: { limit: 30, hours: 24 },
  tip: { limit: 60, hours: 1 },
} as const;

type RateLimitedAction = keyof typeof limits;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Rate limit function is missing server configuration');
    return json({ error: 'rate_limit_unavailable' }, 503);
  }
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) return json({ error: 'unauthorized' }, 401);

    let action: unknown;
    try {
      ({ action } = await req.json());
    } catch {
      return json({ error: 'invalid_payload' }, 400);
    }
    if (typeof action !== 'string' || !Object.hasOwn(limits, action)) {
      return json({ error: 'invalid_action' }, 400);
    }

    const config = limits[action as RateLimitedAction];
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // The database serializes each user's action counter so concurrent calls cannot
    // increment from the same stale value or exceed the configured limit.
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_limit: config.limit,
      p_window: `${config.hours} hours`,
    });

    if (error) {
      console.error('Atomic rate limit check failed', { action, code: error.code });
      return json({ error: 'rate_limit_unavailable' }, 503);
    }

    return json(data);
  } catch (error) {
    console.error('Rate limit request failed', error);
    return json({ error: 'rate_limit_unavailable' }, 500);
  }
});
