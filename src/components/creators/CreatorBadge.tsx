import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { creatorLevelColor, creatorLevelLabel } from '@/lib/creatorFormatters';

type CreatorBadgeProps = {
  level?: string | null;
  compact?: boolean;
};

export const CreatorBadge = ({ level = 'starter', compact = false }: CreatorBadgeProps) => {
  const safeLevel = level || 'starter';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
        creatorLevelColor[safeLevel] ?? creatorLevelColor.starter
      )}
    >
      <Star className="h-3.5 w-3.5 fill-current" />
      {compact ? 'Creator' : `Creator ${creatorLevelLabel[safeLevel] ?? creatorLevelLabel.starter}`}
    </span>
  );
};
