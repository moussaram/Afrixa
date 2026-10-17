import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { commentSchema } from '@/lib/validation';

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
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const useRealtimeComments = (videoId: string, userId?: string) => {
  const [comments, setComments] = useState<RealtimeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isUuid(videoId)) {
      setComments([]);
      setError(null);
      setLoading(false);
      return;
    }
    // New migration tables are not present in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error: loadError } = await client
      .from('comments')
      .select('id,video_id,user_id,parent_id,content,likes_count,replies_count,is_pinned,is_deleted,created_at')
      .eq('video_id', videoId)
      .eq('is_deleted', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const commentRows = data ?? [];
    const userIds = [...new Set(commentRows.map((comment: { user_id: string }) => comment.user_id))];
    const commentIds = commentRows.map((comment: { id: string }) => comment.id);
    const [{ data: profiles }, { data: likes }] = await Promise.all([
      userIds.length
        ? client.from('profiles').select('user_id,username,prenom,nom,avatar_url').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      userId && commentIds.length
        ? client.from('comment_likes').select('comment_id').eq('user_id', userId).in('comment_id', commentIds)
        : Promise.resolve({ data: [] }),
    ]);
    const profilesByUser = new Map<string, {
      username: string | null;
      prenom: string | null;
      nom: string | null;
      avatar_url: string | null;
    }>((profiles ?? []).map((profile: {
      user_id: string;
      username: string | null;
      prenom: string | null;
      nom: string | null;
      avatar_url: string | null;
    }): [string, { username: string | null; prenom: string | null; nom: string | null; avatar_url: string | null }] => [profile.user_id, profile]));
    const likedIds = new Set((likes ?? []).map((like: { comment_id: string }) => like.comment_id));

    setComments(commentRows.map((comment: Omit<RealtimeComment, 'username' | 'display_name' | 'avatar_url' | 'is_liked'>) => {
      const profile = profilesByUser.get(comment.user_id);
      return {
        ...comment,
        username: profile?.username || 'utilisateur',
        display_name: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.username || 'Utilisateur',
        avatar_url: profile?.avatar_url ?? null,
        is_liked: likedIds.has(comment.id),
      };
    }));
    setError(null);
    setLoading(false);
  }, [userId, videoId]);

  useEffect(() => {
    if (!isUuid(videoId)) {
      setLoading(false);
      setComments([]);
      return;
    }
    setLoading(true);
    void load();
    const channel = supabase
      .channel(`comments:${videoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `video_id=eq.${videoId}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, videoId]);

  const addComment = useCallback(
    async (content: string, parentId?: string) => {
      if (!userId) return;
      const parsed = commentSchema.parse({ content });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from('comments').insert({
        video_id: videoId,
        user_id: userId,
        parent_id: parentId ?? null,
        content: parsed.content,
      });
      if (error) throw error;
      await load();
    },
    [load, userId, videoId]
  );

  const toggleLike = useCallback(async (commentId: string) => {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      const { error } = await client.from('comment_likes').delete().eq('id', data.id);
      if (error) throw error;
    } else {
      const { error } = await client.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
      if (error) throw error;
    }
    await load();
  }, [load, userId]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error } = await client.from('comments').update({ is_deleted: true })
      .eq('id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    await load();
  }, [load, userId]);

  return { comments, loading, error, addComment, toggleLike, deleteComment, reload: load };
};
