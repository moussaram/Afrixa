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
}

export const useRealtimeComments = (videoId: string, userId?: string) => {
  const [comments, setComments] = useState<RealtimeComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // New migration tables are not present in the generated Supabase types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data } = await client
      .from('comments')
      .select('*')
      .eq('video_id', videoId)
      .eq('is_deleted', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    setComments(data ?? []);
    setLoading(false);
  }, [videoId]);

  useEffect(() => {
    load();
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
      await client.from('comments').insert({
        video_id: videoId,
        user_id: userId,
        parent_id: parentId ?? null,
        content: parsed.content,
      });
    },
    [userId, videoId]
  );

  const toggleLike = useCallback(async (commentId: string) => {
    if (!userId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data } = await client
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.id) await client.from('comment_likes').delete().eq('id', data.id);
    else await client.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
  }, [userId]);

  return { comments, loading, addComment, toggleLike, reload: load };
};
