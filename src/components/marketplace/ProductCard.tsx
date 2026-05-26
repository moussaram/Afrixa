import { Product } from '@/types/marketplace';
import { formatNumber } from '@/lib/formatters';
import { ShoppingBag, Star } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onView?: (product: Product) => void;
}

export const ProductCard = ({ product, onView }: ProductCardProps) => {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/20 bg-card/30 backdrop-blur-sm"
      onClick={() => onView?.(product)}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {product.sellerVerified && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/90 backdrop-blur-sm flex items-center gap-1">
            <span className="text-[10px] text-primary-foreground font-bold">✅ Vérifié</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-background/80 backdrop-blur-sm">
          <span className="text-sm font-bold text-foreground">
            {product.price.toLocaleString()} {product.currency}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{product.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <img
            src={product.sellerAvatar}
            alt={product.sellerName}
            className="w-4 h-4 rounded-full object-cover"
          />
          <span className="text-xs text-muted-foreground truncate">{product.sellerName}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-muted-foreground">{product.rating}</span>
          </div>
          <span className="text-xs text-muted-foreground">{formatNumber(product.sales)} vendus</span>
        </div>
        <button className="w-full mt-2 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" />
          Voir
        </button>
      </div>
    </div>
  );
};
