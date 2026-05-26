import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, SmilePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiveMessage {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  text: string;
  color: string;
  timestamp: number;
  isCreator?: boolean;
}

const COLORS = [
  'text-blue-400', 'text-green-400', 'text-yellow-400',
  'text-pink-400', 'text-purple-400', 'text-cyan-400',
];

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😂', '😍', '💯', '🎉', '👑'];

interface LiveChatProps {
  messages: LiveMessage[];
  onSend: (text: string) => void;
  onDelete?: (id: string) => void;
  isCreator?: boolean;
  commentsEnabled: boolean;
  currentUserId: string;
}

export const LiveChat = ({
  messages,
  onSend,
  onDelete,
  isCreator = false,
  commentsEnabled,
  currentUserId,
}: LiveChatProps) => {
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [lastSent, setLastSent] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const now = Date.now();
    if (!input.trim() || !commentsEnabled) return;
    // Anti-spam: 1 message every 2 seconds
    if (now - lastSent < 2000) return;
    onSend(input.trim());
    setInput('');
    setLastSent(now);
  }, [input, commentsEnabled, lastSent, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const appendEmoji = (emoji: string) => {
    setInput(p => p + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-2 p-3 pb-1">
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2 group">
            <img
              src={msg.avatar}
              alt={msg.username}
              className="w-7 h-7 rounded-full flex-shrink-0 border border-border/30"
            />
            <div className="flex-1 min-w-0">
              <span className={cn("text-xs font-semibold mr-1.5", msg.color)}>
                {msg.username}
                {msg.isCreator && (
                  <span className="ml-1 text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded">Créateur</span>
                )}
              </span>
              <span className="text-sm text-foreground/90 break-words">{msg.text}</span>
            </div>
            {(isCreator || msg.userId === currentUserId) && onDelete && (
              <button
                onClick={() => onDelete(msg.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all ml-1 flex-shrink-0"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick emojis + Input */}
      {showEmojis && (
        <div className="flex gap-2 px-3 py-2 border-t border-border/20 overflow-x-auto hide-scrollbar">
          {QUICK_EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => appendEmoji(e)}
              className="text-xl flex-shrink-0 hover:scale-110 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 p-3 border-t border-border/20">
        <button
          onClick={() => setShowEmojis(v => !v)}
          className="p-2 hover:bg-muted/50 rounded-full transition-colors flex-shrink-0"
        >
          <SmilePlus className="w-5 h-5 text-muted-foreground" />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={commentsEnabled ? "Commenter..." : "Commentaires désactivés"}
          disabled={!commentsEnabled}
          maxLength={150}
          className="flex-1 bg-muted/40 border border-border/30 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !commentsEnabled}
          className="p-2 gradient-primary rounded-full flex-shrink-0 disabled:opacity-40 hover:scale-105 active:scale-95 transition-transform"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export { COLORS };
