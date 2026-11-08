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
  if (!url || !anon || !service) return json({ error: 'digital_upload_unavailable' }, 503);
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
    const productId = typeof body?.product_id === 'string' ? body.product_id : '';
    const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
    if (!uuidPattern.test(productId) || !filename || filename.length > 180
      || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return json({ error: 'invalid_upload_request' }, 400);
    }

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: product, error: productError } = await admin.from('products')
      .select('id,seller_id,product_type')
      .eq('id', productId).maybeSingle();
    if (productError) throw productError;
    if (!product || product.seller_id !== auth.user.id || product.product_type !== 'digital') {
      return json({ error: 'digital_product_not_found' }, 404);
    }

    const safeName = filename.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-100);
    const storagePath = `${auth.user.id}/${product.id}/${crypto.randomUUID()}-${safeName}`;
    const { data: upload, error: uploadError } = await admin.storage
      .from('afrixa-digital-private').createSignedUploadUrl(storagePath, { upsert: false });
    if (uploadError || !upload) throw uploadError ?? new Error('Signed upload URL unavailable');

    const { data: asset, error: assetError } = await admin.from('digital_product_assets').insert({
      product_id: product.id,
      seller_id: auth.user.id,
      bucket_id: 'afrixa-digital-private',
      storage_path: storagePath,
      original_filename: filename,
      status: 'quarantined',
      scan_status: 'pending',
    }).select('id').single();
    if (assetError) {
      await admin.storage.from('afrixa-digital-private').remove([storagePath]);
      throw assetError;
    }

    return json({ asset_id: asset.id, path: upload.path, token: upload.token, signed_url: upload.signedUrl });
  } catch (error) {
    console.error('Digital asset upload provisioning failed', error);
    return json({ error: 'digital_upload_creation_failed' }, 500);
  }
});
