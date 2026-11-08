import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Package, TrendingUp, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type OrderStatus = 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee' | 'en_attente';

interface SellerOrder {
  id: string;
  product_name: string;
  product_image: string | null;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_amount: number;
  seller_amount: number;
  status: string;
  delivery_address: string | null;
  buyer_note: string | null;
  product_type: string;
  delivery_method: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🟡' },
  payee: { label: 'Nouvelle', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🔴' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '📦' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10', emoji: '🚚' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]', bg: 'bg-[#6B7280]/10', emoji: '⚫' },
};

const tabs = [
  { id: 'payee', label: 'Nouvelles' },
  { id: 'en_preparation', label: 'Préparation' },
  { id: 'expediee', label: 'Expédiées' },
  { id: 'terminee', label: 'Terminées' },
  { id: 'litige', label: 'Litiges' },
];

const SellerSales = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('payee');
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionLoading, setTransitionLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setError('Connectez-vous pour consulter vos ventes.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id, product_name, product_image, buyer_id, quantity, total_price, commission_amount, seller_amount, status, delivery_address, buyer_note, product_type, delivery_method, created_at')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 99);
    if (queryError) {
      setOrders([]);
      setError('Impossible de charger vos ventes. Vérifiez vos autorisations puis réessayez.');
    } else {
      setOrders((data ?? []) as SellerOrder[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(order => activeTab === 'terminee'
    ? ['livree', 'terminee'].includes(order.status)
    : order.status === activeTab);

  const transitionDelivery = async (action: 'start_preparation' | 'mark_in_transit' | 'report_delivered') => {
    if (!selectedOrder) return;
    setTransitionLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('seller-delivery-transition', {
        body: { order_id: selectedOrder.id, action },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      toast.success(action === 'start_preparation' ? 'Préparation démarrée.' : action === 'mark_in_transit' ? 'Commande marquée comme expédiée.' : 'Livraison signalée comme effectuée. Le client doit confirmer la réception.');
      setSelectedOrder(null);
      await loadOrders();
    } catch (transitionError) {
      console.error('Seller delivery transition failed', transitionError);
      toast.error(transitionError instanceof Error ? transitionError.message : 'Impossible de mettre à jour la livraison.');
    } finally {
      setTransitionLoading(false);
    }
  };

  const today = new Date();
  const isToday = (value: string) => {
    const date = new Date(value);
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };
  const todaySales = orders.filter(o => isToday(o.created_at) && !['annulee', 'litige', 'en_attente'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_price), 0);
  const monthSales = orders.filter(o => {
    const date = new Date(o.created_at);
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()
      && !['annulee', 'litige', 'en_attente'].includes(o.status);
  }).reduce((sum, o) => sum + Number(o.seller_amount), 0);

  const stats = [
    { label: 'Ventes du jour', value: todaySales.toLocaleString('fr-FR'), icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'En attente', value: String(orders.filter(o => o.status === 'payee').length), icon: Clock, color: 'text-[#F59E0B]' },
    { label: 'Expédiées', value: String(orders.filter(o => o.status === 'expediee').length), icon: Package, color: 'text-[#7C3AED]' },
    { label: 'Revenus mois', value: monthSales.toLocaleString('fr-FR'), icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">🛍️ Mes ventes</h1>
          <button onClick={() => void loadOrders()} className="p-2" aria-label="Actualiser" disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-4">
        {stats.map(s => {
          const Icon = s.icon;
          return <div key={s.label} className="p-3 rounded-xl bg-[#1A1A2E] border border-border/20 text-center">
            <Icon className={cn('w-4 h-4 mx-auto mb-1', s.color)} />
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}{s.label.includes('Ventes') || s.label.includes('Revenus') ? ' FCFA' : ''}</p>
          </div>;
        })}
      </div>

      <div className="flex overflow-x-auto hide-scrollbar px-2 border-b border-border/20">
        {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className={cn('flex-shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap',
            activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground')}>
          {tab.label}
        </button>)}
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading && <p className="py-12 text-center text-sm text-muted-foreground">Chargement de vos ventes…</p>}
        {!loading && error && <div className="py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => void loadOrders()} className="text-sm text-primary font-semibold">Réessayer</button>
        </div>}
        {!loading && !error && filtered.map(order => {
          const sc = statusConfig[order.status] ?? statusConfig.en_attente;
          return <button key={order.id} onClick={() => setSelectedOrder(order)}
            className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left hover:border-primary/30">
            {order.product_image
              ? <img loading="lazy" src={order.product_image} alt={order.product_name} className="w-14 h-14 rounded-xl object-cover" />
              : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center"><Package className="w-5 h-5" /></div>}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{order.product_name}</h3>
              <p className="text-xs text-muted-foreground">Acheteur {order.buyer_id.slice(0, 8)}… · Qté: {order.quantity}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-sm font-bold text-emerald-400">{Number(order.seller_amount).toLocaleString('fr-FR')} FCFA</p>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', sc.color, sc.bg)}>{sc.emoji} {sc.label}</span>
              </div>
            </div>
          </button>;
        })}
        {!loading && !error && filtered.length === 0 && <div className="flex flex-col items-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aucune commande réelle dans cette catégorie</p>
        </div>}
      </div>

      {selectedOrder && <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center sm:justify-center p-0 sm:p-4" onClick={() => setSelectedOrder(null)}>
        <section role="dialog" aria-modal="true" aria-label="Détail de la commande"
          className="w-full sm:max-w-lg bg-[#1A1A2E] rounded-t-[20px] sm:rounded-2xl max-h-[85vh] overflow-y-auto p-5 space-y-4"
          onClick={event => event.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Commande</h2>
            <button onClick={() => setSelectedOrder(null)} className="text-sm text-primary">Fermer</button>
          </div>
          <p className="text-sm text-foreground">{selectedOrder.product_name}</p>
          <p className="text-xs text-muted-foreground">Acheteur : {selectedOrder.buyer_id}</p>
          {selectedOrder.delivery_address && <p className="text-xs text-muted-foreground">Adresse : {selectedOrder.delivery_address}</p>}
          {selectedOrder.buyer_note && <p className="text-xs text-muted-foreground">Note : {selectedOrder.buyer_note}</p>}
          <div className="rounded-xl bg-[#0A0A0F] p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{Number(selectedOrder.total_price).toLocaleString('fr-FR')} FCFA</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span>{Number(selectedOrder.commission_amount).toLocaleString('fr-FR')} FCFA</span></div>
            <div className="flex justify-between font-bold"><span>Part vendeur</span><span>{Number(selectedOrder.seller_amount).toLocaleString('fr-FR')} FCFA</span></div>
          </div>
          <p className="text-xs text-muted-foreground">Les changements de statut seront disponibles via le workflow serveur sécurisé. Aucune modification locale ou notification fictive n'est effectuée ici.</p>
        </section>
      </div>}
    </div>
  );
};

export default SellerSales;
