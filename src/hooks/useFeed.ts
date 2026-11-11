/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { Video } from '@/types';
import { mapVideoRow, type VideoAuthorProfile, type VideoRow } from '@/lib/videoMapper';

export type FeedMode = 'foryou' | 'following';

const PAGE_SIZE = 8;
const client = supabase as any;

/**
 * Fil paginé servi par le RPC get_feed. Le serveur applique la visibilité,
 * les blocages et le classement ; le hook ne fait qu'empiler les pages sans
 * doublon et protéger contre les réponses hors ordre.
 */
export function useFeed(mode: FeedMode) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const requestRef = useRef(0);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!user) {
      setVideos([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (!reset && busyRef.current) return;

    const requestId = reset ? requestRef.current + 1 : requestRef.current;
    requestRef.current = requestId;
    busyRef.current = true;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = reset ? 0 : offsetRef.current;
      const { data: page, error: feedError } = await client.rpc('get_feed', {
        p_mode: mode,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (feedError) throw feedError;
      if (requestRef.current !== requestId) return;

      const rows = (page ?? []) as VideoRow[];
      const authorIds = [...new Set(rows.map((row) => row.user_id))];

      let profiles: VideoAuthorProfile[] = [];
      if (authorIds.length > 0) {
        const { data: profileRows, error: profileError } = await client
          .from('profiles')
          .select('user_id,username,prenom,nom,avatar_url')
          .in('user_id', authorIds);
        if (profileError) throw profileError;
        profiles = (profileRows ?? []) as VideoAuthorProfile[];
      }
      if (requestRef.current !== requestId) return;

      const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
      const mapped = rows.map((row) => mapVideoRow(row, profilesByUser.get(row.user_id)));

      setVideos((previous) => {
        if (reset) return mapped;
        const known = new Set(previous.map((video) => video.id));
        return [...previous, ...mapped.filter((video) => !known.has(video.id))];
      });
      offsetRef.current = offset + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      setError(null);
    } catch (feedError) {
      if (requestRef.current !== requestId) return;
      console.error('Unable to load the feed', feedError);
      setError(feedError instanceof Error ? feedError.message : 'Impossible de charger le fil');
      if (reset) {
        setVideos([]);
        setHasMore(false);
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
        setLoadingMore(false);
        busyRef.current = false;
      }
    }
  }, [mode, user]);

  useEffect(() => {
    offsetRef.current = 0;
    setHasMore(true);
    void fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(() => fetchPage(false), [fetchPage]);
  const reload = useCallback(() => fetchPage(true), [fetchPage]);

  return { videos, loading, loadingMore, error, hasMore, loadMore, reload };
}
