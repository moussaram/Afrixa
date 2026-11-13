/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { COLORS, type LiveMessage } from '@/components/live/LiveChat';

const client = supabase as any;
const MAX_MESSAGES = 100;

interface LiveMessageRow {
  id: string;
  session_id: string;
  user_id: string | null;
  content: string;
  is_hidden: boolean;
  created_at: string;
}

interface ChatProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

const toLiveMessage = (
  row: LiveMessageRow,
  profiles: Map<string, ChatProfile>,
  hostId: string | undefined,
): LiveMessage => {
  const profile = row.user_id ? profiles.get(row.user_id) : undefined;
  const username = profile?.username || 'Utilisateur';
  const seed = row.user_id ? row.user_id.charCodeAt(0) + row.user_id.charCodeAt(1) : 0;
  return {
    id: row.id,
    userId: row.user_id ?? '',
    username,
    avatar: profile?.avatar_url ?? '',
    text: row.content,
    color: COLORS[Math.abs(seed) % COLORS.length],
    timestamp: new Date(row.created_at).getTime(),
    isCreator: Boolean(hostId && row.user_id === hostId),
  };
};

export function useLiveChat(
  sessionId: string | undefined,
  options: { userId?: string; hostId?: string; canModerate?: boolean },
) {
  const { userId, hostId, canModerate = false } = options;
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await client
      .from('live_messages')
      .select('id,session_id,user_id,content,is_hidden,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(MAX_MESSAGES);

    if (fetchError) {
      console.error('Unable to load live messages', fetchError);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as LiveMessageRow[];
    const authorIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
    let profiles: ChatProfile[] = [];
    if (authorIds.length > 0) {
      const { data: profileRows } = await client
        .from('public_profiles')
        .select('user_id,username,prenom,nom,avatar_url')
        .in('user_id', authorIds);
      profiles = (profileRows ?? []) as ChatProfile[];
    }
    const byUser = new Map(profiles.map((profile) => [profile.user_id, profile]));

    setMessages(rows.reverse().map((row) => toLiveMessage(row, byUser, hostId)));
    setError(null);
    setLoading(false);
  }, [hostId, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();

    const channel = supabase
      .channel(`live-chat:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_messages', filter: `session_id=eq.${sessionId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || !sessionId) return;
    if (!userId) throw new Error('Connexion requise pour commenter');
    if (content.length > 300) throw new Error('Message trop long');

    setSending(true);
    try {
      const { error: insertError } = await client.from('live_messages').insert({
        session_id: sessionId,
        user_id: userId,
        content,
      });
      if (insertError) throw insertError;
      await load();
    } finally {
      setSending(false);
    }
  }, [load, sessionId, userId]);

  const hideMessage = useCallback(async (messageId: string) => {
    if (!canModerate) throw new Error('Modération réservée au créateur et aux co-animateurs');
    const { error: updateError } = await client
      .from('live_messages')
      .update({ is_hidden: true })
      .eq('id', messageId);
    if (updateError) throw updateError;
    await load();
  }, [canModerate, load]);

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error: deleteError } = await client
      .from('live_messages')
      .delete()
      .eq('id', messageId);
    if (deleteError) throw deleteError;
    await load();
  }, [load]);

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    hideMessage,
    deleteMessage,
    reload: load,
  };
}
