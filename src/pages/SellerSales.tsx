import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Package, Clock, CheckCircle2, Truck, MessageCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonCard } from '@/components/common/SkeletonLoader';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';
type SellerOrder = {
  id: string;
  product_name: string;
  product_image: string | null;
  buyer_id: string;
  buyer_name: string;
  buyer_avatar: string | null;
  quantity: number;
  total_price: number;
  commission_amount: number;
  seller_amount: number;
  status: OrderStatus;
  delivery_address: string | null;
  buyer_note: string | null;
  tracking_number: string | null;
  created_at: string;
  escrow_released: boolean;
};

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'Paiement en attente', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  payee: { label: 'Nouvelle commande', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  en_preparation: { label: 'En préparation', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  expediee: { label: 'Expédiée', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  livree: { label: 'Livrée', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  terminee: { label: 'Terminée · fonds libérés', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  litige: { label: 'Litige', color: 'text-red-400', bg: 'bg-red-400/10' },
  annulee: { label: 'Annulée', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const formatFCFA = (value: number) => Math.max(0, Number(value) || 0).toLocaleString('fr-FR') + ' FCFA';

const SellerSales = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Connectez-vous pour consulter vos ventes.');
      const { data, error } = await supabase
        .from('orders')
        .select('id, product_name, product_image, buyer_id, quantity, total_price, commission_amount, seller_amount, status, delivery_address, buyer_note, tracking_number, created_at, escrow_released')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const buyerIds = [...new Set(rows.map((row) => row.buyer_id))];
      const { data: profiles, error: profilesError } = buyerIds.length
        ? await supabase.from('profiles').select('user_id, username, prenom, nom, avatar_url').in('user_id', buyerIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      setOrders(rows.map((row) => {
        const profile = profileMap.get(row.buyer_id);
        const displayName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim()
          || (profile?.username ? '@' + profile.username : 'Acheteur Afrixa');
        return { ...row, status: row.status as OrderStatus, buyer_name: displayName, buyer_avatar: profile?.avatar_url ?? null };
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const activeOrders = orders.filter((order) => ['payee', 'en_preparation', 'expediee'].includes(order.status) && !order.escrow_released);
  const pendingAmount = activeOrders.reduce((sum, order) => sum + Number(order.seller_amount || 0), 0);
  const completedOrders = orders.filter((order) => order.status === 'terminee' || order.escrow_released);
  const tabs = [
    { id: 'active', label: 'En cours' },
    { id: 'payee', label: 'Nouvelles' },
    { id: 'en_preparation', label: 'Préparation' },
    { id: 'expediee', label: 'Expédiées' },
    { id: 'terminee', label: 'Terminées' },
    { id: 'litige', label: 'Litiges' },
  ];
  const filtered = useMemo(() => orders.filter((order) => {
    if (activeTab === 'active') return ['payee', 'en_preparation', 'expediee'].includes(order.status) && !order.escrow_released;
    if (activeTab === 'terminee') return order.status === 'terminee' || order.escrow_released;
    return order.status === activeTab;
  }), [orders, activeTab]);

  const updateOrder = async (order: SellerOrder, patch: { status: OrderStatus; tracking_number?: string | null }) => {
    setSaving(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Session utilisateur indisponible');
      const { error } = await supabase.from('orders').update(patch)
        .eq('id', order.id).eq('seller_id', user.id);
      if (error) throw error;
      toast.success(patch.status === 'expediee' ? 'Expédition enregistrée' : 'Commande prise en charge');
      setSelectedOrder(null);
      await loadOrders();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise à jour impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">🛍️ Mes ventes</h1>
          <button onClick={() => void loadOrders()} className="p-2" aria-label="Actualiser"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        <div className="p-3 rounded-xl bg-[#1A1A2E] border border-border/20">
          <p className="text-xs text-muted-foreground">Commandes en cours</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '…' : activeOrders.length}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#0c1a2e] border border-blue-500/30">
          <p className="text-xs text-blue-300">Montant bloqué</p>
          <p className="text-lg font-bold text-blue-300">{loading ? '…' : formatFCFA(pendingAmount)}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1A2E] border border-border/20">
          <p className="text-xs text-muted-foreground">Ventes terminées</p>
          <p className="text-2xl font-bold text-foreground">{loading ? '…' : completedOrders.length}</p>
        </div>
        <div className="p-3 rounded-xl bg-[#1A1A2E] border border-border/20">
          <p className="text-xs text-muted-foreground">Montant net libéré</p>
          <p className="text-lg font-bold text-emerald-400">{loading ? '…' : formatFCFA(completedOrders.reduce((sum, order) => sum + Number(order.seller_amount || 0), 0))}</p>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar px-2 border-b border-border/20">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex-shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap', activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? <><SkeletonCard /><SkeletonCard /></> : filtered.map((order) => {
          const status = statusConfig[order.status] ?? statusConfig.en_attente;
          return (
            <button key={order.id} onClick={() => { setSelectedOrder(order); setTrackingNumber(order.tracking_number ?? ''); }}
              className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left">
              {order.product_image ? <img loading="lazy" src={order.product_image} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><Package /></div>}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.product_name}</h3>
                <p className="text-xs text-muted-foreground">{order.buyer_name} · Qté : {order.quantity}</p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-sm font-bold text-emerald-400">{formatFCFA(order.seller_amount)}</p>
                  <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full', status.color, status.bg)}>{status.label}</span>
                </div>
              </div>
            </button>
          );
        })}
        {!loading && filtered.length === 0 && <div className="flex flex-col items-center py-16 text-muted-foreground"><Package className="w-12 h-12 mb-3" /><p className="text-sm">Aucune commande dans cette catégorie</p></div>}
      </div>

      {selectedOrder && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSelectedOrder(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[#1A1A2E] rounded-t-[20px] max-h-[88vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
            <div className="px-4 py-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-foreground">Commande #{selectedOrder.id.slice(0, 8).toUpperCase()}</h3>
                <span className={cn('text-xs px-2 py-1 rounded-full', statusConfig[selectedOrder.status].color, statusConfig[selectedOrder.status].bg)}>{statusConfig[selectedOrder.status].label}</span>
              </div>
              <div className="rounded-xl bg-[#0A0A0F] p-4 space-y-2">
                <p className="text-xs uppercase text-muted-foreground">Acheteur</p>
                <p className="text-sm text-foreground">{selectedOrder.buyer_name}</p>
                {selectedOrder.delivery_address && <p className="text-xs text-muted-foreground">Adresse de livraison : {selectedOrder.delivery_address}</p>}
                {selectedOrder.buyer_note && <p className="text-xs text-muted-foreground">Note : {selectedOrder.buyer_note}</p>}
                {selectedOrder.tracking_number && <p className="text-xs text-muted-foreground">Suivi : {selectedOrder.tracking_number}</p>}
              </div>
              <div className="rounded-xl bg-[#0c1a2e] border border-blue-500/30 p-4 space-y-2">
                <p className="text-xs uppercase text-blue-300">Argent sécurisé</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total payé</span><span className="text-foreground">{formatFCFA(selectedOrder.total_price)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Commission Afrixa</span><span className="text-foreground">−{formatFCFA(selectedOrder.commission_amount)}</span></div>
                <div className="border-t border-blue-500/20 pt-2 flex justify-between"><span className="font-semibold text-blue-200">Net vendeur</span><span className="font-bold text-blue-200">{formatFCFA(selectedOrder.seller_amount)}</span></div>
                <p className="text-xs text-blue-200/80">{selectedOrder.escrow_released ? 'Fonds déjà libérés dans votre portefeuille.' : 'Fonds bloqués jusqu’à confirmation de réception par l’acheteur.'}</p>
              </div>
              {selectedOrder.status === 'payee' && <button disabled={saving} onClick={() => void updateOrder(selectedOrder, { status: 'en_preparation' })} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">📦 Confirmer et préparer</button>}
              {selectedOrder.status === 'en_preparation' && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Numéro de suivi (facultatif)</label>
                  <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Référence du transporteur" className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground text-sm" />
                  <button disabled={saving} onClick={() => void updateOrder(selectedOrder, { status: 'expediee', tracking_number: trackingNumber.trim() || null })} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold disabled:opacity-50"><Truck className="inline w-4 h-4 mr-2" />{saving ? 'Enregistrement…' : 'Confirmer l’expédition'}</button>
                </div>
              )}
              {selectedOrder.status === 'expediee' && <p className="text-sm text-blue-200">En attente de la confirmation de réception de l’acheteur. Les fonds restent bloqués.</p>}
              {selectedOrder.status === 'terminee' && <p className="text-sm text-emerald-300"><CheckCircle2 className="inline w-4 h-4 mr-1" />Montant crédité dans votre solde disponible.</p>}
              <button onClick={() => setSelectedOrder(null)} className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold">Fermer</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SellerSales;
