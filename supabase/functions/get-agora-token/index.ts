import { createClient } from 'npm:@supabase/supabase-js@2';
import { RtcTokenBuilder } from 'npm:agora-token@2.0.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const appId = Deno.env.get('AGORA_APP_ID');
  const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
  if (!authorization || !supabaseUrl || !anonKey) return json({ error: 'unauthorized' }, 401);
  if (!appId || !appCertificate) return json({ error: 'live_unavailable' }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  try {
    const body = await req.json();
    if (typeof body?.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
      return json({ error: 'invalid_session' }, 400);
    }
    const role = body?.role;
    if (role !== 'publisher' && role !== 'audience') return json({ error: 'invalid_role' }, 400);

    const { data: session, error: sessionError } = await userClient.from('live_sessions')
      .select('id, host_id, agora_channel, status, privacy')
      .eq('id', body.sessionId).eq('status', 'live').maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: 'live_not_found' }, 404);
    const isHost = session.host_id === user.id;
    if (role === 'publisher' && !isHost) return json({ error: 'publisher_forbidden' }, 403);
    if (role === 'audience' && isHost) return json({ error: 'host_cannot_join_as_audience' }, 400);
    if (!isHost && session.privacy === 'private') return json({ error: 'live_private' }, 403);
    if (!isHost && session.privacy === 'followers') {
      const { data: follow, error: followError } = await userClient.from('follows')
        .select('follower_id').eq('follower_id', user.id).eq('following_id', session.host_id).maybeSingle();
      if (followError) throw followError;
      if (!follow) return json({ error: 'live_followers_only' }, 403);
    }

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(user.id));
    const uid = new DataView(digest).getUint32(0, false) || 1;
    const expiresIn = 3600;
    const publisher = role === 'publisher';
    const token = RtcTokenBuilder.buildTokenWithUidAndPrivilege(
      appId,
      appCertificate,
      session.agora_channel,
      uid,
      expiresIn,
      expiresIn,
      publisher ? expiresIn : 0,
      publisher ? expiresIn : 0,
      0,
    );
    return json({ appId, channel: session.agora_channel, token, uid, expiresIn });
  } catch (error) {
    console.error('Agora token generation failed', error);
    return json({ error: 'agora_token_failed' }, 500);
  }
});
