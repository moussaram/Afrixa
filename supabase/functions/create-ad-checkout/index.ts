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
    console.error('Ad checkout is missing server configuration');
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
    const campaignId = typeof body?.campaign_id === 'string' ? body.campaign_id : '';
    const phoneDigits = typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
      return json({ error: 'invalid_campaign' }, 400);
    }
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return json({ error: 'invalid_phone' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: campaign, error: campaignError } = await admin
      .from('ad_campaigns')
      .select('id, advertiser_id, title, budget, status, fedapay_transaction_id, payment_reference')
      .eq('id', campaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign || campaign.advertiser_id !== user.id) return json({ error: 'campaign_not_found' }, 404);
    if (campaign.status !== 'pending' || !Number.isSafeInteger(campaign.budget) || campaign.budget < 1) {
      return json({ error: 'campaign_not_payable' }, 409);
    }
    if (campaign.fedapay_transaction_id) {
      return json({ error: 'campaign_payment_in_progress' }, 409);
    }

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
    const publicUrl = new URL(appUrl);
    if (publicUrl.protocol !== 'https:' && publicUrl.hostname !== 'localhost') {
      return json({ error: 'payment_configuration_invalid' }, 503);
    }
    const reference = campaign.payment_reference ?? `AD-${campaign.id.replaceAll('-', '')}`;
    const callbackUrl = new URL('/ads', publicUrl);
    callbackUrl.searchParams.set('campaign', reference);

    const createResult = await fedapayRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        description: `Afrixa Ads - ${String(campaign.title).slice(0, 90)}`,
        amount: Number(campaign.budget),
        currency: { iso: 'XOF' },
        callback_url: callbackUrl.toString(),
        customer: {
          firstname: customerName.firstname,
          lastname: customerName.lastname,
          email: user.email,
          phone_number: { number: phoneDigits, country },
        },
        custom_metadata: { ad_campaign_id: campaign.id, payment_reference: reference },
      }),
    });
    const transaction = getFedaPayEntity(createResult);
    const transactionId = String(transaction?.id ?? '');
    if (!transactionId || !/^\d+$/.test(transactionId)) {
      throw new Error('FedaPay returned an invalid transaction identifier');
    }

    const { error: attachError } = await admin.rpc('attach_ad_campaign_transaction', {
      p_campaign_id: campaign.id,
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
      campaign_id: campaign.id,
      amount: Number(campaign.budget),
    });
  } catch (error) {
    console.error('Ad checkout creation failed', error);
    return json({ error: 'checkout_creation_failed' }, 502);
  }
});
