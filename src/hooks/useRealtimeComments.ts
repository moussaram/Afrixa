/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { commentSchema } from '@/lib/validation';
import { reportContent } from '@/lib/security';

export interface RealtimeComment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  replies_count: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_liked: boolean;
  replies: RealtimeComment[];
}

interface RawComment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  replies_count: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMMENTS_COLUMNS =
  'id,video_id,user_id,parent_id,content,likes_count,replies_count,is_pinned,is_deleted,created_at';

export const useRealtimeComments = (videoId: string, userId?: string) => {
  const [comments, setComments] = useState<RealtimeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!uuidPattern.test(videoId)) {
      setComments([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const offset = reset ? 0 : offsetRef.current;
      const client = supabase as any;
      const { data, error: pageError } = await client
        .from('comments')
        .select(COMMENTS_COLUMNS)
        .eq('video_id', videoId)
        .is('parent_id', null)
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (pageError) throw pageError;

      const topLevel = (data ?? []) as RawComment[];
      const parentIds = topLevel.map((comment) => comment.id);

      const { data: replyData, error: replyError } = parentIds.length
        ? await client
            .from('comments')
            .select(COMMENTS_COLUMNS)
            .in('parent_id', parentIds)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true })
        : { data: [], error: null };
      if (replyError) throw replyError;

      const all = [...topLevel, ...((replyData ?? []) as RawComment[])];
      const authorIds = [...new Set(all.map((comment) => comment.user_id))];
      const commentIds = all.map((comment) => comment.id);

      const [{ data: profiles, error: profileError }, { data: likes, error: likeError }] = await Promise.all([
        authorIds.length
          ? client.from('public_profiles').select('user_id,username,prenom,nom,avatar_url').in('user_id', authorIds)
          : Promise.resolve({ data: [], error: null }),
        userId && commentIds.length
          ? client.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', commentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileError) throw profileError;
      if (likeError) throw likeError;

      const profilesByUser = new Map<string, { username: string | null; prenom: string | null; nom: string | null; avatar_url: string | null }>(
        (profiles ?? []).map((profile: any) => [profile.user_id, profile]),
      );
      const likedIds = new Set(((likes ?? []) as { comment_id: string }[]).map((like) => like.comment_id));

      const toComment = (row: RawComment): RealtimeComment => {
        const profile = profilesByUser.get(row.user_id);
        return {
          ...row,
          username: profile?.username || 'utilisateur',
          display_name: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.username || 'Utilisateur',
          avatar_url: profile?.avatar_url ?? null,
          is_liked: likedIds.has(row.id),
          replies: [],
        };
      };

      const mappedTop = topLevel.map(toComment);
      const byId = new Map(mappedTop.map((comment) => [comment.id, comment]));
      for (const row of (replyData ?? []) as RawComment[]) {
        if (!row.parent_id) continue;
        const parent = byId.get(row.parent_id);
        if (parent) parent.replies.push(toComment(row));
      }

      setComments((previous) => (reset ? mappedTop : [...previous, ...mappedTop]));
      offsetRef.current = offset + topLevel.length;
      setHasMore(topLevel.length === PAGE_SIZE);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les commentaires');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      busyRef.current = false;
    }
  }, [userId, videoId]);

  useEffect(() => {
    if (!uuidPattern.test(videoId)) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchPage(true);

    const channel = supabase
      .channel(`comments:${videoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `video_id=eq.${videoId}` },
        () => { void fetchPage(true); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPage, videoId]);

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!userId) throw new Error('Connexion requise pour commenter');
    const parsed = commentSchema.parse({ content });
    const { error: insertError } = await (supabase as any).from('comments').insert({
      video_id: videoId,
      user_id: userId,
      parent_id: parentId ?? null,
      content: parsed.content,
    });
    if (insertError) throw insertError;
    await fetchPage(true);
  }, [fetchPage, userId, videoId]);

  const toggleLike = useCallback(async (commentId: string) => {
    if (!userId) throw new Error('Connexion requise');

    const updateLocal = (delta: number) =>
      setComments((previous) =>
        previous.map((comment) => {
          if (comment.id === commentId) {
            const liked = delta > 0;
            return { ...comment, is_liked: liked, likes_count: Math.max(0, comment.likes_count + delta) };
          }
          return {
            ...comment,
            replies: comment.replies.map((reply) =>
              reply.id === commentId
                ? { ...reply, is_liked: delta > 0, likes_count: Math.max(0, reply.likes_count + delta) }
                : reply,
            ),
          };
        }),
      );

    const current = comments.find((comment) => comment.id === commentId)
      ?? comments.flatMap((comment) => comment.replies).find((reply) => reply.id === commentId);
    const nextLiked = !(current?.is_liked ?? false);
    updateLocal(nextLiked ? 1 : -1);

    const client = supabase as any;
    const { error: requestError } = nextLiked
      ? await client.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
      : await client.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);

    if (requestError) {
      updateLocal(nextLiked ? -1 : 1);
      throw requestError;
    }
  }, [comments, userId]);

  const deleteComment = useCallback(async (commentId: string) => {
    const { error: updateError } = await (supabase as any)
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId);
    if (updateError) throw updateError;
    await fetchPage(true);
  }, [fetchPage]);

  const pinComment = useCallback(async (commentId: string, pinned: boolean) => {
    const { error: updateError } = await (supabase as any)
      .from('comments')
      .update({ is_pinned: pinned })
      .eq('id', commentId);
    if (updateError) throw updateError;
    await fetchPage(true);
  }, [fetchPage]);

  const reportComment = useCallback(async (commentId: string, reason = 'Signalement utilisateur') => {
    if (!userId) throw new Error('Connexion requise');
    await reportContent({ reporterId: userId, contentType: 'comment', contentId: commentId, reason });
  }, [userId]);

  return {
    comments,
    loading,
    loadingMore,
    hasMore,
    error,
    addComment,
    toggleLike,
    deleteComment,
    pinComment,
    reportComment,
    loadMore: () => fetchPage(false),
    reload: () => fetchPage(true),
  };
};
