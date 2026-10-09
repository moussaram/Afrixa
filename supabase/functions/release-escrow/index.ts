import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const payoutCountries: Record<string, { iso: string; dial: string }> = {
  mtn_open: { iso: 'BJ', dial: '229' }, moov: { iso: 'BJ', dial: '229' }, sbin: { iso: 'BJ', dial: '229' },
  mtn_ci: { iso: 'CI', dial: '225' }, moov_ci: { iso: 'CI', dial: '225' }, wave_ci: { iso: 'CI', dial: '225' }, orange_ci: { iso: 'CI', dial: '225' },
  moov_tg: { iso: 'TG', dial: '228' }, togocel: { iso: 'TG', dial: '228' },
  'orange-bf': { iso: 'BF', dial: '226' }, moov_bf: { iso: 'BF', dial: '226' },
  mtn_open_gn: { iso: 'GN', dial: '224' },
  wave_sn: { iso: 'SN', dial: '221' }, orange_sn: { iso: 'SN', dial: '221' },
};

const normalizePhone = (phone: string, dialCode: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith(dialCode)) return `+${digits}`;
  return `+${dialCode}${digits.replace(/^0+/, '')}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (Deno.env.get('FEDAPAY_PAYOUTS_ENABLED') !== 'true') {
    return json({ error: 'seller_payouts_not_enabled_for_account' }, 503);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) {
    console.error('FedaPay payout is missing server configuration');
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
    const buyerId = authData.user?.id;
    if (authError || !buyerId) return json({ error: 'unauthorized' }, 401);
    const body = await req.json();
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: 'invalid_order_id' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin.from('orders')
      .select('id, buyer_id, seller_id, seller_amount, commission_amount, payment_operator, status, escrow_released')
      .eq('id', orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.buyer_id !== buyerId) return json({ error: 'order_not_found' }, 404);
    if (order.status !== 'livree') return json({ error: 'order_not_delivered' }, 409);
    if (order.escrow_released) return json({ error: 'escrow_already_released' }, 409);

    const { data: tx, error: txError } = await admin.from('payment_transactions')
      .select('id, amount, seller_amount, currency, status, escrow_status')
      .eq('order_id', orderId).eq('status', 'successful').maybeSingle();
    if (txError) throw txError;
    if (!tx || tx.escrow_status !== 'held' || tx.currency !== 'XOF'
      || Number(tx.seller_amount) !== Number(order.seller_amount)) {
      return json({ error: 'verified_payment_not_available' }, 409);
    }

    const { data: sellerProfile, error: sellerProfileError } = await admin.from('profiles')
      .select('prenom, nom, numero_mobile, numero_mobile_operateur')
      .eq('user_id', order.seller_id).maybeSingle();
    if (sellerProfileError) throw sellerProfileError;
    const mode = sellerProfile?.numero_mobile_operateur ?? '';
    const payoutCountry = payoutCountries[mode];
    if (!sellerProfile?.numero_mobile || !payoutCountry) {
      return json({ error: 'seller_payout_details_unavailable' }, 422);
    }
    const { data: sellerAuth, error: sellerAuthError } = await admin.auth.admin.getUserById(order.seller_id);
    if (sellerAuthError) throw sellerAuthError;
    const seller = sellerAuth.user;
    const email = seller?.email;
    const firstname = sellerProfile.prenom?.trim();
    const lastname = sellerProfile.nom?.trim();
    if (!email || !firstname || !lastname) return json({ error: 'seller_profile_incomplete' }, 422);

    const payoutReference = `AFR-PAYOUT-${orderId.replaceAll('-', '')}`;
    const { data: existing, error: existingError } = await admin.from('seller_payouts')
      .select('id, status, payout_reference, fedapay_transfer_id')
      .eq('payout_reference', payoutReference).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      if (existing.status === 'envoye') return json({ success: true, pending: false, reference: payoutReference, duplicate: true });
      return json({ success: false, pending: true, error: 'payout_requires_review' }, 409);
    }

    const { data: payout, error: claimError } = await admin.from('seller_payouts').insert({
      seller_id: order.seller_id,
      order_id: order.id,
      amount: Number(order.seller_amount),
      operator: mode,
      phone: sellerProfile.numero_mobile,
      status: 'processing',
      payout_reference: payoutReference,
    }).select('id').single();
    if (claimError) {
      if (claimError.code === '23505') return json({ error: 'payout_already_processing' }, 409);
      throw claimError;
    }

    const providerResponse = await fedapayRequest('/payouts', {
      method: 'POST',
      body: JSON.stringify({
        description: `Afrixa ${payoutReference}`,
        amount: Number(order.seller_amount),
        currency: { iso: 'XOF' },
        mode,
        customer: {
          firstname,
          lastname,
          email,
          phone_number: {
            number: normalizePhone(sellerProfile.numero_mobile, payoutCountry.dial),
            country: payoutCountry.iso,
          },
        },
        custom_metadata: { order_id: order.id, payout_reference: payoutReference },
      }),
    });
    const providerPayout = getFedaPayEntity(providerResponse);
    const payoutId = String(providerPayout?.id ?? '');
    if (!/^\d{1,32}$/.test(payoutId) || Number(providerPayout?.amount) !== Number(order.seller_amount)) {
      console.error('FedaPay returned an invalid payout object', { localPayoutId: payout.id });
      return json({ success: false, pending: true, error: 'payout_status_unknown' }, 202);
    }
    const { error: savePayoutError } = await admin.from('seller_payouts').update({
      fedapay_transfer_id: payoutId,
      fedapay_transfer_ref: payoutReference,
      fedapay_response: providerResponse,
    }).eq('id', payout.id).eq('status', 'processing');
    if (savePayoutError) throw savePayoutError;

    try {
      await fedapayRequest('/payouts/start', {
        method: 'PUT',
        body: JSON.stringify({ payouts: [{ id: Number(payoutId) }] }),
      });
    } catch (error) {
      console.error('FedaPay payout start result requires reconciliation', { payoutId, error });
      return json({ success: false, pending: true, reference: payoutReference, error: 'payout_status_unknown' }, 202);
    }
    return json({ success: true, pending: true, reference: payoutReference });
  } catch (error) {
    console.error('FedaPay escrow payout failed', error);
    return json({ error: 'payout_processing_failed' }, 502);
  }
});
