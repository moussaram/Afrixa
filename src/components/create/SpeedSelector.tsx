import { cn } from '@/lib/utils';
import { speeds, type SpeedValue } from './speed';

interface SpeedSelectorProps {
  selected: SpeedValue;
  onSelect: (speed: SpeedValue) => void;
  disabled?: boolean;
}

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
