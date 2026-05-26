import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

export interface ConversationRow {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_at: string;
  last_sender_id: string | null;
  unread_count_1: number;
  unread_count_2: number;
  created_at: string;
}

export interface OtherProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

export interface ConversationWithProfile extends ConversationRow {
  other: OtherProfile | null;
  unreadCount: number;
  isOnline?: boolean;
}

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data: convs, error: cErr } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      if (cErr) throw cErr;

      const otherIds = (convs || []).map(c =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      );

      let profiles: OtherProfile[] = [];
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, username, prenom, nom, avatar_url')
          .in('user_id', otherIds);
        profiles = profs || [];
      }

      const enriched: ConversationWithProfile[] = (convs || []).map(c => {
        const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
        const other = profiles.find(p => p.user_id === otherId) || null;
        const unreadCount = c.participant_1 === user.id ? c.unread_count_1 : c.unread_count_2;
        return { ...c, other, unreadCount };
      });
      setConversations(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime: refresh on any conversation update
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  /** Get or create a 1:1 conversation with another user, returns conversation id */
  const getOrCreateConversation = useCallback(
    async (otherUserId: string): Promise<string | null> => {
      if (!user) return null;
      const [a, b] = [user.id, otherUserId].sort();
      // try find existing in either order
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_1.eq.${a},participant_2.eq.${b}),and(participant_1.eq.${b},participant_2.eq.${a})`
        )
        .maybeSingle();
      if (existing) return existing.id;

      const { data: created, error: insErr } = await supabase
        .from('conversations')
        .insert({ participant_1: a, participant_2: b })
        .select('id')
        .single();
      if (insErr) {
        setError(insErr.message);
        return null;
      }
      await fetchConversations();
      return created.id;
    },
    [user, fetchConversations]
  );

  return { conversations, loading, error, refetch: fetchConversations, getOrCreateConversation };
};
