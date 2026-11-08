import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

interface CloudflarePlaybackAssets {
  playbackUrl: string;
  thumbnailUrl: string;
  expiresAt: number;
}

const playbackCache = new Map<string, CloudflarePlaybackAssets>();
const playbackRequests = new Map<string, Promise<CloudflarePlaybackAssets>>();

const getPlaybackAssets = async (videoId: string, cacheKey: string): Promise<CloudflarePlaybackAssets> => {
  const cached = playbackCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;

  const pending = playbackRequests.get(cacheKey);
  if (pending) return pending;

  const request = supabase.functions.invoke('get-cloudflare-playback-token', {
    body: { video_id: videoId },
  }).then(({ data, error }) => {
    if (error) throw error;
    const playbackUrl = typeof data?.playback_url === 'string' ? data.playback_url : '';
    const thumbnailUrl = typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : '';
    const expiresAt = typeof data?.expires_at === 'string' ? Date.parse(data.expires_at) : NaN;
    if (!playbackUrl || !thumbnailUrl || !Number.isFinite(expiresAt)) {
      throw new Error('Cloudflare playback response is invalid');
    }
    const assets = { playbackUrl, thumbnailUrl, expiresAt };
    playbackCache.set(cacheKey, assets);
    return assets;
  }).finally(() => {
    playbackRequests.delete(cacheKey);
  });

  playbackRequests.set(cacheKey, request);
  return request;
};

export const useCloudflarePlaybackAssets = (videoId: string, enabled = true) => {
  const { user } = useAuth();
  const cacheKey = `${user?.id ?? 'anonymous'}:${videoId}`;
  const [assetState, setAssetState] = useState<{ cacheKey: string; assets: CloudflarePlaybackAssets } | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled || !videoId) {
      setAssetState(null);
      setError(false);
      return;
    }

    let active = true;
    let refreshTimer: number | undefined;

    const applyAssets = (nextAssets: CloudflarePlaybackAssets) => {
      if (!active) return;
      setAssetState({ cacheKey, assets: nextAssets });
      setError(false);
      const refreshDelay = Math.max(1_000, nextAssets.expiresAt - Date.now() - 60_000);
      refreshTimer = window.setTimeout(() => {
        playbackCache.delete(cacheKey);
        setRefreshKey(value => value + 1);
      }, refreshDelay);
    };

    setError(false);
    void getPlaybackAssets(videoId, cacheKey)
      .then(applyAssets)
      .catch(() => {
        if (active) {
          setAssetState(null);
          setError(true);
        }
      });

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [videoId, enabled, refreshKey, cacheKey]);

  return {
    playbackUrl: assetState?.cacheKey === cacheKey ? assetState.assets.playbackUrl : null,
    thumbnailUrl: assetState?.cacheKey === cacheKey ? assetState.assets.thumbnailUrl : null,
    loading: enabled && assetState?.cacheKey !== cacheKey && !error,
    error,
  };
};
