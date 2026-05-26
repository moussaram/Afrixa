import { cn } from '@/lib/utils';

export type SystemMessageType = 
  | 'user_joined'
  | 'user_left'
  | 'name_changed'
  | 'photo_changed'
  | 'missed_call'
  | 'message_deleted'
  | 'encrypted';

interface SystemMessageProps {
  type: SystemMessageType;
  content: string;
  timestamp?: string;
}

export const SystemMessage = ({ type, content, timestamp }: SystemMessageProps) => {
  const getIcon = () => {
    switch (type) {
      case 'user_joined':
        return '👋';
      case 'user_left':
        return '👋';
      case 'name_changed':
        return '✏️';
      case 'photo_changed':
        return '📷';
      case 'missed_call':
        return '📞';
      case 'message_deleted':
        return '🗑️';
      case 'encrypted':
        return '🔒';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="flex justify-center py-2 px-4">
      <div className={cn(
        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full",
        "bg-muted/50 text-muted-foreground text-xs"
      )}>
        <span>{getIcon()}</span>
        <span>{content}</span>
        {timestamp && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-muted-foreground/70">{timestamp}</span>
          </>
        )}
      </div>
    </div>
  );
};
