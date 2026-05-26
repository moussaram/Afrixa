import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Package, TrendingUp, Clock, DollarSign, Edit, Trash2, Flame, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockProducts } from '@/data/mockMarketplace';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CreateGroupBuyForm } from '@/components/groupbuy/CreateGroupBuyForm';
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
  isLocal?: boolean;
}

const MyShop = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [groupBuyProduct, setGroupBuyProduct] = useState<{name: string; price: number; currency: string} | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Mode',
    stock: '',
    city: '',
    country: '',
  });

  const loadProducts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (user) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('seller_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) {
          setProducts(data.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            currency: 'FCFA',
            stock: p.stock ?? 0,
            imageUrl: (p.images && p.images[0]) || `https://picsum.photos/seed/${p.id}/200`,
            sales: p.sales_count ?? 0,
            city: p.city,
            country: p.country,
          })));
          setLoading(false);
          return;
        }
      }
      // Fallback to mock for dev / empty state
      setProducts(mockProducts.filter(p => p.sellerId === 's1').map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        currency: p.currency,
        stock: p.stock,
        imageUrl: p.imageUrl,
        sales: p.sales,
        city: p.city,
        country: p.country,
        isLocal: true,
      })));
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

  const stats = [
    { label: 'Ventes du jour', value: '12', icon: TrendingUp, color: 'text-green-400' },
    { label: 'En attente', value: '3', icon: Clock, color: 'text-amber-400' },
    { label: 'Revenus total', value: '245K FCFA', icon: DollarSign, color: 'text-primary' },
  ];

  const handleSubmit = async () => {
    if (!newProduct.name.trim() || !newProduct.price) {
      toast.error('Nom et prix sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      if (user) {
        const { data, error } = await supabase.from('products').insert({
          seller_id: user.id,
          name: newProduct.name.trim(),
          description: newProduct.description.trim() || null,
          category: newProduct.category,
          price: parseInt(newProduct.price, 10),
          stock: parseInt(newProduct.stock || '0', 10),
          city: newProduct.city || null,
          country: newProduct.country || null,
        }).select().single();
        if (error) throw error;
        if (data) {
          setProducts(prev => [{
            id: data.id,
            name: data.name,
            category: data.category,
            price: data.price,
            currency: 'FCFA',
            stock: data.stock ?? 0,
            imageUrl: `https://picsum.photos/seed/${data.id}/200`,
            sales: 0,
            city: data.city,
            country: data.country,
          }, ...prev]);
        }
      } else {
        // Local optimistic add
        setProducts(prev => [{
          id: `local-${Date.now()}`,
          name: newProduct.name,
          category: newProduct.category,
          price: parseInt(newProduct.price, 10),
          currency: 'FCFA',
          stock: parseInt(newProduct.stock || '0', 10),
          imageUrl: `https://picsum.photos/seed/${Date.now()}/200`,
          sales: 0,
          city: newProduct.city,
          country: newProduct.country,
          isLocal: true,
        }, ...prev]);
      }
      toast.success('✅ Produit publié !');
      setShowAddForm(false);
      setNewProduct({ name: '', description: '', price: '', category: 'Mode', stock: '', city: '', country: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de publier le produit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!confirm(`Supprimer "${product.name}" ?`)) return;
    if (user && !product.isLocal) {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', product.id);
      if (error) {
        toast.error('Suppression impossible');
        return;
      }
    }
    setProducts(prev => prev.filter(p => p.id !== product.id));
    toast.success('Produit supprimé');
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
            onClick={() => setShowAddForm(true)}
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
                  <button className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setGroupBuyProduct({ name: product.name, price: product.price, currency: product.currency })}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    title="Créer un Group Buy"
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
              <h2 className="text-lg font-bold text-foreground mb-4">Ajouter un produit</h2>
              <div className="space-y-4">
                {/* Photo placeholder */}
                <div className="w-full h-40 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center bg-card/20">
                  <div className="text-center">
                    <Plus className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Ajouter une photo</p>
                  </div>
                </div>

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
                  {submitting ? 'Publication...' : 'Publier le produit'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Group Buy creation form */}
      {groupBuyProduct && (
        <CreateGroupBuyForm
          productName={groupBuyProduct.name}
          productPrice={groupBuyProduct.price}
          currency={groupBuyProduct.currency}
          onClose={() => setGroupBuyProduct(null)}
        />
      )}
    </div>
  );
};

export default MyShop;
