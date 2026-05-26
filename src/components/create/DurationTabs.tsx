import { cn } from '@/lib/utils';

export type DurationMode = '15s' | '60s' | '3min' | '10min' | 'photo';

interface DurationTabsProps {
  selected: DurationMode;
  onSelect: (mode: DurationMode) => void;
  disabled?: boolean;
}

const tabs: { id: DurationMode; label: string }[] = [
  { id: '15s', label: '15s' },
  { id: '60s', label: '60s' },
  { id: '3min', label: '3min' },
  { id: '10min', label: '10min' },
  { id: 'photo', label: 'Photo' },
];

export const DurationTabs = ({ selected, onSelect, disabled }: DurationTabsProps) => {
  return (
    <div className="flex items-center justify-center gap-4">
      {tabs.map((tab) => (
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

export const getDurationSeconds = (mode: DurationMode): number => {
  switch (mode) {
    case '15s': return 15;
    case '60s': return 60;
    case '3min': return 180;
    case '10min': return 600;
    case 'photo': return 0;
    default: return 60;
  }
};
