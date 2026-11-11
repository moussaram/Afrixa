/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from '@/types';

interface VideoRow {
  id: string;
  user_id: string;
  hls_url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  title: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

const EMPTY_PROFILE: ProfileRow = {
  user_id: '',
  username: null,
  prenom: null,
  nom: null,
  avatar_url: null,
};

const toVideo = (row: VideoRow, profile: ProfileRow, flags: { isLiked: boolean; isSaved: boolean }): Video => {
  const username = profile.username || 'utilisateur';
  return {
    id: row.id,
    user: {
      id: row.user_id,
      username,
      displayName: [profile.prenom, profile.nom].filter(Boolean).join(' ') || username,
      avatar: profile.avatar_url ?? '',
      followers: 0,
      following: 0,
      likes: 0,
      isFollowing: false,
      isVerified: false,
    },
    videoUrl: row.hls_url ?? '',
    thumbnailUrl: row.thumbnail_url ?? '',
    description: row.description ?? row.title ?? '',
    hashtags: [],
    music: { title: 'Son original', artist: username, coverUrl: '' },
    likes: row.likes_count,
    comments: row.comments_count,
    shares: row.shares_count,
    saves: row.saves_count,
    views: row.views_count,
    isLiked: flags.isLiked,
    isSaved: flags.isSaved,
    createdAt: row.created_at,
  };
};

/**
 * Collections réelles du profil : vidéos aimées et enregistrées.
 * Les vidéos non visibles (privées / supprimées) sont filtrées par la RLS.
 */
export const useProfileVideoCollections = (userId?: string) => {
  const client = supabase as any;
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
        .from('profiles')
        .select('user_id,username,prenom,nom,avatar_url')
        .in('user_id', ownerIds);
      if (profileError) throw profileError;

      const profilesByUser = new Map(((profileRows ?? []) as ProfileRow[]).map((row) => [row.user_id, row]));
      const rowsById = new Map(rows.map((row) => [row.id, row]));

      const build = (ids: string[], flags: { isLiked: boolean; isSaved: boolean }) =>
        ids
          .map((id) => {
            const row = rowsById.get(id);
            if (!row) return null;
            return toVideo(row, profilesByUser.get(row.user_id) ?? EMPTY_PROFILE, flags);
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
  }, [client, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { likedVideos, savedVideos, loading, error, reload: load };
};
