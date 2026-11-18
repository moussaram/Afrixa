import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonCard } from '@/components/common/SkeletonLoader';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';
type BuyerOrder = {
  id: string; seller_id: string; product_name: string; product_image: string | null;
  total_price: number; quantity: number; payment_operator: string | null; status: OrderStatus;
  created_at: string; escrow_released: boolean; seller_name: string;
};
const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente de paiement', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  payee: { label: 'Payée', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  en_preparation: { label: 'En préparation', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  expediee: { label: 'Expédiée', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  livree: { label: 'Livrée', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  terminee: { label: 'Terminée', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  litige: { label: 'Litige', color: 'text-red-400', bg: 'bg-red-400/10' },
  annulee: { label: 'Annulée', color: 'text-muted-foreground', bg: 'bg-muted' },
};
const formatFCFA = (value: number) => Number(value || 0).toLocaleString('fr-FR') + ' FCFA';

const Orders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Connectez-vous pour consulter vos commandes.');
      const { data, error } = await supabase.from('orders')
        .select('id, seller_id, product_name, product_image, total_price, quantity, payment_operator, status, created_at, escrow_released')
        .eq('buyer_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const sellerIds = [...new Set(rows.map((row) => row.seller_id))];
      const { data: profiles, error: profileError } = sellerIds.length
        ? await supabase.from('profiles').select('user_id, username, prenom, nom').in('user_id', sellerIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      setOrders(rows.map((row) => {
        const profile = profileMap.get(row.seller_id);
        return {
          ...row,
          status: row.status as OrderStatus,
          seller_name: [profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim()
            || (profile?.username ? '@' + profile.username : 'Vendeur Afrixa'),
        };
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const tabs = [{ id: 'all', label: 'Toutes' }, { id: 'active', label: 'En cours' }, { id: 'delivered', label: 'Terminées' }, { id: 'dispute', label: 'Litiges' }, { id: 'cancelled', label: 'Annulées' }];
  const filtered = useMemo(() => orders.filter((order) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['en_attente', 'payee', 'en_preparation', 'expediee'].includes(order.status);
    if (activeTab === 'delivered') return ['livree', 'terminee'].includes(order.status);
    if (activeTab === 'dispute') return order.status === 'litige';
    if (activeTab === 'cancelled') return order.status === 'annulee';
    return true;
  }), [orders, activeTab]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">📦 Mes commandes</h1>
          <button onClick={() => void loadOrders()} className="p-2" aria-label="Actualiser"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar px-2 pb-1">
          {tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex-shrink-0 px-3 py-2 text-sm font-medium', activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground')}>{tab.label}</button>)}
        </div>
      </header>
      <div className="px-4 py-4 space-y-3">
        {loading ? <><SkeletonCard /><SkeletonCard /></> : filtered.map((order) => {
          const status = statusConfig[order.status] ?? statusConfig.en_attente;
          return (
            <button key={order.id} onClick={() => navigate('/orders/' + order.id)} className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left">
              {order.product_image ? <img loading="lazy" src={order.product_image} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Package /></div>}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.product_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{order.seller_name} · Qté : {order.quantity}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-sm font-bold text-primary">{formatFCFA(order.total_price)}</p>
                  <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full', status.color, status.bg)}>{status.label}</span>
                </div>
                {!order.escrow_released && ['payee', 'en_preparation', 'expediee'].includes(order.status) && <p className="text-[10px] text-blue-300 mt-1">🔒 Paiement protégé · fonds bloqués</p>}
              </div>
            </button>
          );
        })}
        {!loading && filtered.length === 0 && <div className="flex flex-col items-center justify-center py-20 text-center"><Package className="w-12 h-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">Aucune commande dans cette catégorie</p></div>}
      </div>
    </div>
  );
};

export default Orders;
