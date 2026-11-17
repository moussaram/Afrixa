import { createClient } from 'npm:@supabase/supabase-js@2';
import { fedapayRequest, getFedaPayEntity } from '../_shared/fedapay.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('AFRIXA_PUBLIC_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const BUCKET = 'identity-verification-documents';
const PLAN_ID = 'identity-annual';

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
  const appUrl = Deno.env.get('AFRIXA_PUBLIC_URL');
  if (!supabaseUrl || !anonKey || !serviceRole || !appUrl) {
    return json({ error: 'service_unavailable' }, 503);
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

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json();
    const action = String(body?.action ?? '');

    if (action === 'status') {
      const [{ data: plan }, { data: subscriptions }, { data: requests }] = await Promise.all([
        admin.from('identity_verification_plans').select('id,name,amount_xof,duration_days').eq('id', PLAN_ID).eq('active', true).maybeSingle(),
        admin.from('identity_verification_subscriptions').select('id,status,amount_xof,starts_at,expires_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        admin.from('identity_verification_requests').select('id,subscription_id,status,legal_name,document_type,issuing_country,decision_reason,submitted_at,reviewed_at,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      return json({ plan, subscriptions: subscriptions ?? [], requests: requests ?? [] });
    }

    if (action === 'create_checkout') {
      const { data: plan, error: planError } = await admin.from('identity_verification_plans')
        .select('id,name,amount_xof,duration_days').eq('id', PLAN_ID).eq('active', true).single();
      if (planError || !plan) return json({ error: 'plan_unavailable' }, 503);

      const { data: profile, error: profileError } = await admin.from('profiles')
        .select('prenom,nom,numero_mobile').eq('user_id', user.id).maybeSingle();
      if (profileError) throw profileError;
      const firstName = String(profile?.prenom ?? '').trim();
      const lastName = String(profile?.nom ?? '').trim();
      const phone = String(profile?.numero_mobile ?? '').trim();
      if (!firstName || !lastName || !phone || !user.email) {
        return json({ error: 'complete_profile_for_payment' }, 422);
      }

      const { data: existing } = await admin.from('identity_verification_subscriptions')
        .select('id,status,expires_at').eq('user_id', user.id).eq('status', 'active')
        .gt('expires_at', new Date().toISOString()).limit(1).maybeSingle();
      if (existing) return json({ error: 'subscription_already_active', subscription: existing }, 409);

      const { data: pending } = await admin.from('identity_verification_subscriptions')
        .select('id,fedapay_transaction_id,fedapay_reference,status').eq('user_id', user.id)
        .eq('status', 'payment_pending').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pending?.fedapay_transaction_id) {
        const existingPaymentResponse = await fedapayRequest(`/transactions/${encodeURIComponent(pending.fedapay_transaction_id)}`);
        const existingPayment = getFedaPayEntity(existingPaymentResponse);
        const existingStatus = String(existingPayment?.status ?? '').toLowerCase();
        if (existingStatus === 'approved') {
          return json({ error: 'payment_pending_verification', subscription_id: pending.id }, 409);
        }
        if (['declined', 'canceled', 'cancelled', 'failed'].includes(existingStatus)) {
          const { error: cancelError } = await admin.from('identity_verification_subscriptions')
            .update({ status: 'cancelled' }).eq('id', pending.id).eq('status', 'payment_pending');
          if (cancelError) throw cancelError;
        } else {
          const tokenResponse = await fedapayRequest(`/transactions/${encodeURIComponent(pending.fedapay_transaction_id)}/token`, {
            method: 'POST', body: JSON.stringify({}),
          });
          const token = getFedaPayEntity(tokenResponse) ?? tokenResponse;
          const checkoutUrl = typeof token.url === 'string' ? token.url : '';
          const parsed = new URL(checkoutUrl);
          if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.fedapay.com')) {
            return json({ checkout_url: parsed.toString(), subscription_id: pending.id });
          }
        }
      }

      let subscriptionId = pending?.fedapay_transaction_id ? '' : (pending?.id ?? '');
      let paymentReference = pending?.fedapay_transaction_id ? '' : (pending?.fedapay_reference ?? '');
      if (!subscriptionId) {
        const { data: subscription, error: insertError } = await admin.from('identity_verification_subscriptions')
          .insert({
            user_id: user.id,
            plan_id: plan.id,
            amount_xof: plan.amount_xof,
            currency: 'XOF',
            status: 'payment_pending',
            fedapay_reference: `identity_${crypto.randomUUID()}`,
          })
          .select('id,fedapay_reference')
          .single();
        if (insertError) throw insertError;
        subscriptionId = subscription.id;
        paymentReference = subscription.fedapay_reference;
      }

      const publicUrl = new URL(appUrl);
      if (publicUrl.protocol !== 'https:' && publicUrl.hostname !== 'localhost') {
        throw new Error('AFRIXA_PUBLIC_URL must use HTTPS');
      }
      const callback = new URL('/identity-verification', publicUrl);
      callback.searchParams.set('payment', 'return');
      callback.searchParams.set('subscription_id', subscriptionId);
      const userMetadata = user.user_metadata ?? {};
      const country = typeof userMetadata.country === 'string' && /^[A-Za-z]{2}$/.test(userMetadata.country)
        ? userMetadata.country.toUpperCase() : 'BJ';

      const created = await fedapayRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Afrixa - Abonnement Identité vérifiée (12 mois)',
          amount: plan.amount_xof,
          currency: { iso: 'XOF' },
          callback_url: callback.toString(),
          customer: {
            firstname: firstName,
            lastname: lastName,
            email: user.email,
            phone_number: { number: phone, country },
          },
          custom_metadata: {
            purpose: 'identity_verification',
            user_id: user.id,
            subscription_id: subscriptionId,
            payment_reference: paymentReference,
          },
        }),
      });
      const transaction = getFedaPayEntity(created);
      const transactionId = String(transaction?.id ?? '');
      if (!/^\d{1,32}$/.test(transactionId)) throw new Error('Invalid FedaPay transaction id');

      const { error: saveError } = await admin.from('identity_verification_subscriptions')
        .update({ fedapay_transaction_id: transactionId })
        .eq('id', subscriptionId).eq('status', 'payment_pending');
      if (saveError) throw saveError;

      const tokenResponse = await fedapayRequest(`/transactions/${encodeURIComponent(transactionId)}/token`, {
        method: 'POST', body: JSON.stringify({}),
      });
      const token = getFedaPayEntity(tokenResponse) ?? tokenResponse;
      const checkoutUrl = typeof token.url === 'string' ? token.url : '';
      const parsed = new URL(checkoutUrl);
      if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.fedapay.com')) {
        throw new Error('Invalid FedaPay checkout host');
      }
      return json({ checkout_url: parsed.toString(), subscription_id: subscriptionId });
    }

    if (action === 'verify_payment') {
      const subscriptionId = String(body?.subscription_id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) return json({ error: 'invalid_subscription' }, 400);
      const { data: subscription, error: subError } = await admin.from('identity_verification_subscriptions')
        .select('id,user_id,amount_xof,currency,status,fedapay_transaction_id,plan_id')
        .eq('id', subscriptionId).eq('user_id', user.id).maybeSingle();
      if (subError) throw subError;
      if (!subscription) return json({ error: 'subscription_not_found' }, 404);
      if (subscription.status === 'active') return json({ verified: true, status: 'active' });
      if (subscription.status !== 'payment_pending' || !subscription.fedapay_transaction_id) {
        return json({ error: 'payment_not_verifiable' }, 409);
      }

      const response = await fedapayRequest(`/transactions/${encodeURIComponent(subscription.fedapay_transaction_id)}`);
      const payment = getFedaPayEntity(response);
      const metadata = payment?.custom_metadata && typeof payment.custom_metadata === 'object'
        ? payment.custom_metadata as Record<string, unknown> : {};
      const valid = String(payment?.id) === subscription.fedapay_transaction_id
        && String(payment?.status ?? '').toLowerCase() === 'approved'
        && Number(payment?.amount) === Number(subscription.amount_xof)
        && currencyIso(payment?.currency) === subscription.currency
        && metadata.subscription_id === subscription.id
        && metadata.user_id === user.id
        && metadata.purpose === 'identity_verification';
      if (!valid) {
        return json({ verified: false, status: String(payment?.status ?? 'unknown').toLowerCase() });
      }

      const now = new Date();
      const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const { data: activated, error: activateError } = await admin.from('identity_verification_subscriptions')
        .update({
          status: 'active',
          starts_at: now.toISOString(),
          expires_at: expires.toISOString(),
          paid_at: now.toISOString(),
        })
        .eq('id', subscription.id).eq('status', 'payment_pending')
        .select('id,status,expires_at').maybeSingle();
      if (activateError) throw activateError;
      if (!activated) {
        const { data: current } = await admin.from('identity_verification_subscriptions')
          .select('status,expires_at').eq('id', subscription.id).single();
        if (current?.status !== 'active') return json({ error: 'payment_state_changed' }, 409);
        return json({ verified: true, status: 'active', expires_at: current.expires_at });
      }
      return json({ verified: true, status: 'active', expires_at: activated.expires_at });
    }

    if (action === 'submit_request') {
      const subscriptionId = String(body?.subscription_id ?? '');
      const legalName = String(body?.legal_name ?? '').trim();
      const documentType = String(body?.document_type ?? '');
      const country = String(body?.issuing_country ?? '').toUpperCase();
      const documentPath = String(body?.document_path ?? '');
      const note = typeof body?.applicant_note === 'string' ? body.applicant_note.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)
        || legalName.length < 3 || legalName.length > 160
        || !['national_id', 'passport', 'residence_permit'].includes(documentType)
        || !/^[A-Z]{2}$/.test(country)
        || !documentPath.startsWith(`${user.id}/`)
        || !/\.(pdf|png|jpe?g)$/i.test(documentPath)
        || note.length > 1000) {
        return json({ error: 'invalid_application' }, 400);
      }

      const { data: subscription, error: subError } = await admin.from('identity_verification_subscriptions')
        .select('id,status,expires_at').eq('id', subscriptionId).eq('user_id', user.id).maybeSingle();
      if (subError) throw subError;
      if (!subscription || subscription.status !== 'active' || new Date(subscription.expires_at) <= new Date()) {
        return json({ error: 'active_subscription_required' }, 403);
      }

      const { data: openRequest } = await admin.from('identity_verification_requests')
        .select('id,status').eq('user_id', user.id)
        .in('status', ['submitted', 'under_review', 'needs_information']).limit(1).maybeSingle();

      const { data: uploadedDocument, error: storageError } = await admin.storage.from(BUCKET).download(documentPath);
      if (storageError || !uploadedDocument) return json({ error: 'document_not_found' }, 400);
      const documentBytes = new Uint8Array(await uploadedDocument.arrayBuffer());
      const startsWith = (signature: number[]) => signature.every((value, index) => documentBytes[index] === value);
      const extension = documentPath.split('.').pop()?.toLowerCase();
      const validPdf = extension === 'pdf' && new TextDecoder().decode(documentBytes.slice(0, 5)) === '%PDF-';
      const validJpeg = ['jpg', 'jpeg'].includes(extension ?? '') && startsWith([0xff, 0xd8, 0xff]);
      const validPng = extension === 'png' && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (documentBytes.byteLength === 0 || documentBytes.byteLength > 10 * 1024 * 1024
        || !(validPdf || validJpeg || validPng)) {
        return json({ error: 'document_type_or_size_invalid' }, 400);
      }

      if (openRequest?.status === 'needs_information') {
        const { data: updated, error: updateError } = await admin.from('identity_verification_requests')
          .update({
            subscription_id: subscriptionId,
            legal_name: legalName,
            document_type: documentType,
            issuing_country: country,
            document_path: documentPath,
            applicant_note: note || null,
            status: 'submitted',
            decision_reason: null,
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
            reviewed_by: null,
          })
          .eq('id', openRequest.id).eq('user_id', user.id)
          .select('id,status').single();
        if (updateError) throw updateError;
        return json({ request: updated, resubmitted: true });
      }
      if (openRequest) return json({ error: 'request_already_open' }, 409);

      const { data: request, error: insertError } = await admin.from('identity_verification_requests')
        .insert({
          user_id: user.id,
          subscription_id: subscriptionId,
          legal_name: legalName,
          document_type: documentType,
          issuing_country: country,
          document_path: documentPath,
          applicant_note: note || null,
          status: 'submitted',
        })
        .select('id,status').single();
      if (insertError) throw insertError;
      return json({ request });
    }

    if (action === 'review_queue' || action === 'review_decide' || action === 'review_document') {
      const { data: reviewer, error: reviewerError } = await admin.from('identity_verification_reviewers')
        .select('user_id,role').eq('user_id', user.id).eq('active', true).maybeSingle();
      if (reviewerError) throw reviewerError;
      if (!reviewer) return json({ error: 'reviewer_access_required' }, 403);

      if (action === 'review_queue') {
        const status = typeof body?.status === 'string' ? body.status : 'submitted';
        const allowedStatuses = ['submitted', 'under_review', 'needs_information', 'approved', 'rejected', 'revoked'];
        if (!allowedStatuses.includes(status)) return json({ error: 'invalid_status' }, 400);
        const { data: rows, error: rowsError } = await admin.from('identity_verification_requests')
          .select('id,user_id,subscription_id,status,legal_name,document_type,issuing_country,applicant_note,decision_reason,submitted_at,created_at')
          .eq('status', status).order('submitted_at', { ascending: true }).limit(100);
        if (rowsError) throw rowsError;
        return json({ requests: rows ?? [], reviewer_role: reviewer.role });
      }

      if (action === 'review_document') {
        const requestId = String(body?.request_id ?? '');
        const { data: row, error: rowError } = await admin.from('identity_verification_requests')
          .select('id,document_path').eq('id', requestId).maybeSingle();
        if (rowError) throw rowError;
        if (!row) return json({ error: 'request_not_found' }, 404);
        const { data: signed, error: signedError } = await admin.storage.from(BUCKET)
          .createSignedUrl(row.document_path, 120);
        if (signedError) throw signedError;
        await admin.from('identity_verification_reviews').insert({
          request_id: row.id, reviewer_id: user.id, action: 'document_viewed',
        });
        return json({ document_url: signed?.signedUrl ?? null });
      }

      const requestId = String(body?.request_id ?? '');
      const decision = String(body?.decision ?? '');
      const reason = String(body?.reason ?? '').trim();
      const note = typeof body?.internal_note === 'string' ? body.internal_note.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(requestId)
        || !['under_review', 'needs_information', 'approved', 'rejected', 'revoked'].includes(decision)
        || (['needs_information', 'rejected', 'revoked'].includes(decision) && reason.length < 3)
        || reason.length > 1000 || note.length > 2000) {
        return json({ error: 'invalid_review_decision' }, 400);
      }
      if (decision === 'revoked' && reviewer.role !== 'supervisor') {
        return json({ error: 'supervisor_required' }, 403);
      }
      const { data: request, error: requestError } = await admin.from('identity_verification_requests')
        .select('id,user_id,subscription_id,status').eq('id', requestId).maybeSingle();
      if (requestError) throw requestError;
      if (!request) return json({ error: 'request_not_found' }, 404);
      if (['approved', 'rejected', 'revoked'].includes(request.status)
        && !(decision === 'revoked' && request.status === 'approved' && reviewer.role === 'supervisor')) {
        return json({ error: 'request_already_closed' }, 409);
      }
      const { data: updated, error: decisionError } = await admin.rpc('apply_identity_verification_decision', {
        p_request_id: request.id,
        p_decision: decision,
        p_reason: reason || null,
        p_internal_note: note || null,
        p_reviewer_id: user.id,
      });
      if (decisionError) throw decisionError;
      return json({ request: updated });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('Identity verification request failed', error);
    return json({ error: 'identity_verification_failed' }, 500);
  }
});
