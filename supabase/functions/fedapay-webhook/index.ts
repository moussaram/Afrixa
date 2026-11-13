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
      if (!tx) {
        // Achat de Coins : le reglement est idempotent cote base.
        const { data: coinPurchase, error: coinError } = await admin.from('coin_purchases')
          .select('id, user_id, coins_amount, fcfa_paid, fedapay_transaction_id, status')
          .eq('fedapay_transaction_id', objectId)
          .maybeSingle();
        if (coinError) throw coinError;
        if (!coinPurchase) {
          // Campagne publicitaire : activation apres paiement confirme.
          const { data: adCampaign, error: adError } = await admin.from('ad_campaigns')
            .select('id, budget, fedapay_transaction_id, status')
            .eq('fedapay_transaction_id', objectId)
            .maybeSingle();
          if (adError) throw adError;
          if (!adCampaign) return json({ received: true, ignored: true });

          const adResponse = await fedapayRequest(`/transactions/${encodeURIComponent(objectId)}`);
          const adPayment = getFedaPayEntity(adResponse);
          if (String(adPayment?.id) !== objectId
            || Number(adPayment?.amount) !== Number(adCampaign.budget)
            || currencyIso(adPayment?.currency) !== 'XOF') {
            console.error('FedaPay ad event does not match stored campaign', { campaignId: adCampaign.id });
            return json({ received: true, rejected: true });
          }

          const adStatus = String(adPayment?.status ?? '').toLowerCase();
          if (adStatus === 'approved') {
            const { error: activateError } = await admin.rpc('activate_ad_campaign', {
              p_campaign_id: adCampaign.id,
              p_transaction_id: objectId,
            });
            if (activateError) throw activateError;
            return json({ received: true, processed: true });
          }
          if (['declined', 'canceled', 'cancelled'].includes(adStatus)) {
            const { error: failError } = await admin.rpc('fail_ad_campaign', {
              p_campaign_id: adCampaign.id,
              p_reason: adStatus,
            });
            if (failError) throw failError;
            return json({ received: true, processed: true });
          }
          return json({ received: true, ignored: true });
        }

        const coinResponse = await fedapayRequest(`/transactions/${encodeURIComponent(objectId)}`);
        const coinPayment = getFedaPayEntity(coinResponse);
        if (String(coinPayment?.id) !== objectId
          || Number(coinPayment?.amount) !== Number(coinPurchase.fcfa_paid)
          || currencyIso(coinPayment?.currency) !== 'XOF') {
          console.error('FedaPay coin event does not match stored purchase', { purchaseId: coinPurchase.id });
          return json({ received: true, rejected: true });
        }

        const coinStatus = String(coinPayment?.status ?? '').toLowerCase();
        if (coinStatus === 'approved') {
          const { error: settleError } = await admin.rpc('settle_coin_purchase', {
            p_purchase_id: coinPurchase.id,
            p_transaction_id: objectId,
            p_provider_reference: typeof coinPayment?.reference === 'string'
              ? coinPayment.reference
              : null,
            p_idempotency_key: `coin_purchase:${coinPurchase.id}`,
          });
          if (settleError) throw settleError;
          return json({ received: true, processed: true });
        }

        if (['declined', 'canceled', 'cancelled'].includes(coinStatus)) {
          const { error: failError } = await admin.rpc('fail_coin_purchase', {
            p_purchase_id: coinPurchase.id,
            p_reason: coinStatus,
            p_transaction_id: objectId,
          });
          if (failError) throw failError;
          return json({ received: true, processed: true });
        }

        return json({ received: true, ignored: true });
      }

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
        const { error: settleError } = await admin.rpc('confirm_order_payment', {
          p_transaction_id: tx.id,
          p_provider_transaction_id: objectId,
          p_provider_response: providerResponse,
        });
        if (settleError) throw settleError;
        return json({ received: true, processed: true });
      }

      if (['declined', 'canceled', 'cancelled'].includes(providerStatus)
        && ['initiated', 'creating', 'pending'].includes(tx.status)) {
        const finalStatus = providerStatus === 'declined' ? 'failed' : 'cancelled';
        const { error: failError } = await admin.rpc('fail_order_payment', {
          p_transaction_id: tx.id,
          p_final_status: finalStatus,
          p_provider_response: providerResponse,
        });
        if (failError) throw failError;
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
        if (!payout.order_id) return json({ received: true, processed: true });
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
        if (!payout.order_id) {
          // Retrait createur : le montant reserve est rendu au createur.
          const { error: refundError } = await admin.rpc('fail_creator_withdrawal', {
            p_payout_id: payout.id,
            p_reason: 'fedapay_failed',
          });
          if (refundError) throw refundError;
          return json({ received: true, processed: true });
        }
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
