import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

interface PresenceRow {
  is_online?: boolean;
  last_seen?: string | null;
}

/** Mark current user online and update last_seen; subscribe to a user's presence */
export const usePresenceHeartbeat = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const upsert = async (online: boolean) => {
      await supabase.from('user_presence').upsert(
        { user_id: user.id, is_online: online, last_seen: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    };
    upsert(true);
    const interval = setInterval(() => upsert(true), 30_000);
    const onUnload = () => upsert(false);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
      upsert(false);
    };
  }, [user]);
};

export interface PresenceState {
  is_online: boolean;
  last_seen: string | null;
}

export const useUserPresence = (userId: string | undefined) => {
  const [presence, setPresence] = useState<PresenceState | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('is_online, last_seen')
        .eq('user_id', userId)
        .maybeSingle();
      if (active) setPresence(data || { is_online: false, last_seen: null });
    };
    load();

    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as PresenceRow | null;
          if (row) setPresence({ is_online: row.is_online, last_seen: row.last_seen });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return presence;
};
