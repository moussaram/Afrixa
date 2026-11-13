import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const payoutCountries: Record<string, { iso: string; dial: string }> = {
  mtn_open: { iso: 'BJ', dial: '229' },
  moov: { iso: 'BJ', dial: '229' },
  sbin: { iso: 'BJ', dial: '229' },
  mtn_ci: { iso: 'CI', dial: '225' },
  moov_ci: { iso: 'CI', dial: '225' },
  wave_ci: { iso: 'CI', dial: '225' },
  orange_ci: { iso: 'CI', dial: '225' },
  moov_tg: { iso: 'TG', dial: '228' },
  togocel: { iso: 'TG', dial: '228' },
  'orange-bf': { iso: 'BF', dial: '226' },
  moov_bf: { iso: 'BF', dial: '226' },
  mtn_open_gn: { iso: 'GN', dial: '224' },
  wave_sn: { iso: 'SN', dial: '221' },
  orange_sn: { iso: 'SN', dial: '221' },
};

const normalizePhone = (phone: string, dialCode: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith(dialCode)) return `+${digits}`;
  return `+${dialCode}${digits.replace(/^0+/, '')}`;
};

const WITHDRAWAL_ERRORS: Record<string, string> = {
  'Solde disponible insuffisant': 'insufficient_balance',
  'Un retrait est deja en cours de traitement': 'withdrawal_pending',
  'Limite quotidienne de retraits atteinte': 'withdrawal_daily_limit',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRole) {
    console.error('Creator withdrawal is missing server configuration');
    return json({ error: 'payout_unavailable' }, 503);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  let payoutId: string | null = null;

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const amount = Number(body?.amount);
    const operator = typeof body?.operator === 'string' ? body.operator.trim() : '';
    const phoneDigits = typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    const idempotencyKey = typeof body?.idempotency_key === 'string' && body.idempotency_key.length <= 120
      ? body.idempotency_key
      : `withdrawal:${crypto.randomUUID()}`;

    if (!Number.isSafeInteger(amount) || amount <= 0) return json({ error: 'invalid_amount' }, 400);
    if (!payoutCountries[operator]) return json({ error: 'invalid_operator' }, 400);
    if (phoneDigits.length < 8 || phoneDigits.length > 15) return json({ error: 'invalid_phone' }, 400);

    const { data: reserved, error: reserveError } = await userClient.rpc('request_my_withdrawal', {
      p_amount: amount,
      p_operator: operator,
      p_phone: phoneDigits,
      p_idempotency_key: idempotencyKey,
    });
    if (reserveError) {
      const mapped = WITHDRAWAL_ERRORS[reserveError.message];
      if (mapped) return json({ error: mapped }, 409);
      console.error('Withdrawal reservation failed', reserveError);
      return json({ error: 'withdrawal_rejected' }, 400);
    }
    payoutId = typeof reserved?.payout_id === 'string' ? reserved.payout_id : null;
    if (!payoutId) throw new Error('Withdrawal reservation returned no payout id');

    if (Deno.env.get('FEDAPAY_PAYOUTS_ENABLED') !== 'true') {
      return json({
        success: true,
        pending: true,
        status: 'demande',
        payout_id: payoutId,
        amount,
        message: 'Retrait enregistré. Le versement sera envoyé après validation.',
      });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('prenom, nom')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const firstname = profile?.prenom?.trim();
    const lastname = profile?.nom?.trim();
    if (!firstname || !lastname || !user.email) {
      await admin.rpc('fail_creator_withdrawal', { p_payout_id: payoutId, p_reason: 'profile_incomplete' });
      return json({ error: 'complete_payout_profile' }, 422);
    }

    const country = payoutCountries[operator];
    const { data: payout, error: payoutError } = await admin.from('seller_payouts')
      .select('id, amount, status, payout_reference, fedapay_transfer_id')
      .eq('id', payoutId)
      .maybeSingle();
    if (payoutError) throw payoutError;
    if (!payout) throw new Error('Reserved payout not found');
    if (payout.fedapay_transfer_id || payout.status === 'processing') {
      // Une tentative deja lancee sans identifiant fournisseur doit etre rapprochee manuellement.
      // Ne jamais recreer un transfert dont la reponse precedente a pu etre perdue.
      return json({ success: true, pending: true, status: 'processing', payout_id: payout.id }, 202);
    }

    const { data: claim, error: claimError } = await admin.from('seller_payouts')
      .update({ status: 'processing' })
      .eq('id', payout.id)
      .eq('status', 'demande')
      .is('fedapay_transfer_id', null)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claim) {
      return json({ success: true, pending: true, status: 'processing', payout_id: payout.id }, 202);
    }

    const reference = payout.payout_reference ?? `AFR-WD-${payout.id.replaceAll('-', '')}`;
    const providerResponse = await fedapayRequest('/payouts', {
      method: 'POST',
      body: JSON.stringify({
        description: `Afrixa retrait createur ${reference}`,
        amount: Number(payout.amount),
        currency: { iso: 'XOF' },
        mode: operator,
        customer: {
          firstname,
          lastname,
          email: user.email,
          phone_number: {
            number: normalizePhone(phoneDigits, country.dial),
            country: country.iso,
          },
        },
        custom_metadata: { creator_id: user.id, payout_reference: reference },
      }),
    });
    const providerPayout = getFedaPayEntity(providerResponse);
    const transferId = String(providerPayout?.id ?? '');
    if (!/^\d{1,32}$/.test(transferId) || Number(providerPayout?.amount) !== Number(payout.amount)) {
      console.error('FedaPay returned an invalid creator payout', { payoutId: payout.id });
      return json({ success: true, pending: true, status: 'processing', payout_id: payout.id }, 202);
    }

    const { data: savedTransfer, error: saveError } = await admin.from('seller_payouts').update({
      fedapay_transfer_id: transferId,
      fedapay_transfer_ref: reference,
      fedapay_response: providerResponse,
    }).eq('id', payout.id)
      .eq('status', 'processing')
      .is('fedapay_transfer_id', null)
      .select('id')
      .maybeSingle();
    if (saveError) throw saveError;
    if (!savedTransfer) {
      return json({ success: true, pending: true, status: 'processing', payout_id: payout.id }, 202);
    }

    try {
      await fedapayRequest('/payouts/start', {
        method: 'PUT',
        body: JSON.stringify({ payouts: [{ id: Number(transferId) }] }),
      });
    } catch (startError) {
      console.error('FedaPay payout start requires reconciliation', { transferId, startError });
      return json({ success: true, pending: true, status: 'processing', payout_id: payout.id }, 202);
    }

    return json({ success: true, pending: true, status: 'processing', payout_id: payout.id });
  } catch (error) {
    console.error('Creator withdrawal requires reconciliation', error);
    if (payoutId) {
      // Un timeout ou une reponse perdue ne prouve pas que FedaPay n'a pas cree le transfert.
      // Le montant reste reserve jusqu'a confirmation ou rapprochement manuel.
      return json({
        success: true,
        pending: true,
        status: 'processing',
        payout_id: payoutId,
        message: 'Le retrait est en cours de rapprochement. Il ne sera pas relance automatiquement.',
      }, 202);
    }
    return json({ error: 'payout_processing_failed' }, 502);
  }
});
