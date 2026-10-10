import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const ratings = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
type Rating = typeof ratings[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!authorization || !supabaseUrl || !anonKey) return json({ error: 'unauthorized' }, 401);
  if (!visionApiKey) return json({ error: 'image_moderation_unavailable' }, 503);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  try {
    const body = await req.json();
    const imageBase64 = body?.imageBase64;
    if (typeof imageBase64 !== 'string' || imageBase64.length < 16 || imageBase64.length > 7_000_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      return json({ error: 'invalid_image' }, 400);
    }
    const decoded = atob(imageBase64);
    if (decoded.length > 5 * 1024 * 1024) return json({ error: 'image_too_large' }, 413);

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(visionApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{
        image: { content: imageBase64 },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }],
      }] }),
    });
    const result = await response.json();
    if (!response.ok || result?.responses?.[0]?.error) {
      console.error('Google Vision request failed', { status: response.status });
      return json({ error: 'image_moderation_failed' }, 502);
    }

    const annotation = result?.responses?.[0]?.safeSearchAnnotation;
    if (!annotation) return json({ error: 'image_moderation_failed' }, 502);
    const rating = (field: string): Rating => ratings.includes(annotation[field]) ? annotation[field] as Rating : 'UNKNOWN';
    const categories = {
      adult: rating('adult'),
      violence: rating('violence'),
      racy: rating('racy'),
      medical: rating('medical'),
    };
    const blocked = categories.adult === 'LIKELY' || categories.adult === 'VERY_LIKELY'
      || categories.violence === 'VERY_LIKELY' || categories.racy === 'VERY_LIKELY';
    const needsReview = !blocked && (categories.adult === 'POSSIBLE'
      || categories.violence === 'LIKELY' || categories.violence === 'POSSIBLE'
      || categories.racy === 'LIKELY' || categories.racy === 'POSSIBLE'
      || Object.values(categories).includes('UNKNOWN'));
    return json({ status: blocked ? 'blocked' : needsReview ? 'review' : 'approved', categories });
  } catch (error) {
    console.error('Image moderation failed', error);
    return json({ error: 'image_moderation_failed' }, 500);
  }
});
