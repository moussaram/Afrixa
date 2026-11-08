import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cloudflareStreamRequest, videoUidPattern } from '../_shared/cloudflare.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRole || !authorization) {
    return json({ error: 'asset_security_unavailable' }, 503);
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const appMetadata = user.app_metadata ?? {};
    const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    if (appMetadata.role !== 'admin' && !roles.includes('admin')) {
      return json({ error: 'forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const offset = Number.isSafeInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;
    const requestedLimit = Number.isSafeInteger(body?.limit) ? body.limit : 25;
    const limit = Math.max(1, Math.min(requestedLimit, 50));

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: videos, count, error: queryError }, { count: legacyCount, error: legacyError }] = await Promise.all([
      admin
        .from('videos')
        .select('id, cloudflare_uid', { count: 'exact' })
        .not('cloudflare_uid', 'is', null)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1),
      admin
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .is('cloudflare_uid', null),
    ]);
    if (legacyError) throw legacyError;
    const { data: batchVideos } = { data: videos }; // keep the batch name explicit below
    const selectedVideos = batchVideos;
      .not('cloudflare_uid', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (queryError) throw queryError;

    let secured = 0;
    const failedVideoIds: string[] = [];
    for (const video of selectedVideos ?? []) {
      const uid = video.cloudflare_uid ?? '';
      if (!videoUidPattern.test(uid)) {
        failedVideoIds.push(video.id);
        continue;
      }
      try {
        const { body: updateBody } = await cloudflareStreamRequest(`/${uid}`, {
          method: 'POST',
          body: JSON.stringify({ uid, requireSignedURLs: true }),
        });
        const result = updateBody?.result as Record<string, unknown> | undefined;
        if (result?.requireSignedURLs !== true) throw new Error('Cloudflare did not confirm signed URL protection');
        secured += 1;
      } catch {
        failedVideoIds.push(video.id);
      }
    }

    const total = count ?? 0;
    const nextOffset = offset + (selectedVideos?.length ?? 0);
    return json({
      processed: selectedVideos?.length ?? 0,
      secured,
      failed: failedVideoIds.length,
      legacy_without_cloudflare_uid: legacyCount ?? 0,
      failed_video_ids: failedVideoIds,
      total,
      next_offset: nextOffset,
      complete: nextOffset >= total,
    });
  } catch (error) {
    console.error('Cloudflare existing video protection batch failed', error);
    return json({ error: 'asset_security_batch_failed' }, 502);
  }
});
