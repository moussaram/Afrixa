import { cn } from '@/lib/utils';
import { durationTabs, type DurationMode } from './duration';

interface DurationTabsProps {
  selected: DurationMode;
  onSelect: (mode: DurationMode) => void;
  disabled?: boolean;
}

export const DurationTabs = ({ selected, onSelect, disabled }: DurationTabsProps) => {
  return (
    <div className="flex items-center justify-center gap-4">
      {durationTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !disabled && onSelect(tab.id)}
          disabled={disabled}
          className={cn(
            "relative px-3 py-2 text-sm font-medium transition-all duration-200",
            selected === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {tab.label}
          {selected === tab.id && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 gradient-primary rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};
