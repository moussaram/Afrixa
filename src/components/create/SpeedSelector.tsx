import { cn } from '@/lib/utils';

export type SpeedValue = '0.3x' | '0.5x' | '1x' | '2x' | '3x';

interface SpeedSelectorProps {
  selected: SpeedValue;
  onSelect: (speed: SpeedValue) => void;
  disabled?: boolean;
}

const speeds: SpeedValue[] = ['0.3x', '0.5x', '1x', '2x', '3x'];

export const SpeedSelector = ({ selected, onSelect, disabled }: SpeedSelectorProps) => {
  return (
    <div className="flex items-center gap-1 p-1 glass rounded-full">
      {speeds.map((speed) => (
        <button
          key={speed}
          onClick={() => !disabled && onSelect(speed)}
          disabled={disabled}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            selected === speed
              ? "gradient-primary text-primary-foreground shadow-lg"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {speed}
        </button>
      ))}
    </div>
  );
};

export const getSpeedMultiplier = (speed: SpeedValue): number => {
  switch (speed) {
    case '0.3x': return 0.3;
    case '0.5x': return 0.5;
    case '1x': return 1;
    case '2x': return 2;
    case '3x': return 3;
    default: return 1;
  }
};
