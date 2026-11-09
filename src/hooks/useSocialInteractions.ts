import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Video } from '@/types';

/** Persist video likes and saves in Supabase, rolling back optimistic UI on failure. */
export function useSocialInteractions(video: Video) {
  const [isLiked, setIsLiked] = useState(video.isLiked ?? false);
  const [isSaved, setIsSaved] = useState(video.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saveCount, setSaveCount] = useState(video.saves);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUserInteractions = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      if (error || !data.user) {
        setIsLiked(false);
        setIsSaved(false);
        return;
      }
      const userId = data.user.id;
      const { data: videoCounts } = await supabase.from('videos')
        .select('likes_count,saves_count').eq('id', video.id).maybeSingle();
      if (!active) return;
      if (videoCounts) {
        setLikeCount(videoCounts.likes_count ?? video.likes);
        setSaveCount(videoCounts.saves_count ?? video.saves);
      }
      const [likeResult, saveResult] = await Promise.all([
        supabase.from('video_likes').select('video_id')
          .eq('video_id', video.id).eq('user_id', userId).maybeSingle(),
        supabase.from('video_saves').select('video_id')
          .eq('video_id', video.id).eq('user_id', userId).maybeSingle(),
      ]);
      if (!active) return;
      if (!likeResult.error) setIsLiked(Boolean(likeResult.data));
      if (!saveResult.error) setIsSaved(Boolean(saveResult.data));
    };
    void loadUserInteractions();
    return () => { active = false; };
  }, [video.id, video.likes, video.saves]);

  const toggleLike = useCallback(async () => {
    if (isLikeLoading) return;
    const { data, error: authError } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (authError || !userId) {
      toast.error('Connectez-vous pour aimer cette vidéo.');
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    setIsLikeLoading(true);
    try {
      if (nextLiked) {
        const { error } = await supabase.from('video_likes').upsert(
          { video_id: video.id, user_id: userId },
          { onConflict: 'video_id,user_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('video_likes')
          .delete().eq('video_id', video.id).eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setIsLiked(!nextLiked);
      setLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
      toast.error("Impossible d'enregistrer votre like. Réessayez.");
    } finally {
      setIsLikeLoading(false);
    }
  }, [isLikeLoading, isLiked, video.id]);

  const toggleSave = useCallback(async () => {
    if (isSaveLoading) return;
    const { data, error: authError } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (authError || !userId) {
      toast.error('Connectez-vous pour enregistrer cette vidéo.');
      return;
    }
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setSaveCount((count) => Math.max(0, count + (nextSaved ? 1 : -1)));
    setIsSaveLoading(true);
    try {
      if (nextSaved) {
        const { error } = await supabase.from('video_saves').upsert(
          { video_id: video.id, user_id: userId },
          { onConflict: 'video_id,user_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('video_saves')
          .delete().eq('video_id', video.id).eq('user_id', userId);
        if (error) throw error;
      }
    } catch {
      setIsSaved(!nextSaved);
      setSaveCount((count) => Math.max(0, count + (nextSaved ? -1 : 1)));
      toast.error("Impossible d'enregistrer ce favori. Réessayez.");
    } finally {
      setIsSaveLoading(false);
    }
  }, [isSaveLoading, isSaved, video.id]);

  return { isLiked, isSaved, likeCount, saveCount, isLikeLoading, isSaveLoading, toggleLike, toggleSave };
}

/** Persist follow/unfollow and private-account follow requests in Supabase. */
export function useFollow(
  initialFollowing: boolean,
  targetUserId: string,
  currentUserId: string,
  isPrivate = false,
  initialRequestPending = false,
) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isRequestPending, setIsRequestPending] = useState(initialRequestPending);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsFollowing(initialFollowing);
    setIsRequestPending(initialRequestPending);
  }, [initialFollowing, initialRequestPending, targetUserId]);

  const toggle = useCallback(async () => {
    if (targetUserId === currentUserId || isLoading) return;
    if (!currentUserId) {
      toast.error('Connectez-vous pour suivre ce compte.');
      return;
    }

    setIsLoading(true);
    try {
      if (isPrivate && !isFollowing) {
        if (isRequestPending) {
          const { error } = await supabase.from('follow_requests')
            .delete()
            .eq('requester_id', currentUserId)
            .eq('target_id', targetUserId)
            .eq('status', 'pending');
          if (error) throw error;
          setIsRequestPending(false);
        } else {
          const { error } = await supabase.from('follow_requests').insert({
            requester_id: currentUserId,
            target_id: targetUserId,
            status: 'pending',
          });
          if (error && error.code !== '23505') throw error;
          setIsRequestPending(true);
        }
        return;
      }

      if (isRequestPending) {
        const { error: requestError } = await supabase.from('follow_requests')
          .delete()
          .eq('requester_id', currentUserId)
          .eq('target_id', targetUserId)
          .eq('status', 'pending');
        if (requestError) throw requestError;
        setIsRequestPending(false);
      }

      if (isFollowing) {
        const { error } = await supabase.from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);
        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase.from('follows').upsert(
          { follower_id: currentUserId, following_id: targetUserId },
          { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
        );
        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Follow action failed', error);
      toast.error("Impossible de mettre à jour l'abonnement. Réessayez.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, isFollowing, isLoading, isPrivate, isRequestPending, targetUserId]);

  return { isFollowing, isRequestPending, isLoading, toggle };
}
