import { useState, useCallback, useEffect } from 'react';
import { Video } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function useSocialInteractions(video: Video) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(video.isLiked ?? false);
  const [isSaved, setIsSaved] = useState(video.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saveCount, setSaveCount] = useState(video.saves);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !isUuid(video.id)) return;
    let active = true;
    const load = async () => {
      const client = supabase as any;
      const [{ data: like }, { data: save }] = await Promise.all([
        client.from('video_likes').select('video_id').eq('video_id', video.id).eq('user_id', user.id).maybeSingle(),
        client.from('video_saves').select('video_id').eq('video_id', video.id).eq('user_id', user.id).maybeSingle(),
      ]);
      if (active) {
        setIsLiked(!!like);
        setIsSaved(!!save);
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.id, video.id]);

  const toggleLike = useCallback(async () => {
    if (!user?.id || !isUuid(video.id) || isLikeLoading) return;
    setIsLikeLoading(true);
    const previous = isLiked;
    setIsLiked(!previous);
    setLikeCount(count => Math.max(0, count + (previous ? -1 : 1)));
    try {
      const client = supabase as any;
      const result = previous
        ? await client.from('video_likes').delete().eq('video_id', video.id).eq('user_id', user.id)
        : await client.from('video_likes').insert({ video_id: video.id, user_id: user.id });
      if (result.error) throw result.error;
    } catch (error) {
      setIsLiked(previous);
      setLikeCount(count => Math.max(0, count + (previous ? 1 : -1)));
      console.error('Unable to update video like', error);
    } finally {
      setIsLikeLoading(false);
    }
  }, [user?.id, video.id, isLiked, isLikeLoading]);

  const toggleSave = useCallback(async () => {
    if (!user?.id || !isUuid(video.id) || isSaveLoading) return;
    setIsSaveLoading(true);
    const previous = isSaved;
    setIsSaved(!previous);
    setSaveCount(count => Math.max(0, count + (previous ? -1 : 1)));
    try {
      const client = supabase as any;
      const result = previous
        ? await client.from('video_saves').delete().eq('video_id', video.id).eq('user_id', user.id)
        : await client.from('video_saves').insert({ video_id: video.id, user_id: user.id });
      if (result.error) throw result.error;
    } catch (error) {
      setIsSaved(previous);
      setSaveCount(count => Math.max(0, count + (previous ? 1 : -1)));
      console.error('Unable to update video save', error);
    } finally {
      setIsSaveLoading(false);
    }
  }, [user?.id, video.id, isSaved, isSaveLoading]);

  return { isLiked, isSaved, likeCount, saveCount, isLikeLoading, isSaveLoading, toggleLike, toggleSave };
}

export function useFollow(initialFollowing: boolean, targetUserId: string, currentUserId: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !isUuid(targetUserId) || targetUserId === user.id) {
      setIsFollowing(false);
      return;
    }
    let active = true;
    (supabase as any).from('follows').select('follower_id')
      .eq('follower_id', user.id).eq('following_id', targetUserId).maybeSingle()
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (!error && active) setIsFollowing(!!data);
      });
    return () => { active = false; };
  }, [user?.id, targetUserId]);

  const toggle = useCallback(async () => {
    const actorId = user?.id || currentUserId;
    if (!user?.id || !isUuid(actorId) || !isUuid(targetUserId) || targetUserId === actorId || isLoading) return;
    setIsLoading(true);
    const previous = isFollowing;
    setIsFollowing(!previous);
    try {
      const client = supabase as any;
      const result = previous
        ? await client.from('follows').delete().eq('follower_id', actorId).eq('following_id', targetUserId)
        : await client.from('follows').insert({ follower_id: actorId, following_id: targetUserId });
      if (result.error) throw result.error;
    } catch (error) {
      setIsFollowing(previous);
      console.error('Unable to update follow relationship', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentUserId, targetUserId, isFollowing, isLoading]);

  return { isFollowing, isLoading, toggle };
}
