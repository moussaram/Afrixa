/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const client = supabase as any;
const HEARTBEAT_MS = 45_000;

export interface LiveCounters {
  viewersCount: number;
  peakViewers: number;
  likesCount: number;
  commentsCount: number;
}

const EMPTY_COUNTERS: LiveCounters = {
  viewersCount: 0,
  peakViewers: 0,
  likesCount: 0,
  commentsCount: 0,
};

/**
 * Présence réelle d'un live : le spectateur rejoint la session et envoie un
 * battement régulier. Les compteurs viennent de live_sessions, maintenus par
 * les RPC et les triggers, puis rafraîchis en Realtime.
 */
export function useLivePresence(
  sessionId: string | undefined,
  userId: string | undefined,
  mode: 'host' | 'viewer',
) {
  const [counters, setCounters] = useState<LiveCounters>(EMPTY_COUNTERS);
  const [isCoHost, setIsCoHost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const { data, error: countersError } = await client
      .from('live_sessions')
      .select('viewers_count,peak_viewers,likes_count,comments_count')
      .eq('id', sessionId)
      .maybeSingle();
    if (countersError) {
      console.error('Unable to load live counters', countersError);
      setError(countersError.message);
      return;
    }
    if (data) {
      setCounters({
        viewersCount: data.viewers_count ?? 0,
        peakViewers: data.peak_viewers ?? 0,
        likesCount: data.likes_count ?? 0,
        commentsCount: data.comments_count ?? 0,
      });
      setError(null);
    }
  }, [sessionId]);

  // Rôle co-animateur (rechargeable si le créateur invite en cours de live).
  useEffect(() => {
    if (!sessionId || !userId) {
      setIsCoHost(false);
      return;
    }
    let active = true;
    const check = async () => {
      const { data } = await client
        .from('live_cohosts')
        .select('status')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (active) setIsCoHost(data?.status === 'accepted');
    };
    void check();
    const interval = window.setInterval(check, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [sessionId, userId]);

  // Présence : rejoindre, battre, quitter.
  useEffect(() => {
    if (!sessionId || !userId || mode !== 'viewer') return;
    let active = true;

    const beat = async () => {
      const { data, error: joinError } = await client.rpc('join_live', { p_session_id: sessionId });
      if (!active) return;
      if (joinError) {
        setError(joinError.message);
        return;
      }
      if (typeof data === 'number') {
        setCounters((previous) => ({ ...previous, viewersCount: data }));
      }
      void refresh();
    };

    void beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);

    const channel = supabase
      .channel(`live-counters:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as {
            viewers_count: number;
            peak_viewers: number;
            likes_count: number;
            comments_count: number;
          };
          setCounters({
            viewersCount: row.viewers_count ?? 0,
            peakViewers: row.peak_viewers ?? 0,
            likesCount: row.likes_count ?? 0,
            commentsCount: row.comments_count ?? 0,
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
      void client.rpc('leave_live', { p_session_id: sessionId });
    };
  }, [mode, refresh, sessionId, userId]);

  // L'hôte suit les compteurs et les mises à jour Realtime.
  useEffect(() => {
    if (!sessionId || mode !== 'host') return;
    void refresh();
    const channel = supabase
      .channel(`live-host-counters:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${sessionId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, refresh, sessionId]);

  return { counters, isCoHost, error, refresh };
}
