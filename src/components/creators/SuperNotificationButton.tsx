/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SuperNotificationButtonProps = {
  creatorId: string;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const SuperNotificationButton = ({ creatorId }: SuperNotificationButtonProps) => {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id || !creatorId) return;
      if (!isUuid(user.id) || !isUuid(creatorId)) return;
      try {
        const { data, error } = await (supabase as any)
          .from('super_notifications')
          .select('id,is_active')
          .eq('follower_id', user.id)
          .eq('creator_id', creatorId)
          .maybeSingle();
        if (error) throw error;
        setActive(Boolean(data?.is_active));
      } catch (error) {
        toast({ title: 'Erreur', description: "Impossible de charger l'alerte créateur.", variant: 'destructive' });
      }
    };
    load();
  }, [creatorId, user?.id]);

  const toggle = async () => {
    if (!user?.id) return;
    if (!isUuid(user.id) || !isUuid(creatorId)) {
      setActive((value) => !value);
      toast({
        title: active ? 'Super Notification desactivee' : 'Super Notification activee',
        description: 'Mode demonstration actif pour ce profil.',
      });
      return;
    }
    try {
      setLoading(true);
      if (active) {
        const { error } = await (supabase as any)
          .from('super_notifications')
          .delete()
          .eq('follower_id', user.id)
          .eq('creator_id', creatorId);
        if (error) throw error;
        setActive(false);
        toast({ title: 'Super Notification désactivée', description: 'Tu recevras les notifications normales.' });
      } else {
        const { count, error: countError } = await (supabase as any)
          .from('super_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', user.id)
          .eq('is_active', true);
        if (countError) throw countError;
        if ((count ?? 0) >= 50) {
          toast({ title: 'Limite atteinte', description: 'Tu peux activer au maximum 50 Super Notifications.', variant: 'destructive' });
          return;
        }
        const { error } = await (supabase as any)
          .from('super_notifications')
          .upsert({ follower_id: user.id, creator_id: creatorId, is_active: true }, { onConflict: 'follower_id,creator_id' });
        if (error) throw error;
        setActive(true);
        toast({ title: 'Super Notification activée', description: 'Tu seras alerté en priorité.' });
      }
    } catch (error) {
      toast({ title: 'Erreur', description: "L'action n'a pas pu être appliquée.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="glass" size="icon" disabled={loading} onClick={toggle} className={cn(active && 'bg-[#7C3AED] text-white')}>
      <Bell className={cn('h-5 w-5', active && 'fill-current')} />
    </Button>
  );
};
