import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const flutterwaveSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole || !flutterwaveSecret) {
    console.error('Payment verification is missing server configuration');
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
      .select('id, order_id, amount, commission_amount, seller_amount, currency, status, flutterwave_tx_id')
      .eq('flutterwave_ref', txRef)
      .maybeSingle();
    if (txError) throw txError;
    if (!tx) return json({ error: 'payment_not_found' }, 404);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, total_price, commission_rate, status')
      .eq('id', tx.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.buyer_id !== userId) return json({ error: 'payment_not_found' }, 404);
    if (Number(order.total_price) !== Number(tx.amount)) {
      console.error('Payment/order amount mismatch', { orderId: order.id, transactionId: tx.id });
      return json({ error: 'payment_amount_mismatch' }, 409);
    }

    const alreadyVerified = tx.status === 'successful' && tx.flutterwave_tx_id === transactionId;
    if (!alreadyVerified && !['initiated', 'pending'].includes(tx.status)) {
      return json({ error: 'payment_not_verifiable', status: tx.status }, 409);
    }

    if (!alreadyVerified) {
      const verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
        {
          headers: { Authorization: `Bearer ${flutterwaveSecret}` },
          signal: AbortSignal.timeout(12_000),
        },
      );
      const flutterwave = await verifyResponse.json().catch(() => null);
      if (!verifyResponse.ok || !flutterwave) {
        console.error('Flutterwave verification request failed', { status: verifyResponse.status });
        return json({ error: 'payment_provider_unavailable' }, 502);
      }

      const payment = flutterwave.data;
      const verified =
        flutterwave.status === 'success' &&
        payment?.status === 'successful' &&
        String(payment?.id) === transactionId &&
        payment?.tx_ref === txRef &&
        String(payment?.currency).toUpperCase() === String(tx.currency).toUpperCase() &&
        Number.isFinite(Number(payment?.amount)) &&
        Number(payment.amount) === Number(tx.amount);

      if (!verified) return json({ verified: false, status: payment?.status ?? 'unverified' });

      const { data: updatedTx, error: updateTxError } = await admin
        .from('payment_transactions')
        .update({
          status: 'successful',
          flutterwave_tx_id: transactionId,
          flutterwave_response: flutterwave,
          escrow_status: 'held',
        })
        .eq('id', tx.id)
        .in('status', ['initiated', 'pending'])
        .select('id')
        .maybeSingle();
      if (updateTxError) throw updateTxError;

      // A webhook may have completed the same payment while verification was in flight.
      if (!updatedTx) {
        const { data: currentTx, error: currentTxError } = await admin
          .from('payment_transactions')
          .select('status, flutterwave_tx_id')
          .eq('id', tx.id)
          .single();
        if (currentTxError) throw currentTxError;
        if (currentTx.status !== 'successful' || currentTx.flutterwave_tx_id !== transactionId) {
          return json({ error: 'payment_state_changed' }, 409);
        }
      }
    }

    if (order.status === 'en_attente') {
      const { error: orderUpdateError } = await admin
        .from('orders')
        .update({ status: 'payee' })
        .eq('id', order.id)
        .eq('status', 'en_attente');
      if (orderUpdateError) throw orderUpdateError;
    }

    const rate = Number(order.commission_rate);
    const splitType = rate === 0.03 ? 'group_buy' : rate === 0.07 ? 'booste' : rate === 0.08 ? 'live' : 'normale';
    const { data: existingSplit, error: splitReadError } = await admin
      .from('commission_splits')
      .select('id')
      .eq('transaction_id', tx.id)
      .limit(1)
      .maybeSingle();
    if (splitReadError) throw splitReadError;
    if (!existingSplit) {
      const { error: splitInsertError } = await admin.from('commission_splits').insert({
        transaction_id: tx.id,
        afrixa_amount: Number(tx.commission_amount),
        seller_amount: Number(tx.seller_amount),
        split_type: splitType,
        split_rate: rate,
        status: 'pending',
      });
      if (splitInsertError) throw splitInsertError;
    }

    return json({ verified: true, status: 'successful' });
  } catch (error) {
    console.error('Payment verification failed', error);
    return json({ error: 'payment_verification_failed' }, 500);
  }
});
