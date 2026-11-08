import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'moderation_unavailable' }, 503);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
    const appMetadata = auth.user.app_metadata || {};
    const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
    if (appMetadata.role !== 'admin' && !roles.includes('admin')) return json({ error: 'forbidden' }, 403);

    const body = await req.json();
    const contentType = body?.content_type;
    const contentId = typeof body?.content_id === 'string' ? body.content_id : '';
    const decision = body?.decision;
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!['product', 'video', 'story'].includes(contentType) || !uuidPattern.test(contentId)
      || !['approved', 'rejected'].includes(decision) || (decision === 'rejected' && reason.length < 3)) {
      return json({ error: 'invalid_moderation_decision' }, 400);
    }

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    if (contentType === 'product') {
      const { data: product, error: productError } = await admin.from('products')
        .select('id,product_type').eq('id', contentId).maybeSingle();
      if (productError) throw productError;
      if (!product) return json({ error: 'product_not_found' }, 404);
      if (decision === 'approved' && product.product_type === 'digital') {
        const { data: asset, error: assetError } = await admin.from('digital_product_assets')
          .select('id').eq('product_id', product.id).eq('status', 'ready')
          .in('scan_status', ['clean', 'not_configured']).limit(1).maybeSingle();
        if (assetError) throw assetError;
        if (!asset) return json({ error: 'digital_file_not_ready' }, 409);
      }
      const { error: updateError } = await admin.from('products').update({
        moderation_status: decision,
        publication_status: decision === 'approved' ? 'published' : 'rejected',
        is_active: decision === 'approved',
      }).eq('id', contentId);
      if (updateError) throw updateError;
    } else if (contentType === 'story') {
      const { data: story, error: storyError } = await admin.from('stories')
        .select('id').eq('id', contentId).maybeSingle();
      if (storyError) throw storyError;
      if (!story) return json({ error: 'story_not_found' }, 404);
      const { error: updateError } = await admin.from('stories')
        .update({ moderation_status: decision }).eq('id', contentId);
      if (updateError) throw updateError;
    } else {
      const { data: video, error: videoError } = await admin.from('videos')
        .select('id,cloudflare_status').eq('id', contentId).maybeSingle();
      if (videoError) throw videoError;
      if (!video) return json({ error: 'video_not_found' }, 404);
      if (decision === 'approved' && video.cloudflare_status !== 'ready') {
        return json({ error: 'video_processing_not_complete' }, 409);
      }
      const { error: updateError } = await admin.from('videos').update({
        moderation_status: decision,
        is_published: decision === 'approved',
      }).eq('id', contentId);
      if (updateError) throw updateError;
    }

    const { error: auditError } = await admin.from('moderation_decisions').insert({
      actor_id: auth.user.id,
      content_type: contentType,
      content_id: contentId,
      decision,
      reason: reason || null,
    });
    if (auditError) throw auditError;
    return json({ success: true, content_type: contentType, content_id: contentId, decision });
  } catch (error) {
    console.error('Marketplace moderation action failed', error);
    return json({ error: 'moderation_action_failed' }, 500);
  }
});
