import { cn } from '@/lib/utils';

/**
 * Base shimmer block. Uses dark indigo tones consistent with the Afrixa theme.
 */
const Shimmer = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'animate-pulse rounded-md',
      'bg-[#2D2D4E]',
      className
    )}
    style={{
      backgroundImage:
        'linear-gradient(90deg, #2D2D4E 0%, #3D3D5E 50%, #2D2D4E 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }}
  />
);

/** Product card skeleton (160px image + 2 text lines) */
export const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <Shimmer className="h-40 w-full rounded-2xl" />
    <Shimmer className="h-3 w-3/4" />
    <Shimmer className="h-3 w-1/2" />
  </div>
);

/** Video thumbnail skeleton (9/16 + avatar + 2 lines) */
export const SkeletonVideo = ({ className }: { className?: string }) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <Shimmer className="w-full aspect-[9/16] rounded-xl" />
    <div className="flex items-center gap-2">
      <Shimmer className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-2.5 w-2/3" />
        <Shimmer className="h-2.5 w-1/3" />
      </div>
    </div>
  </div>
);

/** Profile header skeleton (avatar + 3 lines) */
export const SkeletonProfile = ({ className }: { className?: string }) => (
  <div className={cn('flex flex-col items-center gap-3 p-6', className)}>
    <Shimmer className="h-20 w-20 rounded-full" />
    <Shimmer className="h-4 w-32" />
    <Shimmer className="h-3 w-48" />
    <Shimmer className="h-3 w-40" />
  </div>
);

/** List skeleton (N rows with avatar + 2 lines) */
export const SkeletonList = ({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-3', className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Shimmer className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3 w-2/3" />
          <Shimmer className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

/** Grid of product skeletons */
export const SkeletonProductGrid = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-3 p-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
