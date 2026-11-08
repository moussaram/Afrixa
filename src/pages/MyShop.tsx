import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Package, TrendingUp, Clock, DollarSign, Edit, Trash2, Flame, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  productType: 'physical' | 'digital';
}

const MyShop = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [groupBuyProduct, setGroupBuyProduct] = useState<{name: string; price: number; currency: string} | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Array<{ id: string; total_price: number; seller_amount: number; status: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [digitalFile, setDigitalFile] = useState<File | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    productType: 'physical' as 'physical' | 'digital',
    price: '',
    category: 'Mode',
    stock: '',
    city: '',
    country: '',
  });

  const loadProducts = async () => {
    if (!user) {
      setProducts([]);
      setSellerOrders([]);
      setLoadError('Connectez-vous pour gérer votre boutique.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [productsResult, ordersResult] = await Promise.all([
        supabase.from('products')
          .select('id, name, description, category, price, stock, images, sales_count, city, country, product_type, currency')
          .eq('seller_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('orders')
          .select('id, total_price, seller_amount, status, created_at')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .range(0, 499),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      setProducts((productsResult.data ?? []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        currency: p.currency || 'XOF',
        productType: p.product_type === 'digital' ? 'digital' : 'physical',
        stock: p.stock ?? 0,
        imageUrl: p.images?.[0] ?? '',
        sales: p.sales_count ?? 0,
        city: p.city,
        country: p.country,
      })));
      setSellerOrders(ordersResult.data ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur réseau');
      setProducts([]);
      setSellerOrders([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const now = new Date();
  const todayOrders = sellerOrders.filter(o => {
    const d = new Date(o.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
      && !['annulee', 'litige', 'en_attente'].includes(o.status);
  });
  const monthOrders = sellerOrders.filter(o => {
    const d = new Date(o.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      && !['annulee', 'litige', 'en_attente'].includes(o.status);
  });
  const stats = [
    { label: 'Ventes du jour', value: todayOrders.reduce((sum, o) => sum + Number(o.total_price), 0).toLocaleString('fr-FR') + ' FCFA', icon: TrendingUp, color: 'text-green-400' },
    { label: 'En attente', value: String(sellerOrders.filter(o => o.status === 'payee').length), icon: Clock, color: 'text-amber-400' },
    { label: 'Revenus total', value: monthOrders.reduce((sum, o) => sum + Number(o.seller_amount), 0).toLocaleString('fr-FR') + ' FCFA', icon: DollarSign, color: 'text-primary' },
  ];

  const resetProductForm = () => {
    setNewProduct({ name: '', description: '', productType: 'physical', price: '', category: 'Mode', stock: '', city: '', country: '' });
    setImageFile(null);
    setDigitalFile(null);
    setEditingProduct(null);
  };

  const openEditProduct = (product: ShopProduct) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description || '',
      productType: product.productType,
      price: String(product.price),
      category: product.category,
      stock: String(product.stock),
      city: product.city || '',
      country: product.country || '',
    });
    setImageFile(null);
    setDigitalFile(null);
    setShowAddForm(true);
  };

  const handleSubmit = async () => {
    if (!user) { toast.error('Connectez-vous pour publier un produit.'); return; }
    const price = Number(newProduct.price);
    const stock = Number(newProduct.stock || '0');
    if (!newProduct.name.trim() || !Number.isSafeInteger(price) || price <= 0) {
      toast.error('Le nom et un prix entier positif sont obligatoires.');
      return;
    }
    if (newProduct.productType === 'physical' && (!Number.isSafeInteger(stock) || stock < 0)) {
      toast.error('Le stock doit être un entier positif ou nul.');
      return;
    }
    if (!imageFile && !editingProduct?.imageUrl) {
      toast.error('Ajoutez une image de couverture au produit.');
      return;
    }
    if (newProduct.productType === 'digital' && !digitalFile && !editingProduct) {
      toast.error('Ajoutez le fichier numérique à vendre.');
      return;
    }

    setSubmitting(true);
    let uploadedImagePath: string | null = null;
    try {
      let imageUrl = editingProduct?.imageUrl || '';
      if (imageFile) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(imageFile.type)) {
          throw new Error('Format image non accepté. Utilisez JPEG, PNG, WebP ou AVIF.');
        }
        const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        uploadedImagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: imageError } = await supabase.storage
          .from('afrixa-product-media')
          .upload(uploadedImagePath, imageFile, { upsert: false, contentType: imageFile.type });
        if (imageError) throw imageError;
        imageUrl = supabase.storage.from('afrixa-product-media').getPublicUrl(uploadedImagePath).data.publicUrl;
      }

      const productPayload = {
        name: newProduct.name.trim(),
        description: newProduct.description.trim() || null,
        category: newProduct.category,
        price,
        stock: newProduct.productType === 'digital' ? 0 : stock,
        unlimited_stock: newProduct.productType === 'digital',
        product_type: newProduct.productType,
        currency: 'XOF',
        images: imageUrl ? [imageUrl] : [],
        city: newProduct.city.trim() || null,
        country: newProduct.country.trim() || null,
        is_active: true,
        publication_status: newProduct.productType === 'digital' && !digitalFile && editingProduct ? 'published' : newProduct.productType === 'digital' ? 'draft' : 'published',
      };

      let productId = editingProduct?.id;
      if (editingProduct) {
        const { error: updateError } = await supabase.from('products')
          .update(productPayload)
          .eq('id', editingProduct.id)
          .eq('seller_id', user.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from('products')
          .insert({ ...productPayload, seller_id: user.id })
          .select('id').single();
        if (insertError) throw insertError;
        productId = data.id;
      }

      if (newProduct.productType === 'digital' && digitalFile && productId) {
        const { data: uploadSession, error: sessionError } = await supabase.functions.invoke('create-digital-upload', {
          body: { product_id: productId, filename: digitalFile.name },
        });
        if (sessionError || !uploadSession?.token || !uploadSession?.path) {
          throw sessionError ?? new Error('Impossible de préparer le téléversement numérique.');
        }
        const { error: uploadError } = await supabase.storage
          .from('afrixa-digital-private')
          .uploadToSignedUrl(uploadSession.path, uploadSession.token, digitalFile, { contentType: digitalFile.type });
        if (uploadError) throw uploadError;
        const { data: validation, error: validationError } = await supabase.functions.invoke('complete-digital-upload', {
          body: { asset_id: uploadSession.asset_id },
        });
        if (validationError || !validation?.ready) {
          throw validationError ?? new Error('Le fichier numérique n’a pas passé la validation.');
        }
        const { error: publishError } = await supabase.from('products')
          .update({ publication_status: 'published' })
          .eq('id', productId)
          .eq('seller_id', user.id);
        if (publishError) throw publishError;
      }

      toast.success(editingProduct ? 'Produit mis à jour.' : 'Produit enregistré.');
      setShowAddForm(false);
      resetProductForm();
      await loadProducts();
    } catch (error) {
      console.error('Product save failed', error);
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le produit.');
      if (uploadedImagePath) {
        await supabase.storage.from('afrixa-product-media').remove([uploadedImagePath]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!confirm(`Supprimer "${product.name}" ?`)) return;
    if (!user || product.isLocal) { toast.error('Session invalide. Rechargez la boutique.'); return; }
    {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', product.id)
        .eq('seller_id', user.id);
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
                    <span className="text-xs text-muted-foreground">{product.productType === 'digital' ? 'Produit numérique' : `Stock : ${product.stock}`}</span>
                    <span className="text-xs text-muted-foreground">{formatNumber(product.sales)} vendus</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => openEditProduct(product)} className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" aria-label={`Modifier ${product.name}`}>
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAddForm(false); resetProductForm(); }} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl border-t border-border/30 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
            <div className="px-4 py-4">
              <h2 className="text-lg font-bold text-foreground mb-4">{editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">Image de couverture
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setImageFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-muted-foreground" />
                  {imageFile && <span className="mt-1 block text-xs text-primary">{imageFile.name}</span>}
                  {!imageFile && editingProduct?.imageUrl && <span className="mt-1 block text-xs text-muted-foreground">Image actuelle conservée</span>}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewProduct(p => ({ ...p, productType: 'physical' }))} className={cn('rounded-xl border px-3 py-3 text-sm font-medium', newProduct.productType === 'physical' ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground')}>Produit physique</button>
                  <button type="button" onClick={() => setNewProduct(p => ({ ...p, productType: 'digital' }))} className={cn('rounded-xl border px-3 py-3 text-sm font-medium', newProduct.productType === 'digital' ? 'border-primary bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground')}>Produit numérique</button>
                </div>
                {newProduct.productType === 'digital' && <label className="block text-sm font-medium text-foreground">Fichier à vendre
                  <input type="file" onChange={e => setDigitalFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-muted-foreground" />
                  {digitalFile && <span className="mt-1 block text-xs text-primary">{digitalFile.name}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">Le fichier reste privé et ne sera accessible qu’après paiement confirmé.</span>
                </label>}

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
                    min="1"
                    step="1"
                    placeholder="Prix (FCFA)"
                    value={newProduct.price}
                    onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />
                  {newProduct.productType === 'physical' && <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Stock disponible"
                    value={newProduct.stock}
                    onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))}
                    className="px-4 py-3 rounded-xl bg-card/30 border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                  />}
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
                  {submitting ? 'Enregistrement...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
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
