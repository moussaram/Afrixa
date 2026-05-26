import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, PenSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useConversations, ConversationWithProfile } from '@/hooks/useConversations';
import { usePresenceHeartbeat } from '@/hooks/usePresence';
import { SkeletonList } from '@/components/common/SkeletonLoader';
import { ErrorWithRetry } from '@/components/common/ErrorWithRetry';
import { useAuth } from '@/contexts/AuthContext';

type TabType = 'all' | 'unread';

const formatTime = (iso: string) => {
  const date = new Date(iso);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffMins < 1440)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const displayName = (c: ConversationWithProfile) => {
  if (!c.other) return 'Utilisateur';
  return c.other.username || c.other.prenom || c.other.nom || 'Utilisateur';
};

const Messages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  usePresenceHeartbeat();
  const { conversations, loading, error, refetch } = useConversations();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totalUnread = useMemo(
    () => conversations.reduce((s, c) => s + c.unreadCount, 0),
    [conversations]
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (activeTab === 'unread') list = list.filter(c => c.unreadCount > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        c =>
          displayName(c).toLowerCase().includes(q) ||
          (c.last_message || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, activeTab, searchQuery]);

  const tabs: { id: TabType; label: string; badge?: number }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'unread', label: 'Non lus', badge: totalUnread },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <span className="min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary"
            onClick={() => navigate('/messages/new')}
          >
            <PenSquare className="w-6 h-6" />
          </Button>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher une conversation"
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

        <div className="flex border-b border-border/30">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 transition-all',
                activeTab === tab.id
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground'
              )}
            >
              <span className="font-medium">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="min-w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full px-1.5 bg-destructive text-destructive-foreground">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">
            <SkeletonList rows={6} />
          </div>
        ) : error ? (
          <ErrorWithRetry message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
              <Search className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? 'Aucune conversation trouvée'
                : 'Aucune conversation pour le moment'}
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate('/messages/new')}
            >
              Démarrer une discussion
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(c => {
              const name = displayName(c);
              const isOwnLast = c.last_sender_id === user?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/chat/${c.id}`)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 transition-colors hover:bg-muted/50 active:bg-muted text-left',
                    c.unreadCount > 0 && 'bg-muted/30'
                  )}
                >
                  <Avatar className="w-14 h-14 flex-shrink-0">
                    <AvatarImage src={c.other?.avatar_url || undefined} alt={name} loading="lazy" />
                    <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-semibold text-foreground truncate',
                        c.unreadCount > 0 && 'font-bold'
                      )}
                    >
                      @{name}
                    </p>
                    <p
                      className={cn(
                        'text-sm truncate mt-0.5',
                        c.unreadCount > 0
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground'
                      )}
                    >
                      {c.last_message
                        ? `${isOwnLast ? 'Vous : ' : ''}${c.last_message}`
                        : 'Nouvelle conversation'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(c.last_message_at)}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5">
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
