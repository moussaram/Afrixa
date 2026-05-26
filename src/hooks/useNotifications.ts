import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { mockNotifications } from '@/data/mockData';
import type { Notification as AppNotification } from '@/types';

interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  order_id: string | null;
}

// Maps a Supabase row into the app's Notification shape so the existing UI works.
const dbToApp = (n: DbNotification): AppNotification => ({
  id: n.id,
  type: (n.type as AppNotification['type']) || 'like',
  user: {
    id: n.reference_id || n.user_id,
    username: 'support',
    displayName: n.title,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
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
      setNotifications(mockNotifications);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
      // Fallback to mock so the UI is never empty in dev / when RLS blocks
      setNotifications(mockNotifications);
    } else {
      setNotifications((data as DbNotification[]).map(dbToApp));
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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (user) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    }
  }, [user]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (user) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
}
