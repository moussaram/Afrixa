import { Shop } from '@/types/marketplace';
import { formatNumber } from '@/lib/formatters';
import { CheckCircle } from 'lucide-react';

interface ShopCardProps {
  shop: Shop;
  onView?: (shop: Shop) => void;
}

export const ShopCard = ({ shop, onView }: ShopCardProps) => {
  return (
    <button
      onClick={() => onView?.(shop)}
      className="min-w-[160px] p-4 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm text-left hover:bg-card/50 transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <img
            src={shop.avatar}
            alt={shop.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
          />
          {shop.verified && (
            <CheckCircle className="absolute -bottom-0.5 -right-0.5 w-5 h-5 text-primary fill-background" />
          )}
        </div>
      </div>
      <h4 className="text-sm font-semibold text-foreground truncate">{shop.name}</h4>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{shop.description}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-muted-foreground">{shop.productCount} produits</span>
        <span className="text-xs text-muted-foreground">{formatNumber(shop.followers)} abonnés</span>
      </div>
    </button>
  );
};
