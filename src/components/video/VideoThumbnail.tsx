import { Play } from 'lucide-react';
import { Video } from '@/types';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface VideoThumbnailProps {
  video: Video;
  onClick?: () => void;
  showViews?: boolean;
  className?: string;
}

export const VideoThumbnail = ({ 
  video, 
  onClick, 
  showViews = true,
  className 
}: VideoThumbnailProps) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "card-video cursor-pointer group",
        className
      )}
    >
      <img
        src={video.thumbnailUrl}
        alt={video.description}
        className="w-full h-full object-cover"
      />
      
      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-12 h-12 rounded-full glass-light flex items-center justify-center">
          <Play className="w-6 h-6 text-foreground ml-0.5" fill="currentColor" />
        </div>
      </div>

      {/* Views count */}
      {showViews && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-foreground text-xs font-medium">
          <Play className="w-3 h-3" fill="currentColor" />
          <span>{formatNumber(video.views)}</span>
        </div>
      )}
    </div>
  );
};
