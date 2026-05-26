import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Message } from '@/types/chat';
import { User } from '@/types';
import { currentUser } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  sender: User;
  showAvatar?: boolean;
}

export const MessageBubble = ({ message, sender, showAvatar = true }: MessageBubbleProps) => {
  const isOwn = message.senderId === currentUser.id;

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;

    switch (message.status) {
      case 'sending':
        return <span className="text-xs opacity-70">⏳</span>;
      case 'sent':
        return <Check className="w-3 h-3 opacity-70" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 opacity-70" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-accent" />;
      case 'failed':
        return <span className="text-xs text-destructive">❌</span>;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="rounded-lg overflow-hidden max-w-[200px]">
            <div className="bg-muted h-40 flex items-center justify-center">
              <span className="text-3xl">📷</span>
            </div>
          </div>
        );
      case 'video':
        return (
          <div className="rounded-lg overflow-hidden max-w-[200px]">
            <div className="bg-muted h-40 flex items-center justify-center">
              <span className="text-3xl">🎥</span>
            </div>
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center gap-2 py-1">
            <button className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              ▶
            </button>
            <div className="flex-1 h-1 bg-primary/30 rounded-full">
              <div className="w-1/3 h-full bg-primary rounded-full" />
            </div>
            <span className="text-xs opacity-70">0:15</span>
          </div>
        );
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  return (
    <div className={cn(
      "flex gap-2 px-4 py-1",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      {!isOwn && showAvatar && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={sender.avatar} alt={sender.username} />
          <AvatarFallback>{sender.username[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showAvatar && <div className="w-8 flex-shrink-0" />}

      {/* Bubble */}
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-2",
        isOwn 
          ? "bg-primary text-primary-foreground rounded-br-sm" 
          : "bg-muted text-foreground rounded-bl-sm"
      )}>
        {/* Reply indicator */}
        {message.replyTo && (
          <div className={cn(
            "mb-2 pl-2 border-l-2 text-xs opacity-70",
            isOwn ? "border-primary-foreground/50" : "border-primary"
          )}>
            <p className="font-medium">@{sender.username}</p>
            <p className="truncate">{message.replyTo.content}</p>
          </div>
        )}

        {/* Forwarded indicator */}
        {message.isForwarded && (
          <p className="text-xs opacity-70 mb-1 italic">↗️ Transféré</p>
        )}

        {/* Content */}
        {renderContent()}

        {/* Time and status */}
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isOwn ? "justify-end" : "justify-start"
        )}>
          <span className="text-[10px] opacity-70">{formatTime(message.createdAt)}</span>
          {getStatusIcon()}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={cn(
            "flex gap-1 mt-1 -mb-1",
            isOwn ? "justify-end" : "justify-start"
          )}>
            {message.reactions.map((reaction, idx) => (
              <span 
                key={idx}
                className="text-sm bg-background/20 rounded-full px-1.5 py-0.5"
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
