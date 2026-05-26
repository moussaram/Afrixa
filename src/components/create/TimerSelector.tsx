import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { TimerValue } from './SideControls';

interface TimerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  value: TimerValue;
  onSelect: (value: TimerValue) => void;
}

const timerOptions: { value: TimerValue; label: string; description: string }[] = [
  { value: 0, label: 'Désactivé', description: 'Pas de compte à rebours' },
  { value: 3, label: '3 secondes', description: 'Compte à rebours rapide' },
  { value: 10, label: '10 secondes', description: 'Plus de temps pour se préparer' },
];

export const TimerSelector = ({ isOpen, onClose, value, onSelect }: TimerSelectorProps) => {
  const handleSelect = (newValue: TimerValue) => {
    onSelect(newValue);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Timer</SheetTitle>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-2 pb-6">
          {timerOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl transition-all",
                value === option.value
                  ? "bg-primary/10 ring-1 ring-primary"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              <div className="text-left">
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {value === option.value && (
                <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
