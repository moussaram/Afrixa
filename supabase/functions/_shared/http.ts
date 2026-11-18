export interface ResilientFetchOptions {
  /** Total attempts. Retries are disabled unless retryable is explicitly true. */
  attempts?: number;
  timeoutMs?: number;
  retryable?: boolean;
  retryStatuses?: number[];
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryDelay = (response: Response | null, attempt: number): number => {
  const retryAfter = response?.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 3000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 3000));
  }
  return Math.min(250 * (2 ** attempt), 1500);
};

/**
 * Bounded fetch for server-side provider calls.
 * Retries are opt-in because repeating POST/DELETE can create duplicate side effects.
 * Callers must explicitly mark a POST retryable only when the provider operation is read-only.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 1, 3));
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? 15000, 30000));
  const canRetry = options.retryable === true && attempts > 1;
  const retryStatuses = new Set(options.retryStatuses ?? DEFAULT_RETRY_STATUSES);
  const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (canRetry && !['GET', 'HEAD', 'OPTIONS'].includes(method) && options.retryable !== true) {
    throw new Error('Retries are not enabled for this HTTP method');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < (canRetry ? attempts : 1); attempt += 1) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromCaller();
    else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!canRetry || !retryStatuses.has(response.status) || attempt === attempts - 1) return response;
      await response.body?.cancel().catch(() => undefined);
      await wait(retryDelay(response, attempt));
    } catch (error) {
      lastError = error;
      if (!canRetry || externalSignal?.aborted || attempt === attempts - 1) throw error;
      await wait(retryDelay(null, attempt));
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Provider request failed');
}
