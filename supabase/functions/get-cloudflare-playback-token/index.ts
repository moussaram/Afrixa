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
  const customerCode = Deno.env.get('CF_STREAM_CUSTOMER_CODE');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !customerCode || !authorization
    || !/^[a-zA-Z0-9-]{3,64}$/.test(customerCode)) {
    return json({ error: 'playback_unavailable' }, 503);
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const videoId = typeof body?.video_id === 'string' ? body.video_id : '';
    if (!uuidPattern.test(videoId)) return json({ error: 'invalid_video_id' }, 400);

    // The caller's JWT is used for this query. Videos RLS is the authority for
    // public, followers-only, private-account, blocked and owner visibility.
    const { data: video, error: videoError } = await userClient
      .from('videos')
      .select('id, cloudflare_uid, cloudflare_status, is_published, moderation_status')
      .eq('id', videoId)
      .maybeSingle();

    if (videoError) throw videoError;
    if (!video) return json({ error: 'video_not_found' }, 404);
    if (video.cloudflare_status !== 'ready'
      || video.is_published !== true
      || video.moderation_status !== 'approved'
      || !videoUidPattern.test(video.cloudflare_uid ?? '')) {
      return json({ error: 'video_not_playable' }, 409);
    }

    // Lock legacy assets the first time an authorized viewer requests playback.
    const { body: metadataBody } = await cloudflareStreamRequest(`/${video.cloudflare_uid}`);
    const metadata = metadataBody?.result as Record<string, unknown> | undefined;
    if (!metadata || metadata.uid !== video.cloudflare_uid) {
      return json({ error: 'video_provider_unavailable' }, 502);
    }
    if (metadata.requireSignedURLs !== true) {
      const { body: updateBody } = await cloudflareStreamRequest(`/${video.cloudflare_uid}`, {
        method: 'POST',
        body: JSON.stringify({ uid: video.cloudflare_uid, requireSignedURLs: true }),
      });
      const updated = updateBody?.result as Record<string, unknown> | undefined;
      if (updated?.requireSignedURLs !== true) {
        return json({ error: 'video_protection_unavailable' }, 502);
      }
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
    const { body: tokenBody } = await cloudflareStreamRequest(`/${video.cloudflare_uid}/token`, {
      method: 'POST',
      body: JSON.stringify({ exp: expiresAt }),
    });
    const tokenResult = tokenBody?.result as Record<string, unknown> | undefined;
    const token = typeof tokenResult?.token === 'string' ? tokenResult.token : '';
    if (!token) return json({ error: 'playback_token_unavailable' }, 502);

    const playbackBase = `https://customer-${customerCode}.cloudflarestream.com/${token}`;
    return json({
      playback_url: `${playbackBase}/manifest/video.m3u8`,
      thumbnail_url: `${playbackBase}/thumbnails/thumbnail.jpg?time=1s`,
      expires_at: new Date(expiresAt * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Cloudflare signed playback token creation failed', error);
    return json({ error: 'playback_token_creation_failed' }, 502);
  }
});
