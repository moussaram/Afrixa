import { useState } from 'react';
import { TrendingUp, Package, ShoppingBag, Store } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { ShopCard } from './ShopCard';
import { ShoppableVideoCard } from './ShoppableVideoCard';
import { mockProducts, mockShops, mockShoppableVideos, marketplaceCategories } from '@/data/mockMarketplace';
import { cn } from '@/lib/utils';

export const MarketplaceContent = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredProducts = activeCategory
    ? mockProducts.filter(p => p.category.toLowerCase() === activeCategory)
    : mockProducts;

  return (
    <div className="animate-fade-in">
      {/* Categories chips */}
      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Catégories</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all',
              !activeCategory
                ? 'gradient-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Tout
          </button>
          {marketplaceCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
              className={cn(
                'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all flex items-center gap-1.5',
                activeCategory === cat.id
                  ? 'gradient-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Trending products */}
      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Produits tendance</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Shoppable videos */}
      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Vidéos shoppables</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
          {mockShoppableVideos.map(video => (
            <ShoppableVideoCard key={video.id} video={video} />
          ))}
        </div>
      </section>

      {/* Verified shops */}
      <section className="px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Store className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Boutiques vérifiées</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {mockShops.map(shop => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      </section>
    </div>
  );
};
