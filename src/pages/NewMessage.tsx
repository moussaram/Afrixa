import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { SkeletonList } from '@/components/common/SkeletonLoader';
import { ErrorWithRetry } from '@/components/common/ErrorWithRetry';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Contact {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

const NewMessage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrCreateConversation } = useConversations();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      setLoading(true);
      const { data, error: e } = await supabase
        .from('profiles')
        .select('user_id, username, prenom, nom, avatar_url')
        .neq('user_id', user.id)
        .limit(100);
      if (e) throw e;
      setContacts(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      [c.username, c.prenom, c.nom].some(v => v?.toLowerCase().includes(q))
    );
  }, [searchQuery, contacts]);

  const handleNext = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    const convId = await getOrCreateConversation(selectedUserId);
    setSubmitting(false);
    if (convId) {
      navigate(`/chat/${convId}`);
    } else {
      toast({ title: 'Erreur', description: 'Impossible de créer la conversation', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Nouveau Message</h1>
          <Button
            variant="ghost"
            size="sm"
            className={cn('text-primary font-semibold', !selectedUserId && 'opacity-50')}
            disabled={!selectedUserId || submitting}
            onClick={handleNext}
          >
            {submitting ? '...' : 'Chat'}
          </Button>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              className="pl-10 pr-10 rounded-full bg-muted border-none"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <SkeletonList rows={8} />
          </div>
        ) : error ? (
          <ErrorWithRetry message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Search className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucun contact trouvé</p>
          </div>
        ) : (
          filtered.map(c => {
            const name = c.username || c.prenom || c.nom || 'Utilisateur';
            const isSelected = selectedUserId === c.user_id;
            return (
              <button
                key={c.user_id}
                onClick={() => setSelectedUserId(isSelected ? null : c.user_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 transition-colors',
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                )}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={c.avatar_url || undefined} alt={name} loading="lazy" />
                  <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-foreground truncate">@{name}</p>
                  {(c.prenom || c.nom) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {[c.prenom, c.nom].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                    isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'
                  )}
                >
                  {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NewMessage;
