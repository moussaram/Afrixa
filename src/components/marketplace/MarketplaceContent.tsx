import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Package, ShoppingBag, Store, Loader2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { ShopCard } from './ShopCard';
import { ShoppableVideoCard } from './ShoppableVideoCard';
import { marketplaceCategories } from '@/data/mockMarketplace';
import { ProductBottomSheet } from './ProductBottomSheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Product, Shop, ShoppableVideo } from '@/types/marketplace';

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  promo_price: number | null;
  currency: string;
  product_type: 'physical' | 'digital';
  seller_id: string;
  stock: number | null;
  unlimited_stock: boolean | null;
  images: string[] | null;
  city: string | null;
  country: string | null;
  views_count: number | null;
  sales_count: number | null;
  created_at: string;
};
type SellerProfile = {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
};

const normalizeCategory = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const MarketplaceContent = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shoppableVideos, setShoppableVideos] = useState<ShoppableVideo[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadMarketplace = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id,name,description,category,price,promo_price,currency,product_type,seller_id,stock,unlimited_stock,images,city,country,views_count,sales_count,created_at')
          .eq('is_active', true)
          .eq('publication_status', 'published')
          .is('deleted_at', null)
          .order('sales_count', { ascending: false })
          .order('created_at', { ascending: false })
          .range(0, 59);
        if (productError) throw productError;

        const rows = (productData || []) as ProductRow[];
        const sellerIds = Array.from(new Set(rows.map(row => row.seller_id)));
        const { data: sellerData, error: sellerError } = sellerIds.length
          ? await supabase.from('profiles')
              .select('user_id,username,prenom,nom,avatar_url,bio')
              .in('user_id', sellerIds)
          : { data: [], error: null };
        if (sellerError) throw sellerError;

        const sellerMap = new Map((sellerData || []).map(profile => [profile.user_id, profile as SellerProfile]));
        const mappedProducts: Product[] = rows.map(row => {
          const seller = sellerMap.get(row.seller_id);
          const sellerName = [seller?.prenom, seller?.nom].filter(Boolean).join(' ')
            || seller?.username || 'Boutique Afrixa';
          return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            price: row.promo_price && row.promo_price > 0 && row.promo_price < row.price ? row.promo_price : row.price,
            currency: row.currency || 'XOF',
            imageUrl: row.images?.[0] || '/placeholder.svg',
            category: row.category,
            sellerId: row.seller_id,
            sellerName,
            sellerAvatar: seller?.avatar_url || '/placeholder.svg',
            sellerVerified: false,
            stock: row.stock ?? 0,
            city: row.city || '',
            country: row.country || '',
            views: row.views_count || 0,
            sales: row.sales_count || 0,
            rating: 0,
            createdAt: row.created_at,
            productType: row.product_type,
            promoPrice: row.promo_price,
            unlimitedStock: row.unlimited_stock ?? false,
          };
        });

        const shopMap = new Map<string, Shop>();
        for (const row of rows) {
          const seller = sellerMap.get(row.seller_id);
          if (!shopMap.has(row.seller_id)) {
            shopMap.set(row.seller_id, {
              id: row.seller_id,
              name: [seller?.prenom, seller?.nom].filter(Boolean).join(' ') || seller?.username || 'Boutique Afrixa',
              avatar: seller?.avatar_url || '/placeholder.svg',
              description: seller?.bio || '',
              verified: false,
              productCount: 0,
              followers: 0,
              rating: 0,
              city: row.city || '',
              country: row.country || '',
            });
          }
          shopMap.get(row.seller_id)!.productCount += 1;
        }

        const { data: videoRows, error: videoError } = await supabase
          .from('videos')
          .select('id,user_id,hls_url,thumbnail_url,views_count,tagged_products')
          .eq('is_published', true)
          .not('tagged_products', 'is', null)
          .order('created_at', { ascending: false })
          .limit(30);
        if (videoError) throw videoError;
        const productById = new Map(mappedProducts.map(product => [product.id, product]));
        const videoAuthorIds = Array.from(new Set((videoRows || []).map(video => video.user_id)));
        const { data: videoProfiles, error: videoProfilesError } = videoAuthorIds.length
          ? await supabase.from('profiles').select('user_id,username,prenom,nom,avatar_url,bio').in('user_id', videoAuthorIds)
          : { data: [], error: null };
        if (videoProfilesError) throw videoProfilesError;
        const videoProfileMap = new Map((videoProfiles || []).map(profile => [profile.user_id, profile as SellerProfile]));
        const mappedVideos: ShoppableVideo[] = (videoRows || []).flatMap(video => {
          const tagged = (video.tagged_products || []).find(productId => productById.has(productId));
          if (!tagged) return [];
          const product = productById.get(tagged)!;
          const seller = videoProfileMap.get(video.user_id);
          return [{
            id: video.id,
            thumbnailUrl: video.thumbnail_url || product.imageUrl,
            videoUrl: video.hls_url,
            productId: product.id,
            productName: product.name,
            productPrice: product.price,
            productCurrency: product.currency,
            productImage: product.imageUrl,
            views: video.views_count || 0,
            sellerName: [seller?.prenom, seller?.nom].filter(Boolean).join(' ') || seller?.username || product.sellerName,
          }];
        });

        if (!active) return;
        setProducts(mappedProducts);
        setShops(Array.from(shopMap.values()));
        setShoppableVideos(mappedVideos);
      } catch (loadError) {
        console.error('Marketplace load failed', loadError);
        if (active) {
          setError("Le catalogue n’a pas pu être chargé. Réessayez.");
          setProducts([]);
          setShops([]);
          setShoppableVideos([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMarketplace();
    return () => { active = false; };
  }, []);

  const filteredProducts = useMemo(() => activeCategory
    ? products.filter(product => normalizeCategory(product.category) === activeCategory)
    : products, [activeCategory, products]);

  return (
    <div className="animate-fade-in">
      <section className="px-4 py-4 border-b border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Catégories</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <button onClick={() => setActiveCategory(null)} className={cn(
            'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all',
            !activeCategory ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}>Tout</button>
          {marketplaceCategories.map(category => (
            <button key={category.id} onClick={() => setActiveCategory(category.id === activeCategory ? null : category.id)} className={cn(
              'px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all flex items-center gap-1.5',
              activeCategory === category.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}>
              <span>{category.icon}</span>{category.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement du catalogue…
        </div>
      ) : error ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <>
          <section className="px-4 py-4 border-b border-border/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Produits disponibles</h2>
            </div>
            {filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun produit publié dans cette catégorie.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onView={setSelectedProduct} />
                ))}
              </div>
            )}
          </section>

          {shoppableVideos.length > 0 && (
            <section className="px-4 py-4 border-b border-border/20">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Vidéos shoppables</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                {shoppableVideos.map(video => <ShoppableVideoCard key={video.id} video={video} />)}
              </div>
            </section>
          )}

          <section className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Boutiques présentes</h2>
            </div>
            {shops.length ? (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {shops.map(shop => <ShopCard key={shop.id} shop={shop} />)}
              </div>
            ) : <p className="text-sm text-muted-foreground">Aucune boutique publiée pour le moment.</p>}
          </section>
        </>
      )}

      {selectedProduct && (
        <ProductBottomSheet
          product={{
            id: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            currency: selectedProduct.currency,
            imageUrl: selectedProduct.imageUrl,
            sellerName: selectedProduct.sellerName,
            sellerId: selectedProduct.sellerId,
            sellerVerified: selectedProduct.sellerVerified,
            productType: selectedProduct.productType,
            stock: selectedProduct.stock,
            city: selectedProduct.city,
            country: selectedProduct.country,
          }}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};

export { MarketplaceContent };
