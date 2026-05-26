import { ShoppableVideo } from '@/types/marketplace';
import { ShoppingCart, Play } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';

interface ShoppableVideoCardProps {
  video: ShoppableVideo;
  onView?: (video: ShoppableVideo) => void;
}

export const ShoppableVideoCard = ({ video, onView }: ShoppableVideoCardProps) => {
  return (
    <button
      onClick={() => onView?.(video)}
      className="relative min-w-[140px] aspect-[9/16] rounded-2xl overflow-hidden group"
    >
      <img
        src={video.thumbnailUrl}
        alt={video.productName}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

      {/* Shopping cart badge */}
      <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center">
        <ShoppingCart className="w-4 h-4 text-primary-foreground" />
      </div>

      {/* Play icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-10 h-10 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-5 h-5 text-foreground ml-0.5" fill="currentColor" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-xs font-semibold text-foreground line-clamp-1">{video.productName}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-bold text-primary">
            {video.productPrice.toLocaleString()} {video.productCurrency}
          </span>
          <span className="text-[10px] text-muted-foreground">{formatNumber(video.views)} vues</span>
        </div>
      </div>
    </button>
  );
};
