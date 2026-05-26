import { cn } from '@/lib/utils';
import { Camera } from 'lucide-react';

interface RecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  isPhotoMode: boolean;
  progress: number; // 0-100
  onRecord: () => void;
  onStop: () => void;
  onCapture: () => void;
  disabled?: boolean;
}

export const RecordButton = ({
  isRecording,
  isPaused,
  isPhotoMode,
  progress,
  onRecord,
  onStop,
  onCapture,
  disabled,
}: RecordButtonProps) => {
  const handleClick = () => {
    if (disabled) return;
    
    if (isPhotoMode) {
      onCapture();
      return;
    }
    
    if (isRecording) {
      onStop();
    } else {
      onRecord();
    }
  };

  const circumference = 2 * Math.PI * 46;
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative transition-transform duration-200 active:scale-95",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Progress ring */}
      <svg className="w-24 h-24 -rotate-90">
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r="46"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-muted/50"
        />
        {/* Progress circle */}
        <circle
          cx="48"
          cy="48"
          r="46"
          stroke="url(#recordGradient)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-100"
        />
        <defs>
          <linearGradient id="recordGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--secondary))" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center button */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isPhotoMode ? (
          <div className="w-16 h-16 rounded-full bg-foreground/90 flex items-center justify-center shadow-lg">
            <Camera className="w-8 h-8 text-background" />
          </div>
        ) : (
          <div
            className={cn(
              "transition-all duration-300 shadow-lg",
              isRecording && !isPaused
                ? "w-8 h-8 bg-destructive rounded-md"
                : isPaused
                ? "w-14 h-14 gradient-primary rounded-full animate-pulse"
                : "w-16 h-16 gradient-primary rounded-full"
            )}
          />
        )}
      </div>

      {/* Glow effect */}
      {!isRecording && !isPhotoMode && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-primary/20 animate-pulse-glow" />
        </div>
      )}
    </button>
  );
};
