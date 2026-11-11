/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const client = supabase as any;

export interface LiveStatsSummary {
  viewersTotal: number;
  peakViewers: number;
  likesCount: number;
  commentsCount: number;
  durationSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
}

const EMPTY_STATS: LiveStatsSummary = {
  viewersTotal: 0,
  peakViewers: 0,
  likesCount: 0,
  commentsCount: 0,
  durationSeconds: 0,
  startedAt: null,
  endedAt: null,
};

export const useLiveStats = (sessionId?: string) => {
  const [stats, setStats] = useState<LiveStatsSummary>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) {
      setStats(EMPTY_STATS);
      setError('Session de live introuvable');
      setLoading(false);
      return;
    }

    const { data, error: statsError } = await client.rpc('get_live_stats', { p_session_id: sessionId });
    if (statsError) {
      console.error('Unable to load live stats', statsError);
      setError(statsError.message);
      setStats(EMPTY_STATS);
    } else {
      const row = (Array.isArray(data) ? data[0] : data) ?? null;
      setStats(
        row
          ? {
              viewersTotal: Number(row.viewers_total) || 0,
              peakViewers: Number(row.peak_viewers) || 0,
              likesCount: Number(row.likes_count) || 0,
              commentsCount: Number(row.comments_count) || 0,
              durationSeconds: Number(row.duration_seconds) || 0,
              startedAt: row.started_at ?? null,
              endedAt: row.ended_at ?? null,
            }
          : EMPTY_STATS,
      );
      setError(null);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, reload: load };
};
