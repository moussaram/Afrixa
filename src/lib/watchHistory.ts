import { supabase } from '@/integrations/supabase/client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VideoWatchState = {
  videoId: string;
  lastPosition: number;
  completionRate: number;
  watchCount: number;
  completed: boolean;
};

const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> };
const rpcClient = supabase as unknown as RpcClient;

/** Enregistre la position de lecture courante. Les identifiants de demo sont ignores. */
export const recordVideoWatch = async (videoId: string, position: number, duration: number) => {
  if (!uuidPattern.test(videoId) || !Number.isFinite(position) || position < 1) return null;

  const { data, error } = await rpcClient.rpc('record_video_watch', {
    p_video_id: videoId,
    p_position: position,
    p_duration: Number.isFinite(duration) ? duration : 0,
  });

  if (error) {
    console.warn('Unable to record watch history', error);
    return null;
  }
  return data ?? null;
};

/** Etat de visionnage du compte connecte pour une liste de videos. */
export const getVideoWatchStates = async (videoIds: string[]): Promise<Map<string, VideoWatchState>> => {
  const states = new Map<string, VideoWatchState>();
  const ids = videoIds.filter((id) => uuidPattern.test(id));
  if (ids.length === 0) return states;

  const { data, error } = await rpcClient.rpc('get_watch_states', { p_video_ids: ids });
  if (error) {
    console.warn('Unable to load watch states', error);
    return states;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const videoId = typeof row.video_id === 'string' ? row.video_id : null;
    if (!videoId) continue;
    states.set(videoId, {
      videoId,
      lastPosition: number(row.last_position),
      completionRate: number(row.completion_rate),
      watchCount: number(row.watch_count),
      completed: row.completed === true,
    });
  }
  return states;
};
