/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/hooks/use-toast';
import { CreatorPageShell } from './CreatorPageShell';

const CollabsPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('collab_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger les collabs.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id?.includes('-')) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const updateStatus = async (id: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await (supabase as any).from('collab_requests').update({ status }).eq('id', id);
      if (error) throw error;
      toast({
        title: status === 'accepted' ? 'Collab acceptee' : 'Collab declinee',
        description: status === 'accepted' ? 'La conversation privee peut etre ouverte.' : 'La demande a ete mise a jour.',
      });
      load();
    } catch (error) {
      toast({ title: 'Erreur', description: "La demande n'a pas pu etre mise a jour.", variant: 'destructive' });
    }
  };

  return (
    <CreatorPageShell title="Collabs" subtitle="Demandes Duo, Duet et Stitch entre createurs">
      {loading ? (
        <Skeleton className="h-52 rounded-2xl bg-[#2D2D4E]" />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-6 text-center">
          <Users className="mx-auto h-10 w-10 text-[#7C3AED]" />
          <h2 className="mt-3 text-lg font-bold text-white">Aucune demande pour le moment</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">Les propositions de collaboration recues et envoyees apparaitront ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase text-[#7C3AED]">{request.type}</p>
                  <p className="mt-1 text-white">{request.message || 'Demande de collaboration Afrixa'}</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">Statut : {request.status}</p>
                </div>
                {request.receiver_id === user?.id && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#10B981]" onClick={() => updateStatus(request.id, 'accepted')}>Accepter</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(request.id, 'declined')}>Decliner</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="glass" onClick={() => toast({ title: 'Messagerie', description: 'Les collabs acceptees ouvrent une conversation privee.' })}>
        <MessageCircle className="mr-2 h-4 w-4" />
        Ouvrir mes messages
      </Button>
    </CreatorPageShell>
  );
};

export default CollabsPage;
