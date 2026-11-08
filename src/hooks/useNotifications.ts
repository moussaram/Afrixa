import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { Notification as AppNotification } from '@/types';

interface DbNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  order_id: string | null;
}

// Maps a Supabase row into the app's Notification shape so the existing UI works.
const dbToApp = (n: DbNotification, actor?: {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}): AppNotification => ({
  id: n.id,
  type: (n.type as AppNotification['type']) || 'like',
  user: {
    id: actor?.user_id || n.actor_id || n.user_id,
    username: actor?.username || 'afrixa',
    displayName: [actor?.prenom, actor?.nom].filter(Boolean).join(' ') || actor?.username || 'Afrixa',
    avatar: actor?.avatar_url || '',
    bio: '',
    followers: 0,
    following: 0,
    likes: 0,
    isFollowing: false,
  },
  message: n.message,
  createdAt: n.created_at,
  isRead: n.is_read,
});

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Unable to load account notifications', error);
      setNotifications([]);
    } else {
      const rows = (data ?? []) as DbNotification[];
      const actorIds = [...new Set(rows.map(row => row.actor_id).filter((id): id is string => Boolean(id)))];
      const { data: actors, error: actorsError } = actorIds.length
        ? await supabase.from('public_profiles').select('user_id,username,prenom,nom,avatar_url').in('user_id', actorIds)
        : { data: [], error: null };
      if (actorsError) console.warn('Unable to resolve notification actors', actorsError);
      const actorsById = new Map((actors ?? []).map(actor => [actor.user_id, actor]));
      setNotifications(rows.map(row => dbToApp(row, row.actor_id ? actorsById.get(row.actor_id) : undefined)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const markRead = useCallback(async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true })
      .eq('id', id).eq('user_id', user.id);
    if (error) {
      console.error('Unable to mark notification as read', error);
      await load();
      return;
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, [load, user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    if (error) {
      console.error('Unable to mark all notifications as read', error);
      await load();
      return;
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, [load, user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
}
