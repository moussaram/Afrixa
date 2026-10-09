export type FedaPayObject = Record<string, unknown>;

const getApiBaseUrl = () => {
  const configured = Deno.env.get('FEDAPAY_API_BASE_URL');
  if (!configured) throw new Error('FedaPay API environment is not configured');
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid FedaPay API base URL');
  }
  return `${url.origin}/v1`;
};

export const fedapayRequest = async (
  path: string,
  init: RequestInit = {},
): Promise<FedaPayObject> => {
  const secret = Deno.env.get('FEDAPAY_SECRET_KEY');
  if (!secret) throw new Error('FedaPay secret is not configured');
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== 'object') {
    console.error('FedaPay API request failed', { path, status: response.status });
    throw new Error('FedaPay API request failed');
  }
  return result as FedaPayObject;
};

export const getFedaPayEntity = (response: FedaPayObject): FedaPayObject | null => {
  const data = response.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data as FedaPayObject;
  const versionedEntity = Object.values(response).find((value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      && ('id' in value || 'url' in value || 'status' in value)
  );
  if (versionedEntity && typeof versionedEntity === 'object') return versionedEntity as FedaPayObject;
  return null;
};

export const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
};

export const verifyFedaPaySignature = async (
  rawBody: string,
  signatureHeader: string | null,
  endpointSecret: string,
): Promise<boolean> => {
  if (!signatureHeader || !endpointSecret) return false;
  const parts = new Map(signatureHeader.split(',').map((item) => {
    const separator = item.indexOf('=');
    return separator < 0
      ? ['', '']
      : [item.slice(0, separator).trim(), item.slice(separator + 1).trim()];
  }));
  const timestamp = parts.get('t');
  const signature = parts.get('s');
  if (!timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[a-f\d]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(endpointSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  const supplied = new Uint8Array(signature.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)));
  return constantTimeEqual(digest, supplied);
};
