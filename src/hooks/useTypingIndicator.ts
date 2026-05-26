import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

interface TypingIndicatorRow {
  user_id?: string;
  is_typing?: boolean;
}

export const useTypingIndicator = (
  conversationId: string | undefined,
  otherUserId: string | undefined
) => {
  const { user } = useAuth();
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to other user's typing state
  useEffect(() => {
    if (!conversationId || !otherUserId) return;
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as TypingIndicatorRow | null;
          if (row && row.user_id === otherUserId) {
            setOtherIsTyping(!!row.is_typing);
            if (row.is_typing) {
              if (stopRef.current) clearTimeout(stopRef.current);
              stopRef.current = setTimeout(() => setOtherIsTyping(false), 4000);
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, otherUserId]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!user || !conversationId) return;
      supabase
        .from('typing_indicators')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: user.id,
            is_typing: isTyping,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' }
        )
        .then(() => {});
    },
    [user, conversationId]
  );

  /** Call on each keystroke; auto-stops after 3s of inactivity */
  const onInputChange = useCallback(() => {
    setTyping(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setTyping(false), 3000);
  }, [setTyping]);

  return { otherIsTyping, onInputChange, setTyping };
};
