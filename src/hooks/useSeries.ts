/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { CreatorSeries } from '@/components/creators/SeriesCard';

export const useSeries = () => {
  const { user } = useAuth();
  const [series, setSeries] = useState<CreatorSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await (supabase as any)
        .from('series')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSeries(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les séries.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { series, loading, error, retry: load };
};
