import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const limits: Record<string, { limit: number; hours: number }> = {
  comment: { limit: 30, hours: 1 },
  message: { limit: 100, hours: 1 },
  video_upload: { limit: 10, hours: 24 },
  product_create: { limit: 20, hours: 24 },
  follow: { limit: 200, hours: 24 },
};

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

serve(async req => {
  const { user_id, action } = await req.json();
  const config = limits[action];
  if (!user_id || !config) return new Response('Invalid payload', { status: 400 });

  const since = new Date(Date.now() - config.hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('rate_limits')
    .select('id,count')
    .eq('user_id', user_id)
    .eq('action', action)
    .gte('window_start', since)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });

  if (!data) {
    await supabase.from('rate_limits').insert({ user_id, action, count: 1 });
    return Response.json({ allowed: true, remaining: config.limit - 1 });
  }

  if (data.count >= config.limit) return Response.json({ allowed: false, remaining: 0 });
  await supabase.from('rate_limits').update({ count: data.count + 1 }).eq('id', data.id);
  return Response.json({ allowed: true, remaining: config.limit - data.count - 1 });
});
