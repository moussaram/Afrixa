import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, Package, ShoppingBag, Store, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ProductCard } from './ProductCard';
import { ShopCard } from './ShopCard';
import { ShoppableVideoCard } from './ShoppableVideoCard';
import { ProductBottomSheet } from './ProductBottomSheet';
import type { Product, Shop, ShoppableVideo } from '@/types/marketplace';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const categories = [
  { id: 'Mode', label: 'Mode', icon: '👗' },
  { id: 'Électronique', label: 'Électronique', icon: '📱' },
  { id: 'Beauté', label: 'Beauté', icon: '💄' },
  { id: 'Artisanat', label: 'Artisanat', icon: '🎨' },
  { id: 'Alimentation', label: 'Alimentation', icon: '🍽️' },
  { id: 'Maison', label: 'Maison', icon: '🏠' },
];

type PublicSeller = {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
};

const sellerLabel = (seller?: PublicSeller) =>
  seller?.username || [seller?.prenom, seller?.nom].filter(Boolean).join(' ') || 'Vendeur Afrixa';

export const MarketplaceContent = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [videos, setVideos] = useState<ShoppableVideo[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (pageToLoad: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('products')
        .select('id, name, description, price, promo_price, category, seller_id, images, stock, unlimited_stock, city, country, views_count, sales_count, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(pageToLoad * PAGE_SIZE, pageToLoad * PAGE_SIZE + PAGE_SIZE - 1);

      if (activeCategory) query = query.eq('category', activeCategory);
      if (search.trim()) query = query.ilike('name', `%${search.trim().slice(0, 80)}%`);

      const { data: rows, error: productsError } = await query;
      if (productsError) throw productsError;
      const productRows = rows ?? [];
      const sellerIds = [...new Set(productRows.map(row => row.seller_id))];
      const { data: sellerRows, error: sellersError } = sellerIds.length
        ? await supabase.from('public_profiles')
          .select('user_id, username, prenom, nom, avatar_url, bio')
          .in('user_id', sellerIds)
        : { data: [], error: null };
      if (sellersError) throw sellersError;

      const sellerMap = new Map((sellerRows ?? []).map(seller => [seller.user_id, seller as PublicSeller]));
      const productIds = productRows.map(row => row.id);
      const { data: relatedOrders, error: ordersError } = productIds.length
        ? await supabase.from('orders').select('id, product_id').in('product_id', productIds)
        : { data: [], error: null };
      if (ordersError) throw ordersError;
      const orderIds = (relatedOrders ?? []).map(order => order.id);
      const { data: reviewRows, error: reviewsError } = orderIds.length
        ? await supabase.from('reviews').select('order_id, rating').in('order_id', orderIds)
        : { data: [], error: null };
      if (reviewsError) throw reviewsError;
      const orderProductMap = new Map((relatedOrders ?? []).map(order => [order.id, order.product_id]));
      const ratingTotals = new Map<string, { total: number; count: number }>();
      for (const review of reviewRows ?? []) {
        const productId = orderProductMap.get(review.order_id);
        if (!productId) continue;
        const current = ratingTotals.get(productId) ?? { total: 0, count: 0 };
        ratingTotals.set(productId, { total: current.total + review.rating, count: current.count + 1 });
      }
      const mappedProducts: Product[] = productRows.map(row => {
        const seller = sellerMap.get(row.seller_id);
        return {
          id: row.id,
          name: row.name,
          description: row.description ?? '',
          price: row.promo_price && row.promo_price > 0 && row.promo_price < row.price ? row.promo_price : row.price,
          currency: 'FCFA',
          imageUrl: row.images?.[0] ?? '',
          category: row.category,
          sellerId: row.seller_id,
          sellerName: sellerLabel(seller),
          sellerAvatar: seller?.avatar_url ?? '',
          sellerVerified: false,
          stock: row.unlimited_stock ? -1 : row.stock ?? 0,
          city: row.city ?? '',
          country: row.country ?? '',
          views: row.views_count ?? 0,
          sales: row.sales_count ?? 0,
          rating: ratingTotals.has(row.id) ? Number((ratingTotals.get(row.id)!.total / ratingTotals.get(row.id)!.count).toFixed(1)) : 0,
          createdAt: row.created_at,
        };
      });

      setProducts(current => append ? [...current, ...mappedProducts] : mappedProducts);
      setHasMore(productRows.length === PAGE_SIZE);
      setPage(pageToLoad);

      if (!append) {
        const bySeller = new Map<string, Product[]>();
        for (const product of mappedProducts) {
          bySeller.set(product.sellerId, [...(bySeller.get(product.sellerId) ?? []), product]);
        }
        setShops([...bySeller.entries()].map(([sellerId, items]) => {
          const seller = sellerMap.get(sellerId);
          return {
            id: sellerId,
            name: sellerLabel(seller),
            avatar: seller?.avatar_url ?? '',
            description: seller?.bio ?? 'Boutique sur Afrixa',
            verified: false,
            productCount: items.length,
            followers: 0,
            rating: 0,
            city: items[0]?.city ?? '',
            country: items[0]?.country ?? '',
          };
        }));

        const { data: videoRows, error: videosError } = productIds.length
          ? await supabase.from('videos')
            .select('id, user_id, title, hls_url, thumbnail_url, views_count, tagged_products')
            .eq('is_published', true)
            .eq('moderation_status', 'approved')
            .eq('cloudflare_status', 'ready')
            .order('created_at', { ascending: false })
            .limit(12)
          : { data: [], error: null };
        if (videosError) throw videosError;

        const videoRowsWithProduct = (videoRows ?? []).flatMap(video => {
          const productId = (video.tagged_products ?? []).find(id => productIds.includes(id));
          const product = productId ? mappedProducts.find(item => item.id === productId) : undefined;
          return product ? [{ video, product }] : [];
        });
        const videoSellerIds = [...new Set(videoRowsWithProduct.map(item => item.video.user_id))];
        const { data: videoSellers, error: videoSellersError } = videoSellerIds.length
          ? await supabase.from('public_profiles')
            .select('user_id, username, prenom, nom, avatar_url, bio')
            .in('user_id', videoSellerIds)
          : { data: [], error: null };
        if (videoSellersError) throw videoSellersError;
        const videoSellerMap = new Map((videoSellers ?? []).map(seller => [seller.user_id, seller as PublicSeller]));
        setVideos(videoRowsWithProduct.map(({ video, product }) => ({
          id: video.id,
          thumbnailUrl: video.thumbnail_url || product.imageUrl,
          videoUrl: video.hls_url,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productCurrency: product.currency,
          productImage: product.imageUrl,
          views: video.views_count ?? 0,
          sellerName: sellerLabel(videoSellerMap.get(video.user_id)),
        })));
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Impossible de charger le Marketplace.';
      setError(message);
      if (append) toast.error(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory, search]);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const filteredCountLabel = useMemo(() => products.length === 1 ? '1 produit' : `${products.length} produits`, [products.length]);

  const loadMore = () => {
    if (!loadingMore && hasMore) void loadPage(page + 1, true);
  };

  return (
    <div className="animate-fade-in">
      <section className="px-4 py-4 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border/30 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </section>

      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Catégories</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn('px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all', !activeCategory ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
          >
            Tout
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(current => current === category.id ? null : category.id)}
              className={cn('px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all flex items-center gap-1.5', activeCategory === category.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              <span>{category.icon}</span>{category.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <button onClick={() => void loadPage(0, false)} className="ml-3 underline">Réessayer</button>
        </div>
      )}

      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Produits</h2>
          </div>
          <span className="text-xs text-muted-foreground">{filteredCountLabel}</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : products.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun produit disponible pour cette recherche.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(product => <ProductCard key={product.id} product={product} onView={setSelectedProduct} />)}
          </div>
        )}
        {hasMore && (
          <button onClick={loadMore} disabled={loadingMore} className="w-full mt-4 py-3 rounded-xl border border-border/40 text-sm font-semibold text-foreground disabled:opacity-60">
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Charger plus'}
          </button>
        )}
      </section>

      {videos.length > 0 && (
        <section className="px-4 py-4 border-b border-border/20">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Vidéos shoppables</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {videos.map(video => (
              <ShoppableVideoCard key={video.id} video={video} onView={() => {
                const product = products.find(item => item.id === video.productId);
                if (product) setSelectedProduct(product);
              }} />
            ))}
          </div>
        </section>
      )}

      {shops.length > 0 && (
        <section className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Boutiques présentes</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {shops.map(shop => <ShopCard key={shop.id} shop={shop} onView={() => navigate(`/user/${shop.id}`)} />)}
          </div>
        </section>
      )}

      {selectedProduct && <ProductBottomSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </div>
  );
};
