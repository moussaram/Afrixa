import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type FollowRequestCard = {
  id: string;
  requester_id: string;
  created_at: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

const FollowRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState<FollowRequestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const { data: rows, error } = await supabase
        .from('follow_requests')
        .select('id,requester_id,created_at')
        .eq('target_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const requesterIds = [...new Set((rows || []).map(row => row.requester_id))];
      const { data: profiles, error: profilesError } = requesterIds.length
        ? await supabase.from('public_profiles')
            .select('user_id,username,prenom,nom,avatar_url')
            .in('user_id', requesterIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile]));
      setRequests((rows || []).map(row => {
        const profile = profileMap.get(row.requester_id);
        return {
          id: row.id,
          requester_id: row.requester_id,
          created_at: row.created_at,
          username: profile?.username || 'utilisateur',
          displayName: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.username || 'Utilisateur',
          avatarUrl: profile?.avatar_url || '/placeholder.svg',
        };
      }));
    } catch (error) {
      console.error('Follow requests load failed', error);
      setLoadError('Impossible de charger les demandes pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const decide = async (requestId: string, status: 'accepted' | 'declined') => {
    if (!user || busyId) return;
    setBusyId(requestId);
    try {
      const { error } = await supabase.from('follow_requests')
        .update({ status })
        .eq('id', requestId)
        .eq('target_id', user.id)
        .eq('status', 'pending');
      if (error) throw error;
      setRequests(current => current.filter(request => request.id !== requestId));
      toast.success(status === 'accepted' ? 'Demande acceptée.' : 'Demande refusée.');
    } catch (error) {
      console.error('Follow request decision failed', error);
      toast.error('Impossible de traiter cette demande. Réessayez.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30 flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold text-foreground">Demandes d’abonnement</h1>
          <p className="text-xs text-muted-foreground">Acceptez ou refusez les demandes pour votre compte privé.</p>
        </div>
        <UserPlus className="w-5 h-5 text-muted-foreground" />
      </header>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Chargement des demandes…</p>
      ) : loadError ? (
        <div className="py-16 px-6 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" className="mt-3" onClick={() => void loadRequests()}>Réessayer</Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-20 px-6 text-center">
          <UserPlus className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Aucune demande en attente</p>
          <p className="mt-1 text-sm text-muted-foreground">Les nouvelles demandes apparaîtront ici.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {requests.map(request => (
            <div key={request.id} className="flex items-center gap-3 px-4 py-4">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => navigate(`/user/${request.requester_id}`)}>
                <img src={request.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{request.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{request.username}</span>
                </span>
              </button>
              <Button size="sm" variant="outline" disabled={busyId === request.id} onClick={() => void decide(request.id, 'declined')} aria-label="Refuser la demande">
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" disabled={busyId === request.id} onClick={() => void decide(request.id, 'accepted')} aria-label="Accepter la demande">
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowRequests;
