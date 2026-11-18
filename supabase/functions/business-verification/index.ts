import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('AFRIXA_PUBLIC_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const BUCKET = 'business-verification-documents';
const PLAN_ID = 'business-annual';
const validUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const currencyIso = (v: any) => typeof v === 'string' ? v.toUpperCase()
  : v && typeof v === 'object' && 'iso' in v ? String(v.iso).toUpperCase() : '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = Deno.env.get('AFRIXA_PUBLIC_URL');
  const auth = req.headers.get('Authorization');
  if (!url || !anon || !service || !appUrl) return json({ error: 'service_unavailable' }, 503);
  if (!auth) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: 'unauthorized' }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const body = await req.json();
    const action = String(body?.action ?? '');

    if (action === 'status') {
      const [{ data: plan }, { data: subscriptions }, { data: requests }, { data: reviewer }] = await Promise.all([
        admin.from('business_verification_plans').select('id,name,amount_xof,duration_days').eq('id', PLAN_ID).eq('active', true).maybeSingle(),
        admin.from('business_verification_subscriptions').select('id,status,amount_xof,expires_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        admin.from('business_verification_requests').select('id,subscription_id,status,entity_type,legal_name,public_name,decision_reason,submitted_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        admin.from('business_verification_reviewers').select('role').eq('user_id', user.id).eq('active', true).maybeSingle(),
      ]);
      return json({ plan, subscriptions: subscriptions ?? [], requests: requests ?? [], reviewer_role: reviewer?.role ?? null });
    }

    if (action === 'create_checkout') {
      const { data: plan, error: planError } = await admin.from('business_verification_plans')
        .select('id,amount_xof,duration_days').eq('id', PLAN_ID).eq('active', true).single();
      if (planError || !plan) return json({ error: 'plan_unavailable' }, 503);
      const { data: profile, error: profileError } = await admin.from('profiles')
        .select('prenom,nom,numero_mobile').eq('user_id', user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.prenom || !profile?.nom || !profile?.numero_mobile || !user.email) return json({ error: 'complete_profile_for_payment' }, 422);
      const { data: active } = await admin.from('business_verification_subscriptions')
        .select('id').eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString()).maybeSingle();
      if (active) return json({ error: 'subscription_already_active' }, 409);
      await admin.from('business_verification_subscriptions').update({ status: 'expired' })
        .eq('user_id', user.id).eq('status', 'active').lte('expires_at', new Date().toISOString());
      const { data: pending } = await admin.from('business_verification_subscriptions')
        .select('id,fedapay_transaction_id,fedapay_reference').eq('user_id', user.id).eq('status', 'payment_pending')
        .order('created_at', { ascending: false }).maybeSingle();
      let subscriptionId = pending?.id ?? '';
      let reference = pending?.fedapay_reference ?? '';
      if (pending?.fedapay_transaction_id) {
        const old = getFedaPayEntity(await fedapayRequest('/transactions/' + encodeURIComponent(pending.fedapay_transaction_id)));
        if (String(old?.status).toLowerCase() === 'approved') return json({ error: 'payment_pending_verification', subscription_id: pending.id }, 409);
        if (!['declined','canceled','cancelled','failed','expired'].includes(String(old?.status).toLowerCase())) {
          const tokenResponse = await fedapayRequest('/transactions/' + encodeURIComponent(pending.fedapay_transaction_id) + '/token', { method: 'POST', body: '{}' });
          const token = getFedaPayEntity(tokenResponse) ?? tokenResponse;
          const checkout = new URL(String(token.url ?? ''));
          if (checkout.protocol === 'https:' && checkout.hostname.endsWith('.fedapay.com')) return json({ checkout_url: checkout.toString(), subscription_id: pending.id });
        }
        await admin.from('business_verification_subscriptions').update({ status: 'cancelled' }).eq('id', pending.id);
        subscriptionId = ''; reference = '';
      }
      if (!subscriptionId) {
        reference = 'business_' + crypto.randomUUID();
        const { data, error } = await admin.from('business_verification_subscriptions').insert({
          user_id: user.id, plan_id: PLAN_ID, amount_xof: plan.amount_xof, currency: 'XOF',
          status: 'payment_pending', fedapay_reference: reference,
        }).select('id').single();
        if (error) throw error;
        subscriptionId = data.id;
      }
      const callback = new URL('/business-verification', appUrl);
      callback.searchParams.set('payment', 'return');
      callback.searchParams.set('subscription_id', subscriptionId);
      const metadata = user.user_metadata ?? {};
      const country = typeof metadata.country === 'string' && /^[A-Za-z]{2}$/.test(metadata.country) ? metadata.country.toUpperCase() : 'BJ';
      const created = getFedaPayEntity(await fedapayRequest('/transactions', { method: 'POST', body: JSON.stringify({
        description: 'Afrixa - Entreprise / boutique vérifiée (12 mois)',
        amount: plan.amount_xof, currency: { iso: 'XOF' }, callback_url: callback.toString(),
        customer: { firstname: profile.prenom, lastname: profile.nom, email: user.email,
          phone_number: { number: profile.numero_mobile, country } },
        custom_metadata: { purpose: 'business_verification', user_id: user.id, subscription_id: subscriptionId, payment_reference: reference },
      }) }));
      const transactionId = String(created?.id ?? '');
      if (!/^\d{1,32}$/.test(transactionId)) throw new Error('invalid_fedapay_transaction');
      const { error: saveError } = await admin.from('business_verification_subscriptions')
        .update({ fedapay_transaction_id: transactionId }).eq('id', subscriptionId).eq('status', 'payment_pending');
      if (saveError) throw saveError;
      const tokenResponse = await fedapayRequest('/transactions/' + encodeURIComponent(transactionId) + '/token', { method: 'POST', body: '{}' });
      const token = getFedaPayEntity(tokenResponse) ?? tokenResponse;
      const checkout = new URL(String(token.url ?? ''));
      if (checkout.protocol !== 'https:' || !checkout.hostname.endsWith('.fedapay.com')) throw new Error('invalid_checkout_url');
      return json({ checkout_url: checkout.toString(), subscription_id: subscriptionId });
    }

    if (action === 'verify_payment') {
      const id = String(body?.subscription_id ?? '');
      if (!validUuid(id)) return json({ error: 'invalid_subscription' }, 400);
      const { data: sub, error } = await admin.from('business_verification_subscriptions')
        .select('id,user_id,status,amount_xof,currency,fedapay_transaction_id,plan_id')
        .eq('id', id).eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!sub) return json({ error: 'subscription_not_found' }, 404);
      if (sub.status === 'active') return json({ verified: true });
      if (sub.status !== 'payment_pending' || !sub.fedapay_transaction_id) return json({ error: 'payment_not_verifiable' }, 409);
      const payment = getFedaPayEntity(await fedapayRequest('/transactions/' + encodeURIComponent(sub.fedapay_transaction_id)));
      const metadata = payment?.custom_metadata && typeof payment.custom_metadata === 'object' ? payment.custom_metadata : {};
      const valid = String(payment?.id) === sub.fedapay_transaction_id && String(payment?.status).toLowerCase() === 'approved'
        && Number(payment?.amount) === Number(sub.amount_xof) && currencyIso(payment?.currency) === sub.currency
        && metadata.purpose === 'business_verification' && metadata.user_id === user.id && metadata.subscription_id === sub.id;
      if (!valid) return json({ verified: false, status: String(payment?.status ?? 'unknown') });
      const { data: plan, error: planError } = await admin.from('business_verification_plans').select('duration_days').eq('id', sub.plan_id).single();
      if (planError) throw planError;
      const now = new Date();
      const expiry = new Date(now.getTime() + Number(plan.duration_days) * 86400000).toISOString();
      const { error: activateError } = await admin.from('business_verification_subscriptions').update({
        status: 'active', starts_at: now.toISOString(), expires_at: expiry, paid_at: now.toISOString(),
      }).eq('id', sub.id).eq('status', 'payment_pending');
      if (activateError) throw activateError;
      return json({ verified: true, expires_at: expiry });
    }

    if (action === 'submit_request') {
      const id = String(body?.subscription_id ?? '');
      const entityType = String(body?.entity_type ?? '');
      const legalName = String(body?.legal_name ?? '').trim();
      const publicName = String(body?.public_name ?? '').trim();
      const country = String(body?.registration_country ?? '').toUpperCase();
      const paths = Array.isArray(body?.document_paths) ? body.document_paths : [];
      const note = typeof body?.applicant_note === 'string' ? body.applicant_note.trim() : '';
      const website = typeof body?.website_url === 'string' ? body.website_url.trim() : '';
      const address = String(body?.business_address ?? '').trim();
      const phone = String(body?.contact_phone ?? '').trim();
      const registration = String(body?.registration_number ?? '').trim();
      const tax = String(body?.tax_number ?? '').trim();
      if (body?.consent !== true || !validUuid(id) || !['company','shop'].includes(entityType)
        || legalName.length < 2 || legalName.length > 180 || publicName.length < 2 || publicName.length > 100
        || !/^[A-Z]{2}$/.test(country) || address.length < 5 || address.length > 300
        || phone.length < 6 || phone.length > 30 || registration.length > 100 || tax.length > 100
        || website.length > 300 || note.length > 1000 || paths.length < 1 || paths.length > 4
        || paths.some((p: unknown) => typeof p !== 'string' || !p.startsWith(user.id + '/') || !/\.(pdf|png|jpe?g)$/i.test(p))) {
        return json({ error: 'invalid_application' }, 400);
      }
      const { data: sub } = await admin.from('business_verification_subscriptions').select('id,status,expires_at')
        .eq('id', id).eq('user_id', user.id).maybeSingle();
      if (!sub || sub.status !== 'active' || !sub.expires_at || new Date(sub.expires_at) <= new Date()) return json({ error: 'active_subscription_required' }, 403);
      const { data: open } = await admin.from('business_verification_requests').select('id,status')
        .eq('user_id', user.id).in('status',['submitted','under_review','needs_information']).maybeSingle();
      let total = 0;
      for (const path of paths as string[]) {
        const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path);
        if (downloadError || !file) return json({ error: 'document_not_found' }, 400);
        const bytes = new Uint8Array(await file.arrayBuffer());
        total += bytes.byteLength;
        const ext = path.split('.').pop()?.toLowerCase();
        const pdf = ext === 'pdf' && new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
        const jpg = ['jpg','jpeg'].includes(ext ?? '') && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const png = ext === 'png' && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
        if (!bytes.length || bytes.length > 10*1024*1024 || !(pdf || jpg || png)) return json({ error: 'invalid_document' }, 400);
      }
      if (total > 30*1024*1024) return json({ error: 'documents_total_size_exceeded' }, 400);
      const values = {
        subscription_id:id, entity_type:entityType, legal_name:legalName, public_name:publicName,
        registration_country:country, registration_number:registration || null, tax_number:tax || null,
        business_address:address, contact_phone:phone, website_url:website || null,
        document_paths:paths, applicant_note:note || null, consented_at:new Date().toISOString(),
        consent_version:'business-verification-v1', status:'submitted', decision_reason:null,
        documents_delete_after:null, submitted_at:new Date().toISOString(), reviewed_at:null, reviewed_by:null,
      };
      if (open?.status === 'needs_information') {
        const { data, error } = await admin.from('business_verification_requests').update(values)
          .eq('id',open.id).eq('user_id',user.id).select('id,status').single();
        if (error) throw error;
        return json({ request:data,resubmitted:true });
      }
      if (open) return json({ error: 'request_already_open' }, 409);
      const { data, error } = await admin.from('business_verification_requests')
        .insert({ ...values,user_id:user.id }).select('id,status').single();
      if (error) throw error;
      return json({ request:data });
    }

    if (['review_queue','review_document','review_decide'].includes(action)) {
      const { data: reviewer } = await admin.from('business_verification_reviewers')
        .select('user_id,role').eq('user_id',user.id).eq('active',true).maybeSingle();
      if (!reviewer) return json({ error:'reviewer_access_required' },403);
      if (action === 'review_queue') {
        const status = String(body?.status ?? 'submitted');
        if (!['submitted','under_review','needs_information','approved','rejected','revoked'].includes(status)) return json({ error:'invalid_status' },400);
        const { data, error } = await admin.from('business_verification_requests')
          .select('id,user_id,subscription_id,status,entity_type,legal_name,public_name,registration_country,registration_number,tax_number,business_address,contact_phone,website_url,applicant_note,decision_reason,submitted_at')
          .eq('status',status).order('submitted_at').limit(100);
        if (error) throw error;
        return json({ requests:data ?? [],reviewer_role:reviewer.role });
      }
      if (action === 'review_document') {
        const requestId = String(body?.request_id ?? '');
        if (!validUuid(requestId)) return json({ error:'invalid_request' },400);
        const { data: row,error } = await admin.from('business_verification_requests').select('id,document_paths')
          .eq('id',requestId).maybeSingle();
        if (error) throw error;
        if (!row) return json({ error:'request_not_found' },404);
        const docs = await Promise.all((row.document_paths ?? []).map(async (path:string,index:number) => {
          const { data,error } = await admin.storage.from(BUCKET).createSignedUrl(path,120);
          if (error) throw error;
          await admin.from('business_verification_reviews').insert({ request_id:row.id,reviewer_id:user.id,action:'document_viewed' });
          return { index:index+1,document_url:data.signedUrl };
        }));
        return json({ documents:docs });
      }
      const requestId = String(body?.request_id ?? '');
      const decision = String(body?.decision ?? '');
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      const note = typeof body?.internal_note === 'string' ? body.internal_note.trim() : '';
      if (!validUuid(requestId) || !['under_review','needs_information','approved','rejected','revoked'].includes(decision)
        || (['needs_information','rejected','revoked'].includes(decision) && reason.length < 3)
        || reason.length > 1000 || note.length > 2000) return json({ error:'invalid_review_decision' },400);
      if (decision === 'revoked' && reviewer.role !== 'supervisor') return json({ error:'supervisor_required' },403);
      const { data,error } = await admin.rpc('apply_business_verification_decision',{
        p_request_id:requestId,p_decision:decision,p_reason:reason || null,p_internal_note:note || null,p_reviewer_id:user.id,
      });
      if (error) throw error;
      return json({ request:data });
    }
    return json({ error:'unknown_action' },400);
  } catch (error) {
    console.error('Business verification failed',error);
    return json({ error:'business_verification_failed' },500);
  }
});
