const json = (body: unknown) => JSON.stringify(body);

export async function cloudflareStreamRequest(path: string, init: RequestInit = {}) {
  const accountId = Deno.env.get('CF_STREAM_ACCOUNT_ID');
  const apiToken = Deno.env.get('CF_STREAM_API_TOKEN');
  if (!accountId || !apiToken) throw new Error('Cloudflare Stream server configuration is missing');
  if (path !== '' && !/^[/?a-zA-Z0-9/_=&-]+$/.test(path)) throw new Error('Invalid Cloudflare Stream path');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream${path}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      },
    );
    const body = await response.text();
    let parsed: unknown;
    try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = {}; }
    if (!response.ok || (parsed && typeof parsed === 'object' && 'success' in parsed && parsed.success === false)) {
      console.error('Cloudflare Stream API request failed', { status: response.status });
      throw new Error(`Cloudflare Stream API returned ${response.status}`);
    }
    return { response, body: parsed as Record<string, unknown> };
  } finally {
    clearTimeout(timeout);
  }
}

export const encodeTusMetadata = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const videoUidPattern = /^[a-f0-9]{32}$/i;
