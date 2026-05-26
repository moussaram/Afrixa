import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export const SettingsSection = ({ title, children, className }: SettingsSectionProps) => {
  return (
    <div className={cn("mb-6", className)}>
      <h3 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary">
        {title}
      </h3>
      <div className="bg-card/30 rounded-xl mx-2 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  );
};
