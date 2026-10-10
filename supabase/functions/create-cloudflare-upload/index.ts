import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cloudflareStreamRequest, encodeTusMetadata, videoUidPattern } from '../_shared/cloudflare.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const maxFileBytes = 500 * 1024 * 1024;
const maxDurationSeconds = 600;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const customerCode = Deno.env.get('CF_STREAM_CUSTOMER_CODE');
  if (!supabaseUrl || !anonKey || !serviceRole || !customerCode || !/^[a-zA-Z0-9-]{3,64}$/.test(customerCode)) {
    console.error('Cloudflare Stream upload is missing server configuration');
    return json({ error: 'video_upload_unavailable' }, 503);
  }
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const fileSize = Number(body?.file_size);
    const duration = Number(body?.duration);
    const contentType = typeof body?.content_type === 'string' ? body.content_type : '';
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const privacy = body?.privacy;
    if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > maxFileBytes
      || !['video/mp4', 'video/quicktime'].includes(contentType)
      || !Number.isFinite(duration) || duration < 15 || duration > maxDurationSeconds
      || !title || title.length > 120 || description.length > 2200
      || !['public', 'followers', 'private'].includes(privacy)) {
      return json({ error: 'video_metadata_invalid' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { count, error: activeUploadsError } = await admin.from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('cloudflare_status', 'uploading')
      .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (activeUploadsError) throw activeUploadsError;
    if ((count ?? 0) >= 3) return json({ error: 'too_many_active_uploads' }, 429);

    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const uploadMetadata = [
      `name ${encodeTusMetadata(title)}`,
      `maxDurationSeconds ${encodeTusMetadata(String(maxDurationSeconds))}`,
      `expiry ${encodeTusMetadata(expiry)}`,
    ].join(',');
    const cloudflare = await cloudflareStreamRequest('?direct_user=true', {
      method: 'POST',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(fileSize),
        'Upload-Creator': user.id,
        'Upload-Metadata': uploadMetadata,
      },
    });
    const uploadUrl = cloudflare.response.headers.get('Location') ?? '';
    const videoUid = cloudflare.response.headers.get('stream-media-id') ?? '';
    let parsedUploadUrl: URL;
    try { parsedUploadUrl = new URL(uploadUrl); } catch { return json({ error: 'upload_url_invalid' }, 502); }
    if (parsedUploadUrl.protocol !== 'https:' || !parsedUploadUrl.hostname.endsWith('.videodelivery.net')
      || !videoUidPattern.test(videoUid)) {
      console.error('Cloudflare Stream returned an invalid resumable upload response');
      return json({ error: 'upload_url_invalid' }, 502);
    }

    const playbackBase = `https://customer-${customerCode}.cloudflarestream.com/${videoUid}`;
    const { data: video, error: insertError } = await admin.from('videos').insert({
      user_id: user.id,
      cloudflare_uid: videoUid,
      hls_url: `${playbackBase}/manifest/video.m3u8`,
      thumbnail_url: `${playbackBase}/thumbnails/thumbnail.jpg?time=1s`,
      title,
      description: description || null,
      duration: Math.round(duration),
      privacy,
      cloudflare_status: 'uploading',
      moderation_status: 'pending',
      is_published: false,
    }).select('id').single();
    if (insertError) {
      try { await cloudflareStreamRequest(`/${videoUid}`, { method: 'DELETE' }); }
      catch (cleanupError) { console.error('Failed to clean up an orphan Cloudflare video', cleanupError); }
      throw insertError;
    }
    return json({ upload_url: uploadUrl, cloudflare_uid: videoUid, video_id: video.id });
  } catch (error) {
    console.error('Cloudflare Stream upload provisioning failed', error);
    return json({ error: 'video_upload_creation_failed' }, 502);
  }
});
