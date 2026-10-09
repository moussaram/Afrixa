import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const operatorCodes: Record<string, string> = {
  orange_money: 'ORANGE',
  wave: 'WAVE',
  mtn: 'MTN',
  moov: 'MOOV',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const flutterwaveSecret = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole || !flutterwaveSecret) {
    console.error('Escrow release is missing server configuration');
    return json({ error: 'payout_unavailable' }, 503);
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
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: 'invalid_order_id' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id, seller_amount, commission_amount, commission_rate, payment_operator, status, escrow_released')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.buyer_id !== userId) return json({ error: 'order_not_found' }, 404);
    if (order.status !== 'livree') return json({ error: 'order_not_delivered' }, 409);

    const { data: tx, error: txError } = await admin
      .from('payment_transactions')
      .select('id, amount, seller_amount, currency, status, escrow_status')
      .eq('order_id', orderId)
      .eq('status', 'successful')
      .maybeSingle();
    if (txError) throw txError;
    if (!tx || tx.escrow_status !== 'held') {
      return json({ error: 'verified_payment_not_available' }, 409);
    }
    if (Number(tx.seller_amount) !== Number(order.seller_amount) || tx.currency !== 'XOF') {
      console.error('Payout amount does not match the verified order', { orderId });
      return json({ error: 'payout_amount_mismatch' }, 409);
    }

    const payoutReference = `AFR-PAYOUT-${orderId.replaceAll('-', '')}`;
    const { data: priorPayout, error: payoutReadError } = await admin
      .from('seller_payouts')
      .select('id, status, payout_reference')
      .eq('payout_reference', payoutReference)
      .maybeSingle();
    if (payoutReadError) throw payoutReadError;
    if (priorPayout) {
      if (['envoye', 'successful', 'SUCCESSFUL'].includes(priorPayout.status)) {
        return json({ success: true, pending: false, reference: payoutReference, duplicate: true });
      }
      return json({ success: false, pending: priorPayout.status === 'processing', error: 'payout_requires_review' }, 409);
    }
    if (order.escrow_released) return json({ error: 'escrow_state_requires_review' }, 409);

    const { data: sellerProfile, error: sellerError } = await admin
      .from('profiles')
      .select('numero_mobile')
      .eq('user_id', order.seller_id)
      .maybeSingle();
    if (sellerError) throw sellerError;
    const sellerPhone = sellerProfile?.numero_mobile;
    const bankCode = operatorCodes[order.payment_operator ?? ''];
    if (!sellerPhone || !bankCode) return json({ error: 'seller_payout_details_unavailable' }, 422);

    // Claim the payout before contacting Flutterwave. The unique reference prevents
    // concurrent requests from creating two transfers for the same order.
    const { data: payout, error: claimError } = await admin
      .from('seller_payouts')
      .insert({
        seller_id: order.seller_id,
        order_id: orderId,
        amount: order.seller_amount,
        operator: order.payment_operator,
        phone: sellerPhone,
        status: 'processing',
        payout_reference: payoutReference,
      })
      .select('id')
      .single();
    if (claimError) {
      if (claimError.code === '23505') return json({ error: 'payout_already_processing' }, 409);
      throw claimError;
    }

    let transferResponse: Response;
    try {
      transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flutterwaveSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: bankCode,
          account_number: sellerPhone,
          amount: Number(order.seller_amount),
          currency: 'XOF',
          narration: `Afrixa payout ${orderId.slice(0, 8)}`,
          reference: payoutReference,
          beneficiary_name: 'Afrixa Seller',
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // Keep the local claim in processing after an ambiguous network failure.
      // Reconciliation must happen before retrying a money movement.
      console.error('Flutterwave payout request outcome is unknown', { payoutId: payout.id, error });
      return json({ success: false, pending: true, reference: payoutReference, error: 'payout_status_unknown' }, 202);
    }

    const transfer = await transferResponse.json().catch(() => null);
    if (!transferResponse.ok || transfer?.status !== 'success' || !transfer?.data?.id) {
      console.error('Flutterwave rejected payout initiation', { payoutId: payout.id, status: transferResponse.status });
      if (transferResponse.status >= 400 && transferResponse.status < 500) {
        const { error: payoutUpdateError } = await admin
          .from('seller_payouts')
          .update({ status: 'echec' })
          .eq('id', payout.id)
          .eq('status', 'processing');
        if (payoutUpdateError) throw payoutUpdateError;
      }
      return json({ success: false, pending: transferResponse.status >= 500, reference: payoutReference, error: 'payout_not_completed' }, 502);
    }

    // Flutterwave initially reports a queued transfer (usually NEW). A signed
    // transfer.completed webhook performs final settlement after SUCCESSFUL.
    return json({ success: true, pending: true, reference: payoutReference });
  } catch (error) {
    console.error('Escrow release failed', error);
    return json({ error: 'payout_processing_failed' }, 500);
  }
});
