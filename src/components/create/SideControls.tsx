import { SwitchCamera, Zap, Timer, Sparkles, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlashMode } from '@/hooks/useCamera';

export type TimerValue = 0 | 3 | 10;

interface SideControlsProps {
  flashMode: FlashMode;
  timerValue: TimerValue;
  onToggleCamera: () => void;
  onCycleFlash: () => void;
  onOpenTimer: () => void;
  onOpenEffects: () => void;
  onOpenBeauty: () => void;
  disabled?: boolean;
}

export const SideControls = ({
  flashMode,
  timerValue,
  onToggleCamera,
  onCycleFlash,
  onOpenTimer,
  onOpenEffects,
  onOpenBeauty,
  disabled,
}: SideControlsProps) => {
  const controls = [
    {
      id: 'flip',
      icon: SwitchCamera,
      label: 'Retourner',
      onClick: onToggleCamera,
      active: false,
    },
    {
      id: 'flash',
      icon: Zap,
      label: flashMode === 'off' ? 'Flash' : flashMode === 'auto' ? 'Auto' : 'On',
      onClick: onCycleFlash,
      active: flashMode !== 'off',
      fill: flashMode === 'on',
    },
    {
      id: 'timer',
      icon: Timer,
      label: timerValue > 0 ? `${timerValue}s` : 'Timer',
      onClick: onOpenTimer,
      active: timerValue > 0,
    },
    {
      id: 'effects',
      icon: Sparkles,
      label: 'Effets',
      onClick: onOpenEffects,
      active: false,
    },
    {
      id: 'beauty',
      icon: Smile,
      label: 'Beauté',
      onClick: onOpenBeauty,
      active: false,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {controls.map((control) => (
        <button
          key={control.id}
          onClick={control.onClick}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1 transition-all duration-200",
            control.active ? "text-primary" : "text-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className={cn(
            "p-3 glass rounded-full transition-all duration-200",
            control.active && "ring-2 ring-primary/50"
          )}>
            <control.icon 
              className="w-6 h-6" 
              fill={control.fill ? "currentColor" : "none"}
            />
          </div>
          <span className="text-xs font-medium">{control.label}</span>
        </button>
      ))}
    </div>
  );
};
