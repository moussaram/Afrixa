import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  ChevronDown,
  Check,
  CheckCheck,
  Trash2,
  Send,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useUserPresence, usePresenceHeartbeat } from '@/hooks/usePresence';
import { ErrorWithRetry } from '@/components/common/ErrorWithRetry';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface OtherProfile {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const formatLastSeen = (iso: string | null) => {
  if (!iso) return 'Hors ligne';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Vu il y a ${mins} min`;
  if (mins < 1440) return `Vu il y a ${Math.floor(mins / 60)}h`;
  return `Vu le ${new Date(iso).toLocaleDateString('fr-FR')}`;
};

const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  usePresenceHeartbeat();

  const [other, setOther] = useState<OtherProfile | null>(null);
  const [convError, setConvError] = useState<string | null>(null);
  const [convLoading, setConvLoading] = useState(true);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, loading, error, sendMessage, deleteMessage, markAsRead } =
    useChatMessages(conversationId);
  const presence = useUserPresence(other?.user_id);
  const { otherIsTyping, onInputChange, setTyping } = useTypingIndicator(
    conversationId,
    other?.user_id
  );

  // Load conversation + other profile
  useEffect(() => {
    if (!conversationId || !user) return;
    let active = true;
    (async () => {
      setConvLoading(true);
      const { data: conv, error: e } = await supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .eq('id', conversationId)
        .maybeSingle();
      if (!active) return;
      if (e || !conv) {
        setConvError(e?.message || 'Conversation introuvable');
        setConvLoading(false);
        return;
      }
      const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, username, prenom, nom, avatar_url')
        .eq('user_id', otherId)
        .maybeSingle();
      if (!active) return;
      setOther(prof || { user_id: otherId, username: null, prenom: null, nom: null, avatar_url: null });
      setConvLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [conversationId, user]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherIsTyping]);

  // Mark as read when entering / when new messages arrive
  useEffect(() => {
    if (!loading && messages.length > 0) markAsRead();
  }, [loading, messages.length, markAsRead]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setTyping(false);
    await sendMessage(text, 'text');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const name = other?.username || other?.prenom || 'Utilisateur';

  if (convLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (convError || !other) {
    return (
      <div className="min-h-screen bg-background">
        <ErrorWithRetry message={convError || 'Conversation introuvable'} onRetry={() => navigate('/messages')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-2 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>

          <button
            className="flex items-center gap-3 flex-1 min-w-0"
            onClick={() => navigate(`/user/${other.user_id}`)}
          >
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={other.avatar_url || undefined} alt={name} loading="lazy" />
                <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              {presence?.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              )}
            </div>
            <div className="text-left min-w-0">
              <p className="font-semibold text-foreground truncate">@{name}</p>
              <p className="text-xs text-muted-foreground">
                {otherIsTyping ? (
                  <span className="text-primary">En train d'écrire...</span>
                ) : presence?.is_online ? (
                  <span className="text-green-500">En ligne</span>
                ) : (
                  formatLastSeen(presence?.last_seen || null)
                )}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-primary"
              onClick={() => toast({ title: 'Bientôt disponible', description: 'Appel vidéo' })}>
              <Video className="w-6 h-6" />
            </Button>
            <Button variant="ghost" size="icon" className="text-primary"
              onClick={() => toast({ title: 'Bientôt disponible', description: 'Appel vocal' })}>
              <Phone className="w-6 h-6" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-6 h-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(`/user/${other.user_id}`)}>
                  Voir le profil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse text-muted-foreground text-sm">Chargement...</div>
          </div>
        ) : error ? (
          <ErrorWithRetry message={error} onRetry={() => window.location.reload()} />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 pt-12">
            <Avatar className="w-20 h-20 mb-4">
              <AvatarImage src={other.avatar_url || undefined} alt={name} loading="lazy" />
              <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <p className="font-semibold text-foreground">@{name}</p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Envoyez votre premier message
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isOwn = m.sender_id === user?.id;
            const prev = messages[i - 1];
            const showAvatar = !prev || prev.sender_id !== m.sender_id;
            return (
              <div
                key={m.id}
                className={cn('flex gap-2 px-4 group', isOwn ? 'flex-row-reverse' : 'flex-row')}
              >
                {!isOwn && (showAvatar ? (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={other.avatar_url || undefined} alt={name} loading="lazy" />
                    <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-8 flex-shrink-0" />
                ))}
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-4 py-2 relative',
                    isOwn
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm',
                    m._optimistic && 'opacity-70'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <div className={cn('flex items-center gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
                    <span className="text-[10px] opacity-70">{formatTime(m.created_at)}</span>
                    {isOwn &&
                      (m._optimistic ? (
                        <span className="text-[10px] opacity-70">⏳</span>
                      ) : m.is_read ? (
                        <CheckCheck className="w-3 h-3 text-accent" />
                      ) : (
                        <Check className="w-3 h-3 opacity-70" />
                      ))}
                  </div>
                  {isOwn && !m._optimistic && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="absolute -top-2 -left-7 opacity-0 group-hover:opacity-100 p-1 bg-background border border-border rounded-full transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {otherIsTyping && (
          <div className="flex gap-2 px-4">
            <div className="w-8" />
            <div className="bg-muted rounded-2xl px-4 py-3 rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length > 8 && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-24 right-4 rounded-full shadow-lg"
          onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      )}

      {/* Input */}
      <div className="border-t border-border bg-background">
        <div className="flex items-center gap-2 p-3">
          <div className="flex-1 flex items-center gap-2 bg-muted rounded-full px-4 py-2">
            <Input
              value={input}
              onChange={e => {
                setInput(e.target.value);
                onInputChange();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              className="border-none bg-transparent p-0 h-auto focus-visible:ring-0"
            />
            <Smile className="w-5 h-5 text-muted-foreground" />
          </div>
          <Button
            size="icon"
            className="flex-shrink-0 rounded-full gradient-primary"
            disabled={!input.trim()}
            onClick={handleSend}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
