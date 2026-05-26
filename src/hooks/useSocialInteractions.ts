import { useState, useCallback, useRef } from 'react';
import { Video } from '@/types';

/**
 * Centralized hook for all social interactions on a video.
 * - Optimistic updates (instant UI feedback)
 * - Debounce to prevent spam / double-click bugs
 * - Stable state that doesn't disappear on re-render
 */
export function useSocialInteractions(video: Video) {
  const [isLiked, setIsLiked] = useState(video.isLiked ?? false);
  const [isSaved, setIsSaved] = useState(video.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saveCount, setSaveCount] = useState(video.saves);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  // Debounce refs to prevent double-click spam
  const likeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleLike = useCallback(() => {
    if (isLikeLoading) return;

    // Clear any pending debounce
    if (likeTimeout.current) clearTimeout(likeTimeout.current);

    // Optimistic update immediately
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikeCount(prev => newLiked ? prev + 1 : prev - 1);
    setIsLikeLoading(true);

    // Simulate API call (replace with real fetch when backend ready)
    likeTimeout.current = setTimeout(() => {
      // In production: POST /video/{id}/like or DELETE /video/{id}/like
      // On error: rollback optimistic update
      setIsLikeLoading(false);
    }, 300);
  }, [isLiked, isLikeLoading]);

  const toggleSave = useCallback(() => {
    if (isSaveLoading) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    const newSaved = !isSaved;
    setIsSaved(newSaved);
    setSaveCount(prev => newSaved ? prev + 1 : prev - 1);
    setIsSaveLoading(true);

    saveTimeout.current = setTimeout(() => {
      // In production: POST /video/{id}/favorite or DELETE /video/{id}/favorite
      setIsSaveLoading(false);
    }, 300);
  }, [isSaved, isSaveLoading]);

  return {
    isLiked,
    isSaved,
    likeCount,
    saveCount,
    isLikeLoading,
    isSaveLoading,
    toggleLike,
    toggleSave,
  };
}

/**
 * Follow/unfollow hook with anti-self-follow guard
 */
export function useFollow(initialFollowing: boolean, targetUserId: string, currentUserId: string) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(() => {
    // Prevent following yourself
    if (targetUserId === currentUserId) return;
    if (isLoading) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const newVal = !isFollowing;
    setIsFollowing(newVal);
    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      // In production: POST /user/{id}/follow or DELETE /user/{id}/follow
      setIsLoading(false);
    }, 300);
  }, [isFollowing, isLoading, targetUserId, currentUserId]);

  return { isFollowing, isLoading, toggle };
}
