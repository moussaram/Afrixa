import { Product } from '@/types/marketplace';
import { formatNumber } from '@/lib/formatters';
import { ShoppingBag, Star } from 'lucide-react';

interface ProductCardProps { product: Product; onView?: (product: Product) => void; }

export const ProductCard = ({ product, onView }: ProductCardProps) => (
  <button type="button" onClick={()=>onView?.(product)} aria-label={`Voir le produit ${product.name}`} className="group min-w-0 overflow-hidden rounded-xl border border-border/30 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <div className="relative aspect-square overflow-hidden bg-muted"><img src={product.imageUrl||'/placeholder.svg'} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />{product.sellerVerified&&<span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Vérifié</span>}{product.promoPrice&&product.promoPrice>0&&product.promoPrice<product.price&&<span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground">Promo</span>}</div>
    <div className="p-2.5"><h3 className="line-clamp-2 min-h-10 text-xs font-medium leading-5 text-foreground sm:text-sm">{product.name}</h3><p className="mt-1 text-sm font-extrabold text-primary">{product.price.toLocaleString('fr-FR')} {product.currency}</p><div className="mt-1.5 flex items-center justify-between gap-1">{product.rating!==null&&product.rating>0?<span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{product.rating.toFixed(1)}</span>:<span className="text-[10px] text-muted-foreground">Nouveau</span>}<span className="truncate text-[10px] text-muted-foreground">{formatNumber(product.sales)} vendus</span></div><span className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary"><ShoppingBag className="h-3.5 w-3.5" />Voir le produit</span></div>
  </button>
);
