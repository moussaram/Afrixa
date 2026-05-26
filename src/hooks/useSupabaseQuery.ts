import { useCallback, useEffect, useState, DependencyList } from 'react';

/**
 * Generic data-fetching hook with retry support.
 * Wraps any async function and exposes { data, loading, error, retry }.
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: DependencyList = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await queryFn();
      setData(result);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Une erreur inconnue est survenue';
      setError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, retry: execute };
}
