/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const client = supabase as any;

export interface ProfileStats {
  followersCount: number;
  followingCount: number;
  videosCount: number;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  isFollowing: boolean;
}

const EMPTY_STATS: ProfileStats = {
  followersCount: 0,
  followingCount: 0,
  videosCount: 0,
  likesCount: 0,
  viewsCount: 0,
  commentsCount: 0,
  isFollowing: false,
};

interface ProfileStatsRow {
  followers_count: number;
  following_count: number;
  videos_count: number | string;
  likes_count: number | string;
  views_count: number | string;
  comments_count: number | string;
  is_following: boolean;
}

export const useProfileStats = (userId?: string) => {
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: statsError } = await client.rpc('get_profile_stats', { p_user_id: userId });
    if (statsError) {
      console.error('Unable to load profile stats', statsError);
      setError(statsError.message);
      setStats(EMPTY_STATS);
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as ProfileStatsRow | null;
      setStats(
        row
          ? {
              followersCount: Number(row.followers_count) || 0,
              followingCount: Number(row.following_count) || 0,
              videosCount: Number(row.videos_count) || 0,
              likesCount: Number(row.likes_count) || 0,
              viewsCount: Number(row.views_count) || 0,
              commentsCount: Number(row.comments_count) || 0,
              isFollowing: Boolean(row.is_following),
            }
          : EMPTY_STATS,
      );
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, loading, error, reload: load };
};
