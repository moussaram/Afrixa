import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CloudflarePlaybackAssets {
  playbackUrl: string;
  thumbnailUrl: string;
  expiresAt: number;
}

const playbackCache = new Map<string, CloudflarePlaybackAssets>();
const playbackRequests = new Map<string, Promise<CloudflarePlaybackAssets>>();

const getPlaybackAssets = async (videoId: string): Promise<CloudflarePlaybackAssets> => {
  const cached = playbackCache.get(videoId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;

  const pending = playbackRequests.get(videoId);
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
    playbackCache.set(videoId, assets);
    return assets;
  }).finally(() => {
    playbackRequests.delete(videoId);
  });

  playbackRequests.set(videoId, request);
  return request;
};

export const useCloudflarePlaybackAssets = (videoId: string, enabled = true) => {
  const [assets, setAssets] = useState<CloudflarePlaybackAssets | null>(null);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled || !videoId) {
      setAssets(null);
      setError(false);
      return;
    }

    let active = true;
    let refreshTimer: number | undefined;

    const applyAssets = (nextAssets: CloudflarePlaybackAssets) => {
      if (!active) return;
      setAssets(nextAssets);
      setError(false);
      const refreshDelay = Math.max(1_000, nextAssets.expiresAt - Date.now() - 60_000);
      refreshTimer = window.setTimeout(() => {
        playbackCache.delete(videoId);
        setRefreshKey(value => value + 1);
      }, refreshDelay);
    };

    setError(false);
    void getPlaybackAssets(videoId)
      .then(applyAssets)
      .catch(() => {
        if (active) {
          setAssets(null);
          setError(true);
        }
      });

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [videoId, enabled, refreshKey]);

  return {
    playbackUrl: assets?.playbackUrl ?? null,
    thumbnailUrl: assets?.thumbnailUrl ?? null,
    loading: enabled && !assets && !error,
    error,
  };
};
