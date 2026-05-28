/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Challenge } from '@/components/creators/ChallengeCard';

export const useChallenge = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await (supabase as any)
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setChallenges(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les challenges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { challenges, loading, error, retry: load };
};
