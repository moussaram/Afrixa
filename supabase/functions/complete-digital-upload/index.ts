import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sha256 } from 'npm:@noble/hashes@1.8.0/sha256';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

function detectType(bytes: Uint8Array, filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25,0x50,0x44,0x46,0x2d) && ext === 'pdf') return 'application/pdf';
  if (starts(0x50,0x4b,0x03,0x04) && ['zip','docx','xlsx','pptx','jar'].includes(ext)) return 'application/zip';
  if (bytes.length >= 8 && new TextDecoder().decode(bytes.slice(4,8)) === 'ftyp' && ext === 'mp4') return 'video/mp4';
  if (starts(0x49,0x44,0x33) && ext === 'mp3') return 'audio/mpeg';
  if (starts(0xff,0xd8,0xff) && ['jpg','jpeg'].includes(ext)) return 'image/jpeg';
  if (starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a) && ext === 'png') return 'image/png';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP' && ext === 'webp') return 'image/webp';
  if (['txt','md','csv','json','js','ts','py','html','css'].includes(ext)
    && !bytes.includes(0)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'text/plain'; } catch { return null; }
  }
  return null;
}

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
    const assetId = typeof body?.asset_id === 'string' ? body.asset_id : '';
    if (!uuidPattern.test(assetId)) return json({ error: 'invalid_asset_id' }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: asset, error: assetError } = await admin.from('digital_product_assets')
      .select('id,seller_id,product_id,bucket_id,storage_path,original_filename,status')
      .eq('id', assetId).maybeSingle();
    if (assetError) throw assetError;
    if (!asset || asset.seller_id !== auth.user.id) return json({ error: 'asset_not_found' }, 404);
    if (asset.status !== 'quarantined') return json({ error: 'asset_already_processed' }, 409);

    const { data: file, error: downloadError } = await admin.storage
      .from(asset.bucket_id).download(asset.storage_path);
    if (downloadError || !file || file.size <= 0) throw downloadError ?? new Error('Uploaded file is empty');
    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const detectedMime = detectType(header, asset.original_filename);
    if (!detectedMime) {
      await admin.storage.from(asset.bucket_id).remove([asset.storage_path]);
      await admin.from('digital_product_assets').update({ status: 'rejected', scan_status: 'failed' }).eq('id', asset.id);
      return json({ error: 'unsupported_or_invalid_file_type' }, 415);
    }

    const digest = sha256(new Uint8Array(await file.arrayBuffer()));
    const { error: updateError } = await admin.from('digital_product_assets').update({
      detected_mime_type: detectedMime,
      byte_size: file.size,
      sha256: hex(digest),
      status: 'quarantined',
      scan_status: 'pending',
      validated_at: new Date().toISOString(),
    }).eq('id', asset.id).eq('status', 'quarantined');
    if (updateError) throw updateError;
    return json({
      ready: false,
      pending_scan: true,
      asset_id: asset.id,
      mime_type: detectedMime,
      byte_size: file.size,
      malware_scan: 'pending_configuration',
    });
  } catch (error) {
    console.error('Digital asset validation failed', error);
    return json({ error: 'digital_upload_validation_failed' }, 500);
  }
});
