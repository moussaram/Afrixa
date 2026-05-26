import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Mic, 
  Send, 
  Image as ImageIcon, 
  Smile, 
  Camera,
  MapPin,
  X,
  FileText,
  Music,
  User,
  Video,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmojiPicker } from './EmojiPicker';

interface ChatInputProps {
  onSend: (content: string, type: 'text' | 'image' | 'audio') => void;
  replyTo?: { username: string; content: string } | null;
  onCancelReply?: () => void;
}

export const ChatInput = ({ onSend, replyTo, onCancelReply }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim(), 'text');
      setMessage('');
      onCancelReply?.();
      setShowEmojiPicker(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRecordingStart = () => {
    setIsRecording(true);
    setShowAttachments(false);
    setShowEmojiPicker(false);
  };

  const handleRecordingStop = () => {
    if (recordingTime > 0) {
      onSend(`🎤 Message vocal (${formatRecordingTime(recordingTime)})`, 'audio');
    }
    setIsRecording(false);
    setIsRecordingLocked(false);
  };

  const handleRecordingCancel = () => {
    setIsRecording(false);
    setIsRecordingLocked(false);
  };

  const attachmentOptions = [
    { icon: Camera, label: 'Caméra', color: 'bg-blue-500' },
    { icon: ImageIcon, label: 'Galerie', color: 'bg-green-500' },
    { icon: Video, label: 'Vidéo', color: 'bg-purple-500' },
    { icon: MapPin, label: 'Position', color: 'bg-red-500' },
    { icon: User, label: 'Contact', color: 'bg-orange-500' },
    { icon: Music, label: 'Audio', color: 'bg-pink-500' },
    { icon: FileText, label: 'Document', color: 'bg-yellow-500' },
  ];

  // Recording UI
  if (isRecording) {
    return (
      <div className="border-t border-border bg-background">
        <div className="flex items-center gap-3 p-3">
          {/* Cancel button */}
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={handleRecordingCancel}
          >
            <Trash2 className="w-6 h-6" />
          </Button>

          {/* Recording indicator */}
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-destructive font-medium">REC</span>
            </div>
            <span className="text-foreground font-mono">{formatRecordingTime(recordingTime)}</span>
            
            {/* Waveform visualization */}
            <div className="flex-1 flex items-center gap-0.5 h-8">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary rounded-full"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animation: `pulse 0.5s ease-in-out ${i * 0.05}s infinite alternate`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Send button */}
          <Button
            size="icon"
            className="flex-shrink-0 rounded-full gradient-primary"
            onClick={handleRecordingStop}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {!isRecordingLocked && (
          <p className="text-xs text-muted-foreground text-center pb-2">
            ↑ Glissez pour verrouiller • ← Glissez pour annuler
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-background">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-l-2 border-primary">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">@{replyTo.username}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <EmojiPicker 
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Attachment options */}
      {showAttachments && (
        <div className="grid grid-cols-4 gap-4 px-4 py-4 border-b border-border animate-slide-up">
          {attachmentOptions.map((option) => (
            <button
              key={option.label}
              className="flex flex-col items-center gap-2"
              onClick={() => setShowAttachments(false)}
            >
              <div className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center text-white",
                option.color
              )}>
                <option.icon className="w-6 h-6" />
              </div>
              <span className="text-xs text-muted-foreground">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 p-3">
        {/* Attachments button */}
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={() => {
            setShowAttachments(!showAttachments);
            setShowEmojiPicker(false);
          }}
        >
          <Plus className={cn(
            "w-6 h-6 transition-transform duration-200",
            showAttachments && "rotate-45"
          )} />
        </Button>

        {/* Text input */}
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-full px-4 py-2">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              setShowAttachments(false);
            }}
            placeholder="Message..."
            className="border-none bg-transparent p-0 h-auto focus-visible:ring-0"
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 -mr-2"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachments(false);
            }}
          >
            <Smile className={cn(
              "w-5 h-5 transition-colors",
              showEmojiPicker ? "text-primary" : "text-muted-foreground"
            )} />
          </Button>
        </div>

        {/* Send or Voice button */}
        {message.trim() ? (
          <Button
            size="icon"
            className="flex-shrink-0 rounded-full gradient-primary"
            onClick={handleSend}
          >
            <Send className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 rounded-full"
            onMouseDown={handleRecordingStart}
            onMouseUp={() => !isRecordingLocked && handleRecordingStop()}
            onMouseLeave={() => !isRecordingLocked && isRecording && handleRecordingCancel()}
            onTouchStart={handleRecordingStart}
            onTouchEnd={() => !isRecordingLocked && handleRecordingStop()}
          >
            <Mic className="w-6 h-6" />
          </Button>
        )}
      </div>
    </div>
  );
};
