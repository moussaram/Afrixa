import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity, verifyFedaPaySignature } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const currencyIso = (currency: unknown) => {
  if (typeof currency === 'string') return currency.toUpperCase();
  if (currency && typeof currency === 'object' && 'iso' in currency) {
    return String((currency as { iso: unknown }).iso).toUpperCase();
  }
  return '';
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const webhookSecret = Deno.env.get('FEDAPAY_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !supabaseUrl || !serviceRole) {
    console.error('FedaPay webhook is missing server configuration');
    return json({ error: 'webhook_unavailable' }, 503);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 256_000) return json({ error: 'payload_too_large' }, 413);
    const signatureValid = await verifyFedaPaySignature(
      rawBody,
      req.headers.get('X-FEDAPAY-SIGNATURE'),
      webhookSecret,
    );
    if (!signatureValid) return json({ error: 'invalid_signature' }, 401);

    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const eventName = String(event.name ?? event.type ?? '');
    const eventObject = event.data && typeof event.data === 'object'
      ? event.data as Record<string, unknown>
      : event;
    const objectId = String(event.object_id ?? eventObject.object_id ?? eventObject.id ?? '');
    if (!/^\d{1,32}$/.test(objectId)) return json({ error: 'invalid_event' }, 400);

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (eventName.startsWith('transaction.')) {
      const { data: tx, error: txError } = await admin.from('payment_transactions')
        .select('id, order_id, fedapay_ref, fedapay_transaction_id, amount, commission_amount, seller_amount, currency, status')
        .eq('fedapay_transaction_id', objectId)
        .maybeSingle();
      if (txError) throw txError;
      if (!tx) return json({ received: true, ignored: true });

      // Do not rely on the event's status or amount; fetch the authoritative object.
      const providerResponse = await fedapayRequest(`/transactions/${encodeURIComponent(objectId)}`);
      const payment = getFedaPayEntity(providerResponse);
      const { data: order, error: orderError } = await admin.from('orders')
        .select('id, total_price, commission_rate, status')
        .eq('id', tx.order_id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || String(payment?.id) !== objectId || Number(payment?.amount) !== Number(tx.amount)
        || Number(order.total_price) !== Number(tx.amount)
        || currencyIso(payment?.currency) !== String(tx.currency).toUpperCase()) {
        console.error('FedaPay event does not match stored payment', { transactionId: tx.id });
        return json({ received: true, rejected: true });
      }

      const providerStatus = String(payment?.status ?? '').toLowerCase();
      if (providerStatus === 'approved') {
        if (['initiated', 'creating', 'pending'].includes(tx.status)) {
          const { error: updateTxError } = await admin.from('payment_transactions')
            .update({ status: 'successful', fedapay_response: providerResponse })
            .eq('id', tx.id).in('status', ['initiated', 'creating', 'pending']);
          if (updateTxError) throw updateTxError;
        }
        if (order.status === 'en_attente') {
          const { error: updateOrderError } = await admin.from('orders')
            .update({ status: 'payee' }).eq('id', order.id).eq('status', 'en_attente');
          if (updateOrderError) throw updateOrderError;
        }
        const { data: split, error: splitReadError } = await admin.from('commission_splits')
          .select('id').eq('transaction_id', tx.id).limit(1).maybeSingle();
        if (splitReadError) throw splitReadError;
        if (!split) {
          const rate = Number(order.commission_rate);
          const type = rate === 0.03 ? 'group_buy' : rate === 0.07 ? 'booste' : rate === 0.08 ? 'live' : 'normale';
          const { error: splitInsertError } = await admin.from('commission_splits').insert({
            transaction_id: tx.id,
            afrixa_amount: Number(tx.commission_amount),
            seller_amount: Number(tx.seller_amount),
            split_type: type,
            split_rate: rate,
            status: 'pending',
          });
          if (splitInsertError) throw splitInsertError;
        }
        return json({ received: true, processed: true });
      }

      if (['declined', 'canceled', 'cancelled'].includes(providerStatus)
        && ['initiated', 'creating', 'pending'].includes(tx.status)) {
        const status = providerStatus === 'canceled' || providerStatus === 'cancelled' ? 'cancelled' : 'failed';
        const { error: txUpdateError } = await admin.from('payment_transactions')
          .update({ status, fedapay_response: providerResponse }).eq('id', tx.id);
        if (txUpdateError) throw txUpdateError;
        if (order.status === 'en_attente') {
          const { error: orderUpdateError } = await admin.from('orders')
            .update({ status: 'annulee' }).eq('id', order.id).eq('status', 'en_attente');
          if (orderUpdateError) throw orderUpdateError;
        }
      }
      return json({ received: true, ignored: true });
    }

    if (eventName.startsWith('payout.')) {
      const { data: payout, error: payoutError } = await admin.from('seller_payouts')
        .select('id, order_id, amount, payout_reference, fedapay_transfer_id, status')
        .eq('fedapay_transfer_id', objectId)
        .maybeSingle();
      if (payoutError) throw payoutError;
      if (!payout) return json({ received: true, ignored: true });
      const providerResponse = await fedapayRequest(`/payouts/${encodeURIComponent(objectId)}`);
      const providerPayout = getFedaPayEntity(providerResponse);
      const status = String(providerPayout?.status ?? '').toLowerCase();
      if (String(providerPayout?.id) !== objectId || Number(providerPayout?.amount) !== Number(payout.amount)
        || currencyIso(providerPayout?.currency) !== 'XOF') {
        console.error('FedaPay payout event does not match local payout', { payoutId: payout.id });
        return json({ received: true, rejected: true });
      }
      if (status === 'sent') {
        const { error: payoutUpdateError } = await admin.from('seller_payouts')
          .update({ status: 'envoye', fedapay_response: providerResponse }).eq('id', payout.id);
        if (payoutUpdateError) throw payoutUpdateError;
        const { data: paymentTx, error: paymentTxError } = await admin.from('payment_transactions')
          .select('id').eq('order_id', payout.order_id).eq('status', 'successful').single();
        if (paymentTxError) throw paymentTxError;
        const { error: txUpdateError } = await admin.from('payment_transactions')
          .update({ escrow_status: 'released' }).eq('id', paymentTx.id);
        if (txUpdateError) throw txUpdateError;
        const { error: orderUpdateError } = await admin.from('orders')
          .update({ status: 'terminee', escrow_released: true }).eq('id', payout.order_id).eq('status', 'livree');
        if (orderUpdateError) throw orderUpdateError;
        const { data: split, error: splitReadError } = await admin.from('commission_splits')
          .select('id').eq('transaction_id', paymentTx.id).maybeSingle();
        if (splitReadError) throw splitReadError;
        if (split) {
          const { error: splitUpdateError } = await admin.from('commission_splits')
            .update({ status: 'percue' }).eq('id', split.id);
          if (splitUpdateError) throw splitUpdateError;
        }
      } else if (status === 'failed') {
        const { error: payoutUpdateError } = await admin.from('seller_payouts')
          .update({ status: 'echec', fedapay_response: providerResponse }).eq('id', payout.id);
        if (payoutUpdateError) throw payoutUpdateError;
      }
      return json({ received: true, processed: true });
    }

    return json({ received: true, ignored: true });
  } catch (error) {
    console.error('FedaPay webhook processing failed', error);
    return json({ error: 'webhook_processing_failed' }, 500);
  }
});
