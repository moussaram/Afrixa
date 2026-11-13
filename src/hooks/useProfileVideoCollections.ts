/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from '@/types';
import {
  EMPTY_AUTHOR_PROFILE,
  mapVideoRow,
  type VideoAuthorProfile,
  type VideoRow,
} from '@/lib/videoMapper';

const client = supabase as any;

/**
 * Collections réelles du profil : vidéos aimées et enregistrées.
 * Les vidéos non visibles (privées / supprimées) sont filtrées par la RLS.
 */
export const useProfileVideoCollections = (userId?: string) => {
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLikedVideos([]);
      setSavedVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [{ data: likeRows, error: likeError }, { data: saveRows, error: saveError }] = await Promise.all([
        client
          .from('video_likes')
          .select('video_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(60),
        client
          .from('video_saves')
          .select('video_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(60),
      ]);
      if (likeError) throw likeError;
      if (saveError) throw saveError;

      const likedIds = ((likeRows ?? []) as { video_id: string }[]).map((row) => row.video_id);
      const savedIds = ((saveRows ?? []) as { video_id: string }[]).map((row) => row.video_id);
      const allIds = [...new Set([...likedIds, ...savedIds])];

      if (allIds.length === 0) {
        setLikedVideos([]);
        setSavedVideos([]);
        return;
      }

      const { data: videoRows, error: videoError } = await client
        .from('videos')
        .select(
          'id,user_id,hls_url,thumbnail_url,description,title,likes_count,comments_count,shares_count,saves_count,views_count,created_at',
        )
        .in('id', allIds);
      if (videoError) throw videoError;

      const rows = (videoRows ?? []) as VideoRow[];
      const ownerIds = [...new Set(rows.map((row) => row.user_id))];
      const { data: profileRows, error: profileError } = await client
        .from('public_profiles')
        .select('user_id,username,prenom,nom,avatar_url')
        .in('user_id', ownerIds);
      if (profileError) throw profileError;

      const profilesByUser = new Map(
        ((profileRows ?? []) as VideoAuthorProfile[]).map((row) => [row.user_id, row]),
      );
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      const build = (ids: string[], flags: { isLiked: boolean; isSaved: boolean }) =>
        ids
          .map((id) => {
            const row = rowsById.get(id);
            if (!row) return null;
            return mapVideoRow(row, profilesByUser.get(row.user_id) ?? EMPTY_AUTHOR_PROFILE, flags);
          })
          .filter((video): video is Video => video !== null);

      setLikedVideos(build(likedIds, { isLiked: true, isSaved: false }));
      setSavedVideos(build(savedIds, { isLiked: false, isSaved: true }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la collection');
      setLikedVideos([]);
      setSavedVideos([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { likedVideos, savedVideos, loading, error, reload: load };
};
