import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const currencyIso = (currency: unknown) => {
  if (typeof currency === 'string') return currency.toUpperCase();
  if (currency && typeof currency === 'object' && 'iso' in currency) {
    return String((currency as { iso: unknown }).iso).toUpperCase();
  }
  return '';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) {
    console.error('FedaPay verification is missing server configuration');
    return json({ error: 'payment_verification_unavailable' }, 503);
  }
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const transactionId = String(body?.transaction_id ?? '');
    const txRef = typeof body?.tx_ref === 'string' ? body.tx_ref.trim() : '';
    if (!/^\d{1,32}$/.test(transactionId) || !txRef || txRef.length > 100) {
      return json({ error: 'invalid_payment_reference' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: tx, error: txError } = await admin
      .from('payment_transactions')
      .select('id, order_id, fedapay_ref, fedapay_transaction_id, amount, commission_amount, seller_amount, currency, status')
      .eq('fedapay_ref', txRef)
      .maybeSingle();
    if (txError) throw txError;
    if (!tx || tx.fedapay_transaction_id !== transactionId) return json({ error: 'payment_not_found' }, 404);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, product_id, variant_id, total_price, commission_rate, status')
      .eq('id', tx.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.buyer_id !== userId) return json({ error: 'payment_not_found' }, 404);
    if (Number(order.total_price) !== Number(tx.amount)) {
      console.error('Stored FedaPay amount does not match order', { orderId: order.id });
      return json({ error: 'payment_amount_mismatch' }, 409);
    }

    const providerResponse = await fedapayRequest(`/transactions/${encodeURIComponent(transactionId)}`);
    const payment = getFedaPayEntity(providerResponse);
    const customMetadata = payment?.custom_metadata;
    const metadataOrderId = customMetadata && typeof customMetadata === 'object'
      ? (customMetadata as Record<string, unknown>).order_id
      : undefined;
    if (metadataOrderId && metadataOrderId !== order.id) {
      console.error('FedaPay transaction metadata does not match order', { orderId: order.id });
      return json({ error: 'payment_order_mismatch' }, 409);
    }

    const isApproved =
      String(payment?.id) === transactionId &&
      String(payment?.status).toLowerCase() === 'approved' &&
      Number.isSafeInteger(Number(payment?.amount)) &&
      Number(payment?.amount) === Number(tx.amount) &&
      currencyIso(payment?.currency) === String(tx.currency).toUpperCase();

    if (!isApproved) {
      const providerStatus = String(payment?.status ?? 'unknown').toLowerCase();
      if (providerStatus === 'refunded') {
        const { data: refund, error: refundError } = await admin.rpc('reconcile_fedapay_refund', {
          p_transaction_id: tx.id,
          p_provider_response: providerResponse,
        });
        if (refundError) throw refundError;
        return json({ verified: false, status: 'refunded', refund });
      }
      if (['declined', 'canceled', 'cancelled'].includes(providerStatus)) {
        const { error: failError } = await admin.rpc('fail_order_payment', {
          p_transaction_id: tx.id,
          p_final_status: providerStatus === 'declined' ? 'failed' : 'cancelled',
          p_provider_response: providerResponse,
        });
        if (failError) throw failError;
        const { error: releaseError } = await admin.rpc('release_order_stock_reservation', {
          p_order_id: order.id,
        });
        if (releaseError) throw releaseError;
      }
      return json({ verified: false, status: providerStatus });
    }

    const { error: settleError } = await admin.rpc('settle_order_payment', {
      p_transaction_id: tx.id,
      p_provider_response: providerResponse,
    });
    if (settleError) throw settleError;
    const { error: consumeError } = await admin.rpc('consume_order_stock_reservation', {
      p_order_id: order.id,
    });
    if (consumeError) throw consumeError;
    const { error: saleError } = await admin.rpc('record_product_sale', {
      p_order_id: order.id,
    });
    if (saleError) throw saleError;
    if (order.product_id) {
      let cartCleanup = admin.from('cart_items').delete()
        .eq('buyer_id', order.buyer_id)
        .eq('product_id', order.product_id);
      cartCleanup = order.variant_id
        ? cartCleanup.eq('variant_id', order.variant_id)
        : cartCleanup.is('variant_id', null);
      const { error: cartCleanupError } = await cartCleanup;
      if (cartCleanupError) throw cartCleanupError;
    }

    return json({ verified: true, status: 'approved', order_id: order.id });
  } catch (error) {
    console.error('FedaPay verification failed', error);
    return json({ error: 'payment_verification_failed' }, 500);
  }
});
