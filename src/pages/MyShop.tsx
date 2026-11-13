import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Package, TrendingUp, Clock, DollarSign, Edit, Trash2, Flame, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import { SkeletonList } from '@/components/common/SkeletonLoader';
import { ErrorWithRetry } from '@/components/common/ErrorWithRetry';


interface ShopProduct {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  price: number;
  currency: string;
  stock: number;
  imageUrl: string;
  sales: number;
  city?: string | null;
  country?: string | null;
  variantId?: string | null;
  variantName?: string | null;
  variantPrice?: number | null;
  variantStock?: number | null;
}

const MyShop = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [stats, setStats] = useState([
    { label: 'Ventes', value: '0', icon: TrendingUp, color: 'text-green-400' },
    { label: 'En attente', value: '0', icon: Clock, color: 'text-amber-400' },
    { label: 'Revenus vendeur', value: '0 FCFA', icon: DollarSign, color: 'text-primary' },
  ]);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Mode',
    stock: '',
    city: '',
    country: '',
    imageUrl: '',
    variantName: '',
    variantPrice: '',
    variantStock: '',
  });

  const loadProducts = async () => {
    if (!user?.id) {
      setProducts([]);
      setStats([
        { label: 'Ventes', value: '0', icon: TrendingUp, color: 'text-green-400' },
        { label: 'En attente', value: '0', icon: Clock, color: 'text-amber-400' },
        { label: 'Revenus vendeur', value: '0 FCFA', icon: DollarSign, color: 'text-primary' },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data, error }, { data: statsRows, error: statsError }] = await Promise.all([
        supabase.from('products')
          .select('id, name, description, category, price, stock, images, sales_count, city, country')
          .eq('seller_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('get_my_shop_stats'),
      ]);
      if (error) throw error;
      if (statsError) throw statsError;
      const productIds = (data ?? []).map(product => product.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: variants, error: variantsError } = productIds.length
        ? await (supabase as any).from('product_variants')
          .select('id, product_id, name, price, stock')
          .in('product_id', productIds)
          .eq('is_active', true)
        : { data: [], error: null };
      if (variantsError) throw variantsError;
      const variantByProduct = new Map<string, { id: string; name: string; price: number | null; stock: number }>(
        (variants ?? []).map((variant: { id: string; product_id: string; name: string; price: number | null; stock: number }) => [
          variant.product_id, variant,
        ]),
      );
      setProducts((data ?? []).map(product => {
        const variant = variantByProduct.get(product.id);
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          currency: 'FCFA',
          stock: variant?.stock ?? product.stock ?? 0,
          imageUrl: product.images?.[0] ?? '',
          sales: product.sales_count ?? 0,
          city: product.city,
          country: product.country,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          variantPrice: variant?.price ?? null,
          variantStock: variant?.stock ?? null,
        };
      }));
      const shopStats = statsRows?.[0] ?? { completed_sales: 0, orders_in_progress: 0, seller_amount_total: 0 };
      setStats([
        { label: 'Ventes confirmées', value: String(shopStats.completed_sales ?? 0), icon: TrendingUp, color: 'text-green-400' },
        { label: 'En cours', value: String(shopStats.orders_in_progress ?? 0), icon: Clock, color: 'text-amber-400' },
        { label: 'Montant vendeur', value: `${formatNumber(shopStats.seller_amount_total ?? 0)} FCFA`, icon: DollarSign, color: 'text-primary' },
      ]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);



  const handleSubmit = async () => {
    if (!user?.id) return toast.error('Connecte-toi pour gérer ta boutique.');
    const price = Number.parseInt(newProduct.price, 10);
    const stock = Number.parseInt(newProduct.stock || '0', 10);
    if (!newProduct.name.trim() || !Number.isSafeInteger(price) || price <= 0
      || !Number.isSafeInteger(stock) || stock < 0) {
      toast.error('Vérifie le nom, le prix et le stock.');
      return;
    }
    const shouldCreateVariant = Boolean(newProduct.variantName.trim());
    const variantPrice = newProduct.variantPrice.trim() ? Number.parseInt(newProduct.variantPrice, 10) : null;
    const variantStock = Number.parseInt(newProduct.variantStock || '0', 10);
    if (shouldCreateVariant && (
      (variantPrice !== null && (!Number.isSafeInteger(variantPrice) || variantPrice <= 0))
      || !Number.isSafeInteger(variantStock) || variantStock < 0
    )) {
      toast.error('Prix ou stock de variante invalide.');
      return;
    }
    setSubmitting(true);
    try {
      const productPayload = {
        name: newProduct.name.trim(),
        description: newProduct.description.trim() || null,
        category: newProduct.category,
        price,
        stock,
        city: newProduct.city.trim() || null,
        country: newProduct.country.trim() || null,
        images: newProduct.imageUrl.trim() ? [newProduct.imageUrl.trim()] : [],
      };
      if (editingProduct) {
        // Product fields and its existing/first variant are updated atomically.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).rpc('update_shop_product_with_variant', {
          p_product_id: editingProduct.id,
          p_name: productPayload.name,
          p_description: productPayload.description,
          p_category: productPayload.category,
          p_price: productPayload.price,
          p_stock: productPayload.stock,
          p_city: productPayload.city,
          p_country: productPayload.country,
          p_images: productPayload.images,
          p_variant_id: editingProduct.variantId ?? null,
          p_variant_name: shouldCreateVariant ? newProduct.variantName.trim() : null,
          p_variant_price: shouldCreateVariant ? variantPrice : null,
          p_variant_stock: shouldCreateVariant ? variantStock : 0,
        });
        if (error) throw error;
      } else {
        // Product and first variant are created in one database transaction.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: createdProductId, error } = await (supabase as any).rpc(
          'create_shop_product_with_variant',
          {
            p_name: productPayload.name,
            p_description: productPayload.description,
            p_category: productPayload.category,
            p_price: productPayload.price,
            p_stock: productPayload.stock,
            p_city: productPayload.city,
            p_country: productPayload.country,
            p_images: productPayload.images,
            p_variant_name: shouldCreateVariant ? newProduct.variantName.trim() : null,
            p_variant_price: shouldCreateVariant ? variantPrice : null,
            p_variant_stock: shouldCreateVariant ? variantStock : 0,
          },
        );
        if (error) throw error;
        if (typeof createdProductId !== 'string') throw new Error('Création du produit impossible.');
      }

      toast.success(editingProduct ? 'Produit modifié.' : 'Produit publié.');
      setShowAddForm(false);
      setEditingProduct(null);
      setNewProduct({ name: '', description: '', price: '', category: 'Mode', stock: '', city: '', country: '', imageUrl: '', variantName: '', variantPrice: '', variantStock: '' });
      await loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible d’enregistrer le produit.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!user?.id || !confirm(`Désactiver "${product.name}" ?`)) return;
    const { error } = await supabase.from('products')
      .update({ is_active: false })
      .eq('id', product.id)
      .eq('seller_id', user.id);
    if (error) {
      toast.error('Désactivation impossible.');
      return;
    }
    setProducts(prev => prev.filter(item => item.id !== product.id));
    toast.success('Produit désactivé.');
  };

  const startEditing = (product: ShopProduct) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),
      category: product.category,
      stock: String(product.stock),
      city: product.city ?? '',
      country: product.country ?? '',
      imageUrl: product.imageUrl,
      variantName: '',
      variantPrice: '',
      variantStock: '',
    });
    setShowAddForm(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">🏪 Ma Boutique</h1>
          <button
            onClick={() => { setEditingProduct(null); setNewProduct({ name: '', description: '', price: '', category: 'Mode', stock: '', city: '', country: '', imageUrl: '', variantName: '', variantPrice: '', variantStock: '' }); setShowAddForm(true); }}
            className="p-2 rounded-xl gradient-primary"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-3 rounded-2xl bg-card/30 border border-border/20 text-center">
              <Icon className={cn('w-5 h-5 mx-auto mb-1', stat.color)} />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Products list */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Mes produits ({products.length})
          </h2>
        </div>
        {loading ? (
          <SkeletonList rows={4} />
        ) : loadError ? (
          <ErrorWithRetry onRetry={loadProducts} />
        ) : products.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Aucun produit. Appuie sur ➕ pour ajouter ton premier produit.
          </div>

        ) : (
          <div className="space-y-3">
            {products.map(product => (
              <div key={product.id} className="flex gap-3 p-3 rounded-2xl bg-card/30 border border-border/20">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="w-20 h-20 rounded-xl object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{product.name}</h3>
                  <p className="text-sm font-bold text-primary mt-0.5">
                    {product.price.toLocaleString()} {product.currency}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">Stock: {product.stock}</span>
                    <span className="text-xs text-muted-foreground">{formatNumber(product.sales)} vendus</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => startEditing(product)} className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" title="Modifier le produit">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => toast.info('Les achats groupés seront activés après la sécurisation du parcours de remboursement.')} 
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    title="Group Buy en préparation"
                  >
                    <Flame className="w-4 h-4 text-red-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add product form modal */}
      {showAddForm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl border-t border-border/30 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
            <div className="px-4 py-4">
              <h2 className="text-lg font-bold text-foreground mb-4">{editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
              <div className="space-y-4">
                <input
                  type="url"
                  placeholder="URL de la photo du produit (https://...)"
                  value={newProduct.imageUrl}
                  onChange={e => setNewProduct(p => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                />

                <input
                  type="text"
                  placeholder="Nom du produit"
                  value={newProduct.name}
                  onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                />
                <textarea
                  placeholder="Description"
                  value={newProduct.description}
                  onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm min-h-[80px] resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Prix (FCFA)"
                    value={newProduct.price}
                    onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Stock disponible"
                    value={newProduct.stock}
                    onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>
                <select
                  value={newProduct.category}
                  onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground text-sm"
                >
                  {['Mode', 'Électronique', 'Beauté', 'Artisanat', 'Alimentation', 'Maison'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {!editingProduct && (
                  <div className="rounded-xl border border-border/30 p-3 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Première variante (facultatif)</p>
                    <input
                      type="text"
                      placeholder="Ex. Taille M / Couleur noire"
                      value={newProduct.variantName}
                      onChange={e => setNewProduct(p => ({ ...p, variantName: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="1" placeholder="Prix variante (facultatif)" value={newProduct.variantPrice} onChange={e => setNewProduct(p => ({ ...p, variantPrice: e.target.value }))} className="min-w-0 px-3 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground text-sm" />
                      <input type="number" min="0" placeholder="Stock variante" value={newProduct.variantStock} onChange={e => setNewProduct(p => ({ ...p, variantStock: e.target.value }))} className="min-w-0 px-3 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground text-sm" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Ville"
                    value={newProduct.city}
                    onChange={e => setNewProduct(p => ({ ...p, city: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Pays"
                    value={newProduct.country}
                    onChange={e => setNewProduct(p => ({ ...p, country: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Enregistrement...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default MyShop;
