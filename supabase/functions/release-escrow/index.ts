import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Backward-compatible endpoint. Seller proceeds are credited to the Afrixa
// wallet ledger after buyer confirmation; this endpoint no longer initiates
// an automatic FedaPay transfer.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'confirmation_unavailable' }, 503);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const buyer = authData.user;
    if (authError || !buyer) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: 'invalid_order_id' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('release_marketplace_order', {
      p_order_id: orderId,
      p_buyer_id: buyer.id,
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('introuvable')) return json({ error: 'order_not_found' }, 404);
      if (message.includes('litige')) return json({ error: 'order_has_open_dispute' }, 409);
      if (message.includes('expediee')) return json({ error: 'order_not_shipped' }, 409);
      if (message.includes('paiement')) return json({ error: 'payment_not_releasable' }, 409);
      console.error('Legacy escrow endpoint rejected release', { orderId, code: error.code });
      return json({ error: 'order_release_rejected' }, 409);
    }
    return json({ success: true, ...data });
  } catch (error) {
    console.error('Legacy escrow confirmation failed', error);
    return json({ error: 'order_confirmation_failed' }, 500);
  }
});
