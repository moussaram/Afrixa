import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cloudflareStreamRequest, videoUidPattern } from '../_shared/cloudflare.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'video_status_unavailable' }, 503);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) return json({ error: 'unauthorized' }, 401);
    const body = await req.json();
    const videoId = typeof body?.video_id === 'string' ? body.video_id : '';
    if (!uuidPattern.test(videoId)) return json({ error: 'invalid_video_id' }, 400);

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: video, error: videoError } = await admin.from('videos')
      .select('id, user_id, cloudflare_uid, cloudflare_status, duration')
      .eq('id', videoId).maybeSingle();
    if (videoError) throw videoError;
    if (!video || video.user_id !== userId || !videoUidPattern.test(video.cloudflare_uid ?? '')) {
      return json({ error: 'video_not_found' }, 404);
    }

    const { body: providerBody } = await cloudflareStreamRequest(`/${video.cloudflare_uid}`);
    const result = providerBody?.result as Record<string, unknown> | undefined;
    const providerStatus = result?.status as Record<string, unknown> | undefined;
    if (!result || result.uid !== video.cloudflare_uid) return json({ error: 'provider_video_not_found' }, 502);
    const state = providerStatus?.state === 'error'
      ? 'error'
      : result.readyToStream === true ? 'ready' : 'processing';
    const duration = Number(result.duration);
    const update: Record<string, unknown> = { cloudflare_status: state };
    if (Number.isFinite(duration) && duration >= 0 && duration <= 600) update.duration = Math.round(duration);
    const { error: updateError } = await admin.from('videos').update(update).eq('id', video.id);
    if (updateError) throw updateError;

    return json({ status: state, ready: state === 'ready', video_id: video.id });
  } catch (error) {
    console.error('Cloudflare Stream upload completion check failed', error);
    return json({ error: 'video_status_check_failed' }, 502);
  }
});
