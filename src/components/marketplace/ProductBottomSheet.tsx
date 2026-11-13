import { useEffect, useState } from 'react';
import { X, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AfrixaPayment } from '@/components/payment/AfrixaPayment';

interface ProductVariant {
  id: string;
  name: string;
  sku: string | null;
  options: Record<string, string>;
  price: number | null;
  stock: number;
}

interface ProductBottomSheetProps {
  product: {
    id: string;
    name: string;
    price: number;
    currency: string;
    imageUrl: string;
    sellerName: string;
    sellerId: string;
    sellerVerified?: boolean;
    stock?: number;
  };
  onClose: () => void;
}

export const ProductBottomSheet = ({ product, onClose }: ProductBottomSheetProps) => {
  const [showPayment, setShowPayment] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [variantLoadError, setVariantLoadError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    let active = true;
    const loadVariants = async () => {
      setLoadingVariants(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from('product_variants')
          .select('id, name, sku, options, price, stock')
          .eq('product_id', product.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (active) setVariants((data ?? []) as ProductVariant[]);
      } catch (error) {
        if (active) {
          setVariantLoadError(error instanceof Error ? error.message : 'Impossible de charger les variantes.');
          toast.error('Les options du produit ne sont pas disponibles. Réessaie plus tard.');
        }
      } finally {
        if (active) setLoadingVariants(false);
      }
    };
    void loadVariants();
    return () => { active = false; };
  }, [product.id]);

  if (showPayment) {
    return <AfrixaPayment product={{ ...product, price: selectedVariant?.price ?? product.price, variantId: selectedVariant?.id }} onClose={onClose} />;
  }

  const addToCart = async () => {
    if (loadingVariants || variantLoadError) return;
    if (variants.length > 0 && !selectedVariant) return toast.error('Choisis une variante.');
    setAddingToCart(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Connecte-toi pour utiliser ton panier.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('add_cart_item', {
        p_product_id: product.id,
        p_quantity: 1,
        p_variant_id: selectedVariant?.id ?? null,
      });
      if (error) throw error;
      toast.success('Produit ajouté au panier.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ajout au panier impossible.');
    } finally {
      setAddingToCart(false);
    }
  };

  const displayPrice = selectedVariant?.price ?? product.price;
  const unlimitedStock = product.stock === -1;
  const noStock = unlimitedStock
    ? false
    : selectedVariant
      ? selectedVariant.stock <= 0
      : (product.stock ?? 0) <= 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t border-border/30 animate-slide-up max-h-[88vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-foreground">Détail du produit</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted" aria-label="Fermer">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 pb-6">
          <div className="flex gap-4 p-3 rounded-2xl bg-card/30 border border-border/20">
            <img src={product.imageUrl} alt={product.name} className="w-24 h-24 rounded-xl object-cover" />
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h4 className="font-semibold text-foreground text-sm">{product.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{product.sellerName}</p>
              </div>
              <p className="text-lg font-bold text-primary">{displayPrice.toLocaleString()} {product.currency}</p>
            </div>
          </div>

          {variantLoadError ? (
            <p className="mt-4 text-xs text-destructive">Les variantes ne peuvent pas être vérifiées. L’achat est temporairement bloqué.</p>
          ) : loadingVariants ? (
            <div className="flex justify-center py-5"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : variants.length > 0 ? (
            <section className="mt-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">Choisir une variante</h4>
              <div className="grid grid-cols-2 gap-2">
                {variants.map(variant => (
                  <button
                    key={variant.id}
                    disabled={variant.stock <= 0 && !unlimitedStock}
                    onClick={() => setSelectedVariant(variant)}
                    className={`rounded-xl border p-3 text-left text-sm transition-colors ${selectedVariant?.id === variant.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border/30 text-muted-foreground'} disabled:opacity-40`}
                  >
                    <span className="block font-semibold">{variant.name}</span>
                    {Object.entries(variant.options ?? {}).map(([key, value]) => (
                      <span key={key} className="block text-xs">{key}: {value}</span>
                    ))}
                    <span className="block mt-1 text-xs">{variant.price ? `${variant.price.toLocaleString()} FCFA` : 'Prix standard'}</span>
                    <span className="block text-xs">{unlimitedStock ? 'Stock illimité' : variant.stock > 0 ? `Stock : ${variant.stock}` : 'Rupture de stock'}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <button
            onClick={() => {
              if (loadingVariants) return;
              if (variants.length > 0 && !selectedVariant) {
                toast.error('Choisis une variante avant de continuer.');
                return;
              }
              if (noStock) {
                toast.error('Cette variante est en rupture de stock.');
                return;
              }
              setShowPayment(true);
            }}
            disabled={loadingVariants || Boolean(variantLoadError) || noStock}
            className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShoppingCart className="w-5 h-5" />
            Acheter maintenant
          </button>
          <button
            onClick={() => void addToCart()}
            disabled={loadingVariants || Boolean(variantLoadError) || addingToCart || noStock}
            className="w-full mt-2 py-3 rounded-xl border border-border/40 text-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {addingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {addingToCart ? 'Ajout...' : 'Ajouter au panier'}
          </button>
        </div>
      </div>
    </>
  );
};
