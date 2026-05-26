import { ChevronRight, LucideIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingsItemProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  value?: string;
  type?: 'navigate' | 'toggle' | 'action' | 'info';
  checked?: boolean;
  onToggle?: (checked: boolean) => void;
  onClick?: () => void;
  danger?: boolean;
  className?: string;
}

export const SettingsItem = ({
  icon: Icon,
  label,
  description,
  value,
  type = 'navigate',
  checked,
  onToggle,
  onClick,
  danger = false,
  className,
}: SettingsItemProps) => {
  const handleClick = () => {
    if (type === 'toggle' && onToggle) {
      onToggle(!checked);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 transition-colors",
        "hover:bg-muted/30 active:bg-muted/50",
        danger && "text-destructive",
        className
      )}
    >
      {Icon && (
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center",
          danger ? "bg-destructive/10" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            danger ? "text-destructive" : "text-primary"
          )} />
        </div>
      )}
      
      <div className="flex-1 text-left">
        <p className={cn(
          "font-medium",
          danger ? "text-destructive" : "text-foreground"
        )}>
          {label}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>

      {type === 'toggle' && (
        <Switch 
          checked={checked} 
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {type === 'navigate' && (
        <div className="flex items-center gap-2">
          {value && (
            <span className="text-sm text-muted-foreground">{value}</span>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      {type === 'info' && value && (
        <span className="text-sm text-muted-foreground">{value}</span>
      )}
    </button>
  );
};
