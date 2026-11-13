import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('CRON_SECRET');

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!supabaseUrl || !serviceKey || !cronSecret) {
    console.error('Missing server configuration for expired checkout cleanup');
    return new Response('Scheduled job is not configured', { status: 503 });
  }
  if (!safeEqual(request.headers.get('x-cron-secret') ?? '', cronSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('cleanup_expired_checkout_reservations', {
    p_older_than: '30 minutes',
  });
  if (error) {
    console.error('Expired checkout cleanup failed', error);
    return new Response('Unable to clean expired checkouts', { status: 500 });
  }
  return Response.json({ cleaned: data ?? 0 });
});
