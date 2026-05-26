import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  media_url: string | null;
  product_id: string | null;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
  /** local-only when optimistic */
  _optimistic?: boolean;
}

export const useChatMessages = (conversationId: string | undefined) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetch = useCallback(async () => {
    if (!conversationId) return;
    try {
      setError(null);
      const { data, error: e } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (e) throw e;
      setMessages(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    fetch();
  }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages(prev => {
            // replace optimistic if exists
            const filtered = prev.filter(m => !(m._optimistic && m.content === newMsg.content && m.sender_id === newMsg.sender_id));
            if (filtered.some(m => m.id === newMsg.id)) return filtered;
            return [...filtered, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const upd = payload.new as MessageRow;
          setMessages(prev =>
            upd.is_deleted
              ? prev.filter(m => m.id !== upd.id)
              : prev.map(m => (m.id === upd.id ? upd : m))
          );
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  /** Mark conversation as read for current user */
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user) return;
    const { data: conv } = await supabase
      .from('conversations')
      .select('participant_1')
      .eq('id', conversationId)
      .single();
    if (!conv) return;
    const field = conv.participant_1 === user.id ? 'unread_count_1' : 'unread_count_2';
    await supabase.from('conversations').update({ [field]: 0 }).eq('id', conversationId);
  }, [conversationId, user]);

  const sendMessage = useCallback(
    async (content: string, type: string = 'text', mediaUrl?: string) => {
      if (!user || !conversationId || !content.trim()) return;
      const optimistic: MessageRow = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,
        media_url: mediaUrl || null,
        product_id: null,
        is_read: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimistic]);

      const { error: e } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,
        media_url: mediaUrl || null,
      });
      if (e) {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        setError(e.message);
      }
    },
    [user, conversationId]
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    await supabase.from('messages').update({ is_deleted: true }).eq('id', messageId);
  }, []);

  return { messages, loading, error, sendMessage, deleteMessage, markAsRead, refetch: fetch };
};
