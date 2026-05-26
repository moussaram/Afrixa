import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Conversation } from '@/types/chat';
import { currentUser } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Pin, BellOff, Check, CheckCheck } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  onClick: () => void;
}

export const ConversationItem = ({ conversation, onClick }: ConversationItemProps) => {
  const otherUser = conversation.participants.find(p => p.id !== currentUser.id);
  
  if (!otherUser) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const getMessagePreview = () => {
    if (conversation.isTyping && conversation.lastTypingUser) {
      return (
        <span className="text-primary italic flex items-center gap-1">
          En train d'écrire
          <span className="animate-pulse">...</span>
        </span>
      );
    }

    const lastMsg = conversation.lastMessage;
    if (!lastMsg) return 'Nouvelle conversation';

    const isOwnMessage = lastMsg.senderId === currentUser.id;
    const prefix = isOwnMessage ? 'Vous : ' : '';

    switch (lastMsg.type) {
      case 'image':
        return `${prefix}📷 Photo`;
      case 'video':
        return `${prefix}🎥 Vidéo`;
      case 'audio':
        return `${prefix}🎤 Message vocal`;
      case 'sticker':
        return `${prefix}😊 Sticker`;
      case 'link':
        return `${prefix}🔗 Lien`;
      case 'location':
        return `${prefix}📍 Position`;
      default:
        return `${prefix}${lastMsg.content}`;
    }
  };

  const getStatusIcon = () => {
    const lastMsg = conversation.lastMessage;
    if (!lastMsg || lastMsg.senderId !== currentUser.id) return null;

    switch (lastMsg.status) {
      case 'sending':
        return <span className="text-muted-foreground text-xs">⏳</span>;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-primary" />;
      case 'failed':
        return <span className="text-destructive text-xs">❌</span>;
      default:
        return null;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 transition-colors hover:bg-muted/50 active:bg-muted",
        conversation.unreadCount > 0 && "bg-muted/30"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="w-14 h-14">
          <AvatarImage src={otherUser.avatar} alt={otherUser.username} />
          <AvatarFallback>{otherUser.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        {/* Online indicator */}
        {otherUser.isFollowing && (
          <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-semibold text-foreground truncate",
            conversation.unreadCount > 0 && "font-bold"
          )}>
            @{otherUser.username}
          </span>
          {conversation.isPinned && (
            <Pin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          )}
          {conversation.isMuted && (
            <BellOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {getStatusIcon()}
          <p className={cn(
            "text-sm truncate",
            conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {getMessagePreview()}
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {formatTime(conversation.updatedAt)}
        </span>
        {conversation.unreadCount > 0 && (
          <span className="min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1.5 animate-pulse">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
};
