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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account verification review is missing server configuration');
    return json({ error: 'verification_review_unavailable' }, 503);
  }
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const reviewerId = authData.user?.id;
    if (authError || !reviewerId) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRecord, error: adminError } = await admin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', reviewerId)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!adminRecord) return json({ error: 'admin_access_required' }, 403);

    const body = await req.json();
    if (body?.action === 'list') {
      const allowedStatuses = ['pending', 'in_review', 'approved', 'rejected', 'cancelled'];
      const status = typeof body.status === 'string' && allowedStatuses.includes(body.status)
        ? body.status : null;
      let query = admin.from('account_verification_requests')
        .select('id,user_id,request_type,status,applicant_name,country_code,document_paths,business_name,business_registration_number,business_description,website_url,fee_amount_fcfa,fee_currency,payment_status,submitted_at,reviewed_at,reviewer_note,rejection_reason')
        .order('submitted_at', { ascending: true })
        .limit(100);
      if (status) query = query.eq('status', status);
      else query = query.in('status', ['pending', 'in_review']);
      const { data, error } = await query;
      if (error) throw error;

      const requests = await Promise.all((data ?? []).map(async (request) => {
        const paths = Array.isArray(request.document_paths)
          ? request.document_paths.map((item: { path?: string }) => item?.path).filter((path): path is string => typeof path === 'string')
          : [];
        const signedDocuments = await Promise.all(paths.map(async (path) => {
          const { data: signed, error: signedError } = await admin.storage
            .from('account-verification-private')
            .createSignedUrl(path, 60);
          if (signedError) {
            console.error('Unable to sign verification document', { requestId: request.id });
            return { path, url: null };
          }
          return { path, url: signed.signedUrl };
        }));
        return { ...request, signed_documents: signedDocuments };
      }));
      return json({ requests });
    }

    if (body?.action === 'review') {
      const requestId = typeof body.request_id === 'string' ? body.request_id : '';
      const decision = typeof body.decision === 'string' ? body.decision : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return json({ error: 'invalid_request_id' }, 400);
      }
      if (!['in_review', 'approved', 'rejected'].includes(decision)) {
        return json({ error: 'invalid_decision' }, 400);
      }
      const { data, error } = await admin.rpc('review_account_verification_request', {
        p_request_id: requestId,
        p_reviewer_id: reviewerId,
        p_decision: decision,
        p_note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
        p_rejection_reason: typeof body.rejection_reason === 'string' ? body.rejection_reason.slice(0, 1000) : null,
        p_waive_fee: body.waive_fee === true,
      });
      if (error) {
        const message = error.message || 'review_failed';
        return json({ error: message }, 409);
      }
      return json({ success: true, result: data });
    }

    return json({ error: 'invalid_action' }, 400);
  } catch (error) {
    console.error('Account verification review failed', error);
    return json({ error: 'verification_review_failed' }, 500);
  }
});
