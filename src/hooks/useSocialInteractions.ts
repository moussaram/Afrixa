/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { Video } from '@/types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Likes / favoris persistés dans video_likes et video_saves.
 * Mise à jour optimiste, rollback en cas d'erreur, compteurs synchronisés
 * par la base et rafraîchis en temps réel.
 */
export function useSocialInteractions(video: Video) {
  const { user } = useAuth();
  const client = supabase as any;
  const canPersist = uuidPattern.test(video.id) && Boolean(user) && !user!.id.startsWith('mock-');

  const [isLiked, setIsLiked] = useState(video.isLiked ?? false);
  const [isSaved, setIsSaved] = useState(video.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saveCount, setSaveCount] = useState(video.saves);
  const [shareCount, setShareCount] = useState(video.shares);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État réel de l'utilisateur et compteurs serveur.
  useEffect(() => {
    if (!canPersist) return;
    let active = true;
    void (async () => {
      const userId = user!.id;
      const [{ data: like }, { data: save }, { data: counters }] = await Promise.all([
        client.from('video_likes').select('video_id').eq('video_id', video.id).eq('user_id', userId).maybeSingle(),
        client.from('video_saves').select('video_id').eq('video_id', video.id).eq('user_id', userId).maybeSingle(),
        client.from('videos').select('likes_count, saves_count, shares_count').eq('id', video.id).maybeSingle(),
      ]);
      if (!active) return;
      setIsLiked(Boolean(like));
      setIsSaved(Boolean(save));
      if (counters) {
        setLikeCount(counters.likes_count);
        setSaveCount(counters.saves_count);
        setShareCount(counters.shares_count);
      }
    })();
    return () => { active = false; };
  }, [canPersist, client, user, video.id]);

  // Compteurs temps réel (le serveur reste la source de vérité).
  useEffect(() => {
    if (!canPersist) return;
    const channel = supabase
      .channel(`video-counters:${video.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos', filter: `id=eq.${video.id}` },
        (payload) => {
          const row = payload.new as { likes_count: number; saves_count: number; shares_count: number };
          setLikeCount(row.likes_count);
          setSaveCount(row.saves_count);
          setShareCount(row.shares_count);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [canPersist, video.id]);

  const toggleLike = useCallback(async () => {
    if (isLikeLoading) return;
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount((count) => Math.max(0, count + (next ? 1 : -1)));
    setIsLikeLoading(true);
    setError(null);

    if (!canPersist) {
      setIsLikeLoading(false);
      return;
    }

    const { error: requestError } = next
      ? await client.from('video_likes').insert({ video_id: video.id, user_id: user!.id })
      : await client.from('video_likes').delete().eq('video_id', video.id).eq('user_id', user!.id);

    if (requestError) {
      setIsLiked(!next);
      setLikeCount((count) => Math.max(0, count + (next ? -1 : 1)));
      setError(requestError.message);
    }
    setIsLikeLoading(false);
  }, [canPersist, client, isLikeLoading, isLiked, user, video.id]);

  const toggleSave = useCallback(async () => {
    if (isSaveLoading) return;
    const next = !isSaved;
    setIsSaved(next);
    setSaveCount((count) => Math.max(0, count + (next ? 1 : -1)));
    setIsSaveLoading(true);
    setError(null);

    if (!canPersist) {
      setIsSaveLoading(false);
      return;
    }

    const { error: requestError } = next
      ? await client.from('video_saves').insert({ video_id: video.id, user_id: user!.id })
      : await client.from('video_saves').delete().eq('video_id', video.id).eq('user_id', user!.id);

    if (requestError) {
      setIsSaved(!next);
      setSaveCount((count) => Math.max(0, count + (next ? -1 : 1)));
      setError(requestError.message);
    }
    setIsSaveLoading(false);
  }, [canPersist, client, isSaveLoading, isSaved, user, video.id]);

  const registerShare = useCallback(() => {
    setShareCount((count) => count + 1);
  }, []);

  return {
    isLiked,
    isSaved,
    likeCount,
    saveCount,
    shareCount,
    isLikeLoading,
    isSaveLoading,
    error,
    toggleLike,
    toggleSave,
    registerShare,
  };
}

/** Abonnement réel avec anti-self-follow et rollback. */
export function useFollow(initialFollowing: boolean, targetUserId: string, currentUserId: string) {
  const client = supabase as any;
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  // L'état initial arrive après le chargement du profil.
  useEffect(() => {
    setIsFollowing(initialFollowing);
  }, [initialFollowing]);
  const [error, setError] = useState<string | null>(null);
  const canPersist = uuidPattern.test(targetUserId) && uuidPattern.test(currentUserId);

  const toggle = useCallback(async () => {
    if (targetUserId === currentUserId || isLoading) return;
    const next = !isFollowing;
    setIsFollowing(next);
    setIsLoading(true);
    setError(null);

    if (!canPersist) {
      setIsLoading(false);
      return;
    }

    const { error: requestError } = next
      ? await client.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId })
      : await client.from('follows').delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

    if (requestError) {
      setIsFollowing(!next);
      setError(requestError.message);
    }
    setIsLoading(false);
  }, [canPersist, client, currentUserId, isFollowing, isLoading, targetUserId]);

  return { isFollowing, isLoading, error, toggle };
}
