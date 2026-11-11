/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from '@/types';
import { mapVideoRow, type VideoRow } from '@/lib/videoMapper';

const client = supabase as any;

/** Vidéos d'un profil : la RLS ne renvoie que ce que le lecteur peut voir. */
export const useProfileVideos = (userId?: string) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setVideos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: videosError } = await client
      .from('videos')
      .select(
        'id,user_id,hls_url,thumbnail_url,description,title,likes_count,comments_count,shares_count,saves_count,views_count,created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60);

    if (videosError) {
      console.error('Unable to load profile videos', videosError);
      setError(videosError.message);
      setVideos([]);
    } else {
      const rows = (data ?? []) as VideoRow[];
      setVideos(rows.map((row) => mapVideoRow(row)));
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { videos, loading, error, reload: load };
};
