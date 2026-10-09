import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const getCustomerName = (metadata: Record<string, unknown>) => {
  const fullName = [metadata.prenom, metadata.nom]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    || (typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '')
    || (typeof metadata.name === 'string' ? metadata.name.trim() : '');
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
    console.error('FedaPay checkout is missing server configuration');
    return json({ error: 'payment_unavailable' }, 503);
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
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: 'invalid_order_id' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, total_price, product_name, payment_reference, buyer_phone, status')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.buyer_id !== user.id) return json({ error: 'order_not_found' }, 404);
    if (order.status !== 'en_attente' || !Number.isSafeInteger(order.total_price) || order.total_price < 1) {
      return json({ error: 'order_not_payable' }, 409);
    }
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('prenom, nom')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const customerName = profile?.prenom?.trim() && profile?.nom?.trim()
      ? { firstname: profile.prenom.trim(), lastname: profile.nom.trim() }
      : getCustomerName(user.user_metadata ?? {});
    if (!customerName || !user.email || !order.buyer_phone) {
      return json({ error: 'complete_payment_profile' }, 422);
    }

    const { data: tx, error: txError } = await admin
      .from('payment_transactions')
      .select('id, fedapay_ref, fedapay_transaction_id, amount, currency, status')
      .eq('order_id', orderId)
      .maybeSingle();
    if (txError) throw txError;
    if (!tx || tx.fedapay_ref !== order.payment_reference || Number(tx.amount) !== Number(order.total_price) || tx.currency !== 'XOF') {
      return json({ error: 'payment_record_invalid' }, 409);
    }

    let transactionId = tx.fedapay_transaction_id;
    if (!transactionId) {
      if (tx.status !== 'initiated') return json({ error: 'payment_creation_requires_review' }, 409);
      const { data: claim, error: claimError } = await admin
        .from('payment_transactions')
        .update({ status: 'creating' })
        .eq('id', tx.id)
        .eq('status', 'initiated')
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claim) return json({ error: 'payment_creation_in_progress' }, 409);

      const metadata = user.user_metadata ?? {};
      const country = typeof metadata.country === 'string' && /^[A-Za-z]{2}$/.test(metadata.country)
        ? metadata.country.toUpperCase()
        : 'BJ';
      const publicUrl = new URL(appUrl);
      if (publicUrl.protocol !== 'https:' && publicUrl.hostname !== 'localhost') {
        return json({ error: 'payment_configuration_invalid' }, 503);
      }
      const callbackUrl = new URL('/payment/return', publicUrl);
      callbackUrl.searchParams.set('order_ref', tx.fedapay_ref);

      const createResult = await fedapayRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: `Afrixa - ${String(order.product_name).slice(0, 100)}`,
          amount: Number(order.total_price),
          currency: { iso: 'XOF' },
          callback_url: callbackUrl.toString(),
          customer: {
            firstname: customerName.firstname,
            lastname: customerName.lastname,
            email: user.email,
            phone_number: { number: order.buyer_phone, country },
          },
          custom_metadata: { order_id: order.id, payment_reference: tx.fedapay_ref },
        }),
      });
      const transaction = getFedaPayEntity(createResult);
      transactionId = String(transaction?.id ?? '');
      if (!transactionId || !/^\d+$/.test(transactionId)) {
        throw new Error('FedaPay returned an invalid transaction identifier');
      }
      const { error: saveTransactionError } = await admin
        .from('payment_transactions')
        .update({
          fedapay_transaction_id: transactionId,
          fedapay_response: createResult,
          status: 'pending',
        })
        .eq('id', tx.id)
        .eq('status', 'creating');
      if (saveTransactionError) throw saveTransactionError;
    } else if (!['creating', 'pending'].includes(tx.status)) {
      return json({ error: 'payment_not_available', status: tx.status }, 409);
    }

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
    return json({ checkout_url: checkout.toString(), transaction_id: transactionId });
  } catch (error) {
    console.error('FedaPay checkout creation failed', error);
    return json({ error: 'checkout_creation_failed' }, 502);
  }
});
