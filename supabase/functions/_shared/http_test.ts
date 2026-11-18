import { resilientFetch } from './http.ts';

Deno.test('resilientFetch does not retry a request by default', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('temporary failure', { status: 503 });
  }) as typeof fetch;

  try {
    const response = await resilientFetch('https://provider.invalid/resource');
    if (response.status !== 503) throw new Error('Expected the original provider response');
    if (calls !== 1) throw new Error(`Expected one attempt, received ${calls}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('resilientFetch retries explicitly safe transient requests', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls === 1
      ? new Response('temporarily unavailable', { status: 503 })
      : new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
  }) as typeof fetch;

  try {
    const response = await resilientFetch('https://provider.invalid/read-only', {}, {
      attempts: 2,
      timeoutMs: 5000,
      retryable: true,
    });
    if (!response.ok) throw new Error('Expected the retry to succeed');
    if (calls !== 2) throw new Error(`Expected two attempts, received ${calls}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
