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
  if (!url || !anon || !service) return json({ error: 'digital_download_unavailable' }, 503);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: 'unauthorized' }, 401);
    const body = await req.json();
    const entitlementId = typeof body?.entitlement_id === 'string' ? body.entitlement_id : '';
    if (!uuidPattern.test(entitlementId)) return json({ error: 'invalid_entitlement_id' }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { count, error: rateError } = await admin.from('digital_download_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .gte('created_at', new Date(Date.now() - 60_000).toISOString());
    if (rateError) throw rateError;
    if ((count ?? 0) >= 10) return json({ error: 'download_rate_limited' }, 429);

    const { data: entitlement, error: entitlementError } = await admin.from('digital_entitlements')
      .select('id,user_id,product_id,order_id,asset_id,status')
      .eq('id', entitlementId).eq('user_id', auth.user.id).eq('status', 'active')
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (!entitlement) return json({ error: 'entitlement_not_found' }, 404);

    const { data: order, error: orderError } = await admin.from('orders')
      .select('id,status').eq('id', entitlement.order_id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || ['annulee', 'litige', 'remboursee', 'refunded'].includes(order.status)) {
      return json({ error: 'purchase_not_downloadable' }, 403);
    }

    const { data: asset, error: assetError } = await admin.from('digital_product_assets')
      .select('id,bucket_id,storage_path,status,scan_status')
      .eq('id', entitlement.asset_id).maybeSingle();
    if (assetError) throw assetError;
    if (!asset || asset.status !== 'ready' || asset.scan_status !== 'clean') {
      return json({ error: 'digital_asset_unavailable' }, 410);
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(asset.bucket_id).createSignedUrl(asset.storage_path, 60, { download: true });
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Signed URL unavailable');

    const { error: eventError } = await admin.from('digital_download_events').insert({
      entitlement_id: entitlement.id,
      user_id: auth.user.id,
      asset_id: asset.id,
      request_id: crypto.randomUUID(),
      outcome: 'url_issued',
    });
    if (eventError) throw eventError;
    return json({ signed_url: signed.signedUrl, expires_in_seconds: 60 });
  } catch (error) {
    console.error('Digital download authorization failed', error);
    return json({ error: 'digital_download_failed' }, 500);
  }
});
