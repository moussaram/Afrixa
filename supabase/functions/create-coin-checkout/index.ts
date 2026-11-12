import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const OPERATORS = new Set([
  'fedapay', 'mtn_open', 'moov', 'sbin', 'mtn_ci', 'moov_tg', 'togocel', 'orange-bf',
  'moov_bf', 'mtn_open_gn', 'moov_ci', 'wave_ci', 'orange_ci', 'wave_sn', 'orange_sn',
]);

const getCustomerName = (metadata: Record<string, unknown>) => {
  const fullName = [metadata.prenom, metadata.nom]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    || (typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '');
  const pieces = fullName.split(/\s+/).filter(Boolean);
  if (pieces.length < 2) return null;
  return { firstname: pieces[0], lastname: pieces.slice(1).join(' ') };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('AFRIXA_PUBLIC_URL');
  if (!supabaseUrl || !anonKey || !serviceRole || !appUrl) {
    console.error('Coin checkout is missing server configuration');
    return json({ error: 'payment_unavailable' }, 503);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let purchaseId: string | null = null;

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const packId = typeof body?.pack_id === 'string' ? body.pack_id : '';
    const phoneDigits = typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    const operator = typeof body?.operator === 'string' ? body.operator.trim() : 'fedapay';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packId)) {
      return json({ error: 'invalid_pack' }, 400);
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return json({ error: 'invalid_phone' }, 400);
    }
    if (!OPERATORS.has(operator)) {
      return json({ error: 'invalid_operator' }, 400);
    }

    const { data: pack, error: packError } = await admin
      .from('coin_packs')
      .select('id, name, coins, price_fcfa, is_active')
      .eq('id', packId)
      .maybeSingle();
    if (packError) throw packError;
    if (!pack || pack.is_active !== true) return json({ error: 'pack_not_found' }, 404);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('prenom, nom')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const customerName = profile?.prenom?.trim() && profile?.nom?.trim()
      ? { firstname: profile.prenom.trim(), lastname: profile.nom.trim() }
      : getCustomerName(user.user_metadata ?? {});
    if (!customerName || !user.email) {
      return json({ error: 'complete_payment_profile' }, 422);
    }

    const metadata = user.user_metadata ?? {};
    const country = typeof metadata.country === 'string' && /^[A-Za-z]{2}$/.test(metadata.country)
      ? metadata.country.toUpperCase()
      : 'BJ';

    const reference = `COIN-${crypto.randomUUID().replaceAll('-', '')}`;
    const { data: purchase, error: purchaseError } = await admin.rpc('start_coin_purchase', {
      p_user_id: user.id,
      p_pack_id: pack.id,
      p_operator: operator,
      p_phone: phoneDigits,
      p_reference: reference,
    });
    if (purchaseError) throw purchaseError;
    purchaseId = typeof purchase?.purchase_id === 'string' ? purchase.purchase_id : null;
    if (!purchaseId) throw new Error('Coin purchase could not be created');

    const publicUrl = new URL(appUrl);
    if (publicUrl.protocol !== 'https:' && publicUrl.hostname !== 'localhost') {
      return json({ error: 'payment_configuration_invalid' }, 503);
    }
    const callbackUrl = new URL('/coins', publicUrl);
    callbackUrl.searchParams.set('purchase', reference);

    const createResult = await fedapayRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        description: `Afrixa - ${String(pack.name).slice(0, 80)} (${pack.coins} coins)`,
        amount: Number(pack.price_fcfa),
        currency: { iso: 'XOF' },
        callback_url: callbackUrl.toString(),
        customer: {
          firstname: customerName.firstname,
          lastname: customerName.lastname,
          email: user.email,
          phone_number: { number: phoneDigits, country },
        },
        custom_metadata: { coin_purchase_id: purchaseId, payment_reference: reference },
      }),
    });
    const transaction = getFedaPayEntity(createResult);
    const transactionId = String(transaction?.id ?? '');
    if (!transactionId || !/^\d+$/.test(transactionId)) {
      throw new Error('FedaPay returned an invalid transaction identifier');
    }

    const { error: attachError } = await admin.rpc('attach_coin_purchase_transaction', {
      p_purchase_id: purchaseId,
      p_transaction_id: transactionId,
      p_provider_response: createResult,
    });
    if (attachError) throw attachError;

    const tokenResult = await fedapayRequest(`/transactions/${encodeURIComponent(transactionId)}/token`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const token = getFedaPayEntity(tokenResult) ?? tokenResult;
    const checkoutUrl = typeof token.url === 'string' ? token.url : '';
    let checkout: URL;
    try {
      checkout = new URL(checkoutUrl);
    } catch {
      return json({ error: 'checkout_link_unavailable' }, 502);
    }
    if (checkout.protocol !== 'https:' || !checkout.hostname.endsWith('.fedapay.com')) {
      console.error('FedaPay returned an unexpected checkout host');
      return json({ error: 'checkout_link_unavailable' }, 502);
    }

    return json({
      checkout_url: checkout.toString(),
      transaction_id: transactionId,
      purchase_id: purchaseId,
      coins: Number(pack.coins),
      price_fcfa: Number(pack.price_fcfa),
    });
  } catch (error) {
    console.error('Coin checkout creation failed', error);
    if (purchaseId) {
      await admin.rpc('fail_coin_purchase', {
        p_purchase_id: purchaseId,
        p_reason: 'checkout_creation_failed',
        p_transaction_id: null,
      }).then(({ error: failError }) => {
        if (failError) console.error('Unable to mark coin purchase as failed', failError);
      });
    }
    return json({ error: 'checkout_creation_failed' }, 502);
  }
});
