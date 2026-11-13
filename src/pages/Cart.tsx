import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { AfrixaPayment } from '@/components/payment/AfrixaPayment';

type CartRow = { id: string; product_id: string; variant_id: string | null; quantity: number };
type ProductRow = {
  id: string; name: string; price: number; promo_price: number | null; images: string[] | null;
  seller_id: string; stock: number | null; unlimited_stock: boolean | null; is_active: boolean;
};
type VariantRow = { id: string; name: string; price: number | null; stock: number; is_active: boolean };
type SellerRow = { user_id: string; username: string | null; prenom: string | null; nom: string | null; avatar_url: string | null };

type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  sellerId: string;
  sellerName: string;
  stock: number;
};

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkoutItem, setCheckoutItem] = useState<CartLine | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cartRows, error: cartError } = await (supabase as any).from('cart_items')
        .select('id, product_id, variant_id, quantity')
        .eq('buyer_id', user.id)
        .order('updated_at', { ascending: false });
      if (cartError) throw cartError;
      const rows = (cartRows ?? []) as CartRow[];
      if (!rows.length) {
        setItems([]);
        return;
      }

      const productIds: string[] = Array.from(new Set<string>(rows.map(row => row.product_id)));
      const variantIds: string[] = Array.from(new Set<string>(rows.map(row => row.variant_id).filter((id): id is string => Boolean(id))));
      const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
        supabase.from('products')
          .select('id, name, price, promo_price, images, seller_id, stock, unlimited_stock, is_active')
          .in('id', productIds),
        variantIds.length
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any).from('product_variants').select('id, name, price, stock, is_active').in('id', variantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (productsError) throw productsError;
      if (variantsError) throw variantsError;

      const sellerIds = [...new Set((products ?? []).map(product => product.seller_id))];
      const { data: sellers, error: sellersError } = sellerIds.length
        ? await supabase.from('public_profiles').select('user_id, username, prenom, nom, avatar_url').in('user_id', sellerIds)
        : { data: [], error: null };
      if (sellersError) throw sellersError;

      const productMap = new Map<string, ProductRow>((products ?? []).map(product => [product.id, product as ProductRow]));
      const variantMap = new Map<string, VariantRow>((variants ?? []).map((variant: VariantRow) => [variant.id, variant]));
      const sellerMap = new Map<string, SellerRow>((sellers ?? []).map(seller => [seller.user_id, seller as SellerRow]));
      setItems(rows.flatMap((row: CartRow) => {
        const product = productMap.get(row.product_id);
        if (!product || !product.is_active) return [];
        const variant = row.variant_id ? variantMap.get(row.variant_id) : null;
        if (row.variant_id && (!variant || !variant.is_active)) return [];
        const seller = sellerMap.get(product.seller_id);
        const price = variant?.price ?? (product.promo_price && product.promo_price > 0 && product.promo_price < product.price ? product.promo_price : product.price);
        return [{
          id: row.id,
          productId: product.id,
          variantId: row.variant_id,
          quantity: row.quantity,
          name: variant ? `${product.name} · ${variant.name}` : product.name,
          price,
          currency: 'FCFA',
          imageUrl: product.images?.[0] ?? '',
          sellerId: product.seller_id,
          sellerName: seller?.username || [seller?.prenom, seller?.nom].filter(Boolean).join(' ') || 'Vendeur Afrixa',
          stock: product.unlimited_stock ? -1 : variant?.stock ?? product.stock ?? 0,
        }];
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger le panier.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadCart(); }, [loadCart]);

  const updateQuantity = async (item: CartLine, quantity: number) => {
    if (quantity < 1 || quantity > 50) return;
    setBusyId(item.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any).from('cart_items')
        .update({ quantity })
        .eq('id', item.id)
        .eq('buyer_id', user?.id);
      if (updateError) throw updateError;
      await loadCart();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : 'Quantité impossible à modifier.');
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (item: CartLine) => {
    setBusyId(item.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: removeError } = await (supabase as any).from('cart_items')
        .delete().eq('id', item.id).eq('buyer_id', user?.id);
      if (removeError) throw removeError;
      setItems(current => current.filter(line => line.id !== item.id));
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (checkoutItem) {
    return (
      <AfrixaPayment
        product={{
          id: checkoutItem.productId,
          variantId: checkoutItem.variantId ?? undefined,
          initialQuantity: checkoutItem.quantity,
          name: checkoutItem.name,
          price: checkoutItem.price,
          currency: checkoutItem.currency,
          imageUrl: checkoutItem.imageUrl,
          sellerName: checkoutItem.sellerName,
          sellerId: checkoutItem.sellerId,
        }}
        onClose={() => setCheckoutItem(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">Mon panier</h1>
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
      </header>
      <main className="px-4 py-4 space-y-3">
        {!user?.id && <p className="py-16 text-center text-sm text-muted-foreground">Connecte-toi pour retrouver ton panier.</p>}
        {loading && <div className="space-y-3">{[1, 2, 3].map(n => <div key={n} className="h-28 rounded-2xl bg-muted animate-pulse" />)}</div>}
        {error && <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-sm text-destructive">{error}<button onClick={() => void loadCart()} className="ml-2 underline">Réessayer</button></div>}
        {!loading && !error && user?.id && items.length === 0 && (
          <div className="py-20 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Ton panier est vide.</p>
            <button onClick={() => navigate('/marketplace')} className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Explorer le Marketplace</button>
          </div>
        )}
        {items.map(item => (
          <article key={item.id} className="rounded-2xl border border-border/30 bg-card p-3">
            <div className="flex gap-3">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 rounded-xl bg-muted" />}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</h2>
                <p className="text-xs text-muted-foreground">{item.sellerName}</p>
                <p className="mt-1 text-sm font-bold text-primary">{item.price.toLocaleString('fr-FR')} FCFA</p>
                {item.stock === 0 && <p className="text-xs text-destructive">Rupture de stock</p>}
                {item.stock > 0 && item.quantity > item.stock && (
                  <p className="text-xs text-destructive">Quantité supérieure au stock disponible ({item.stock}).</p>
                )}
              </div>
              <button onClick={() => void removeItem(item)} disabled={busyId === item.id} className="p-2 text-muted-foreground" aria-label="Retirer du panier"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button onClick={() => void updateQuantity(item, item.quantity - 1)} disabled={busyId === item.id || item.quantity <= 1} className="p-2 rounded-lg bg-muted disabled:opacity-40"><Minus className="w-3 h-3" /></button>
                <span className="text-sm font-semibold tabular-nums">{item.quantity}</span>
                <button onClick={() => void updateQuantity(item, item.quantity + 1)} disabled={busyId === item.id || item.quantity >= 50 || (item.stock >= 0 && item.quantity >= item.stock)} className="p-2 rounded-lg bg-muted disabled:opacity-40"><Plus className="w-3 h-3" /></button>
              </div>
              <button onClick={() => setCheckoutItem(item)} disabled={item.stock === 0 || (item.stock > 0 && item.quantity > item.stock)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">Commander</button>
            </div>
          </article>
        ))}
        {items.length > 0 && (
          <div className="sticky bottom-20 rounded-2xl bg-card border border-border/40 p-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total estimé</span><strong className="text-foreground">{total.toLocaleString('fr-FR')} FCFA</strong></div>
            <p className="mt-1 text-xs text-muted-foreground">Les articles sont commandés et payés séparément pour le moment.</p>
          </div>
        )}
      </main>
    </div>
  );
}
