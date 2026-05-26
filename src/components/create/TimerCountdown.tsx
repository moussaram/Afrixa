import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TimerCountdownProps {
  seconds: number;
  onComplete: () => void;
  isActive: boolean;
}

export const TimerCountdown = ({ seconds, onComplete, isActive }: TimerCountdownProps) => {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (!isActive) {
      setCount(seconds);
      return;
    }

    if (count === 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, isActive, onComplete, seconds]);

  if (!isActive || count === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative">
        {/* Animated ring */}
        <svg className="w-40 h-40 -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-muted/30"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="url(#countdownGradient)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * (seconds - count)) / seconds}
            className="transition-all duration-1000 ease-linear"
          />
          <defs>
            <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span 
            key={count}
            className={cn(
              "text-7xl font-bold text-foreground animate-scale-in",
            )}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <p className="absolute bottom-1/4 text-muted-foreground text-lg">
        Préparez-vous...
      </p>
    </div>
  );
};
