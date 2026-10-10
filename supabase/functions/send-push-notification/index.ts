import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const createGoogleAccessToken = async (serviceAccount: Record<string, string>) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const pem = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const der = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') {
    throw new Error(`Google OAuth token request failed (${response.status})`);
  }
  return result.access_token as string;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const webhookSecret = Deno.env.get('FCM_WEBHOOK_SECRET');
  if (!webhookSecret || req.headers.get('x-afrixa-webhook-secret') !== webhookSecret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const serviceAccountValue = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!supabaseUrl || !serviceRole || !serviceAccountValue) {
    console.error('FCM sender is missing server configuration');
    return json({ error: 'push_unavailable' }, 503);
  }

  try {
    const body = await req.json();
    const record = body?.record && typeof body.record === 'object' ? body.record : {};
    if (body?.type !== 'INSERT' || body?.table !== 'notifications' || typeof record.id !== 'string') {
      return json({ error: 'invalid_notification_event' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: notification, error: notificationError } = await admin.from('notifications')
      .select('id, user_id, title, message, is_read')
      .eq('id', record.id)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification || notification.is_read) return json({ sent: 0, ignored: true });

    const { data: installations, error: installationsError } = await admin.from('user_fcm_tokens')
      .select('id, token')
      .eq('user_id', notification.user_id)
      .eq('platform', 'web_fid')
      .limit(20);
    if (installationsError) throw installationsError;
    if (!installations?.length) return json({ sent: 0 });

    const serviceAccount = JSON.parse(serviceAccountValue) as Record<string, string>;
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || serviceAccount.project_id;
    if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ error: 'firebase_service_account_invalid' }, 503);
    }
    const accessToken = await createGoogleAccessToken(serviceAccount);

    let sent = 0;
    let failed = 0;
    for (const installation of installations) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: installation.token,
            notification: {
              title: notification.title,
              body: notification.message,
            },
            data: { url: '/notifications', notification_id: notification.id },
          },
        }),
      });
      if (response.ok) {
        sent += 1;
        continue;
      }
      const errorBody = await response.json().catch(() => ({}));
      const errorCode = errorBody?.error?.details?.[0]?.errorCode;
      if (errorCode === 'UNREGISTERED') {
        const { error: removeError } = await admin.from('user_fcm_tokens')
          .delete().eq('id', installation.id);
        if (removeError) console.error('Failed to remove expired FCM installation', removeError);
      } else {
        failed += 1;
        console.error('FCM delivery failed', { status: response.status, code: errorCode });
      }
    }
    return json({ sent, failed }, failed > 0 ? 502 : 200);
  } catch (error) {
    console.error('FCM notification delivery failed', error);
    return json({ error: 'push_delivery_failed' }, 500);
  }
});
