import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const webhookSecret = Deno.env.get('FLW_WEBHOOK_SECRET');
  const flutterwaveSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !flutterwaveSecret || !supabaseUrl || !serviceRole) {
    console.error('Flutterwave webhook is missing server configuration');
    return json({ error: 'webhook_unavailable' }, 503);
  }

  if (req.headers.get('verif-hash') !== webhookSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const payload = await req.json();
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (payload?.event === 'transfer.completed') {
      const transferId = String(payload?.data?.id ?? '');
      const payoutReference = typeof payload?.data?.reference === 'string' ? payload.data.reference : '';
      if (!/^\d{1,32}$/.test(transferId) || !payoutReference || payoutReference.length > 100) {
        return json({ error: 'invalid_transfer_webhook' }, 400);
      }

      const { data: payout, error: payoutError } = await admin
        .from('seller_payouts')
        .select('id, order_id, amount, status, payout_reference')
        .eq('payout_reference', payoutReference)
        .maybeSingle();
      if (payoutError) throw payoutError;
      if (!payout?.order_id) return json({ ok: true, ignored: true });

      const transferVerifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transfers/${encodeURIComponent(transferId)}`,
        {
          headers: { Authorization: `Bearer ${flutterwaveSecret}` },
          signal: AbortSignal.timeout(12_000),
        },
      );
      const verifiedTransfer = await transferVerifyResponse.json().catch(() => null);
      if (!transferVerifyResponse.ok || !verifiedTransfer) {
        console.error('Flutterwave transfer verification failed', { status: transferVerifyResponse.status });
        return json({ error: 'transfer_provider_unavailable' }, 502);
      }

      const transfer = verifiedTransfer.data;
      const transferMatches =
        verifiedTransfer.status === 'success' &&
        String(transfer?.id) === transferId &&
        transfer?.reference === payoutReference &&
        String(transfer?.currency).toUpperCase() === 'XOF' &&
        Number(transfer?.amount) === Number(payout.amount);
      if (!transferMatches) {
        console.error('Flutterwave transfer does not match the payout record', { payoutId: payout.id });
        return json({ ok: true, rejected: true });
      }

      if (String(transfer.status).toUpperCase() === 'FAILED') {
        const { error: failedUpdateError } = await admin
          .from('seller_payouts')
          .update({ status: 'echec' })
          .eq('id', payout.id);
        if (failedUpdateError) throw failedUpdateError;
        return json({ ok: true, failed: true });
      }
      if (String(transfer.status).toUpperCase() !== 'SUCCESSFUL') {
        return json({ ok: true, pending: true });
      }

      const { data: order, error: orderError } = await admin
        .from('orders')
        .select('id, seller_id, seller_amount, commission_amount, commission_rate, status')
        .eq('id', payout.order_id)
        .maybeSingle();
      if (orderError) throw orderError;
      const { data: tx, error: txError } = await admin
        .from('payment_transactions')
        .select('id, status, escrow_status')
        .eq('order_id', payout.order_id)
        .eq('status', 'successful')
        .maybeSingle();
      if (txError) throw txError;
      if (!order || !tx || Number(order.seller_amount) !== Number(payout.amount)) {
        console.error('Successful transfer does not match a payable Afrixa order', { payoutId: payout.id });
        return json({ ok: true, rejected: true });
      }

      const { error: payoutUpdateError } = await admin
        .from('seller_payouts')
        .update({ status: 'envoye' })
        .eq('id', payout.id);
      if (payoutUpdateError) throw payoutUpdateError;
      const { error: txUpdateError } = await admin
        .from('payment_transactions')
        .update({ escrow_status: 'released' })
        .eq('id', tx.id);
      if (txUpdateError) throw txUpdateError;
      const { error: orderUpdateError } = await admin
        .from('orders')
        .update({ status: 'terminee', escrow_released: true })
        .eq('id', order.id);
      if (orderUpdateError) throw orderUpdateError;

      const { data: existingCommission, error: commissionReadError } = await admin
        .from('commissions')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();
      if (commissionReadError) throw commissionReadError;
      if (!existingCommission) {
        const { error: commissionInsertError } = await admin.from('commissions').insert({
          order_id: order.id,
          amount: order.commission_amount,
          rate: order.commission_rate,
          type: 'normale',
          status: 'percue',
        });
        if (commissionInsertError) throw commissionInsertError;
      }

      return json({ ok: true, completed: true });
    }

    if (payload?.event !== 'charge.completed' || payload?.data?.status !== 'successful') {
      return json({ ok: true, ignored: true });
    }

    const transactionId = String(payload.data.id ?? '');
    const txRef = typeof payload.data.tx_ref === 'string' ? payload.data.tx_ref : '';
    if (!/^\d{1,32}$/.test(transactionId) || !txRef || txRef.length > 100) {
      return json({ error: 'invalid_webhook_payload' }, 400);
    }
    const { data: tx, error: txError } = await admin
      .from('payment_transactions')
      .select('id, order_id, amount, currency, status, flutterwave_tx_id')
      .eq('flutterwave_ref', txRef)
      .maybeSingle();
    if (txError) throw txError;
    if (!tx) {
      console.warn('Ignoring Flutterwave webhook for an unknown reference');
      return json({ ok: true, ignored: true });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, total_price, status')
      .eq('id', tx.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || Number(order.total_price) !== Number(tx.amount)) {
      console.error('Flutterwave webhook does not match stored order amount', { transactionId: tx.id });
      return json({ ok: true, rejected: true });
    }

    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
      {
        headers: { Authorization: `Bearer ${flutterwaveSecret}` },
        signal: AbortSignal.timeout(12_000),
      },
    );
    const flutterwave = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok || !flutterwave) {
      console.error('Flutterwave webhook verification request failed', { status: verifyResponse.status });
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

    if (!verified) {
      console.error('Flutterwave webhook verification did not match the stored transaction', { transactionId: tx.id });
      return json({ ok: true, rejected: true });
    }

    if (tx.status === 'successful' && tx.flutterwave_tx_id === transactionId) {
      return json({ ok: true, duplicate: true });
    }
    if (!['initiated', 'pending'].includes(tx.status)) {
      console.warn('Ignoring webhook for a transaction in a terminal state', { transactionId: tx.id, status: tx.status });
      return json({ ok: true, ignored: true });
    }

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
    if (!updatedTx) return json({ ok: true, duplicate: true });

    if (order.status === 'en_attente') {
      const { error: updateOrderError } = await admin
        .from('orders')
        .update({ status: 'payee' })
        .eq('id', order.id)
        .eq('status', 'en_attente');
      if (updateOrderError) throw updateOrderError;
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Flutterwave webhook processing failed', error);
    return json({ error: 'webhook_processing_failed' }, 500);
  }
});
