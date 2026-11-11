/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { Notification as AppNotification } from '@/types';

interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id: string | null;
  actor_id: string | null;
  aggregate_count: number;
  is_read: boolean;
  created_at: string;
}

interface ActorProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

const NOTIFICATION_TYPES = new Set<AppNotification['type']>(['like', 'comment', 'reply', 'follow', 'mention', 'system']);

const normalizeType = (type: string): AppNotification['type'] =>
  NOTIFICATION_TYPES.has(type as AppNotification['type'])
    ? (type as AppNotification['type'])
    : 'system';

const dbToApp = (notification: DbNotification, actors: Map<string, ActorProfile>): AppNotification => {
  const actor = notification.actor_id ? actors.get(notification.actor_id) : undefined;
  const username = actor?.username ?? 'afrixa';
  return {
    id: notification.id,
    type: normalizeType(notification.type),
    user: {
      id: actor?.user_id ?? notification.actor_id ?? notification.user_id,
      username,
      displayName: [actor?.prenom, actor?.nom].filter(Boolean).join(' ') || username,
      avatar: actor?.avatar_url ?? '',
      followers: 0,
      following: 0,
      likes: 0,
      isFollowing: false,
    },
    message: notification.message,
    createdAt: notification.created_at,
    isRead: notification.is_read,
  };
};

export function useNotifications() {
  const { user } = useAuth();
  const client = supabase as any;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error('Unable to load notifications', fetchError);
      setError(fetchError.message);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DbNotification[];
    const actorIds = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];

    let actors: ActorProfile[] = [];
    if (actorIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('user_id,username,prenom,nom,avatar_url')
        .in('user_id', actorIds);
      actors = (profiles ?? []) as ActorProfile[];
    }

    const actorsById = new Map(actors.map((actor) => [actor.user_id, actor]));
    setNotifications(rows.map((row) => dbToApp(row, actorsById)));
    setError(null);
    setLoading(false);
  }, [client, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { void load(); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((previous) => previous.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (user) {
      const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (updateError) console.error('Unable to mark notification as read', updateError);
    }
  }, [user]);

  const markAllRead = useCallback(async () => {
    setNotifications((previous) => previous.map((n) => ({ ...n, isRead: true })));
    if (user) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (updateError) console.error('Unable to mark all notifications as read', updateError);
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, loading, error, markRead, markAllRead, reload: load };
}
