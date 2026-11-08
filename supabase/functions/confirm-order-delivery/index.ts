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
  if (!url || !anon || !service) return json({ error: 'delivery_confirmation_unavailable' }, 503);
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
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!uuidPattern.test(orderId)) return json({ error: 'invalid_order_id' }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc('confirm_order_delivery', {
      p_order_id: orderId,
      p_actor_id: auth.user.id,
    });
    if (error) {
      const message = error.message || '';
      if (message.includes('Buyer ownership mismatch')) return json({ error: 'forbidden' }, 403);
      if (message.includes('not reported delivered') || message.includes('not active') || message.includes('has not reported')) {
        return json({ error: 'delivery_not_confirmable' }, 409);
      }
      if (message.includes('not found')) return json({ error: 'order_not_found' }, 404);
      throw error;
    }
    return json(data ?? { confirmed: true });
  } catch (error) {
    console.error('Buyer delivery confirmation failed', error);
    return json({ error: 'delivery_confirmation_failed' }, 500);
  }
});
