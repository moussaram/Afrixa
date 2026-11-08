import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';

interface OrderRow {
  id: string;
  product_name: string;
  product_image: string | null;
  seller_id: string;
  quantity: number;
  total_price: number;
  payment_operator: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🟡' },
  payee: { label: 'Payée', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10', emoji: '🟣' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]', bg: 'bg-[#6B7280]/10', emoji: '⚫' },
};

const tabs = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'delivered', label: 'Livrées' },
  { id: 'cancelled', label: 'Annulées' },
];

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setError('Connectez-vous pour consulter vos commandes.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id, product_name, product_image, seller_id, quantity, total_price, payment_operator, status, created_at')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, 49);
    if (queryError) {
      setError('Impossible de charger vos commandes. Réessayez.');
      setOrders([]);
    } else {
      setOrders((data ?? []) as OrderRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(order => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['en_attente', 'payee', 'en_preparation', 'expediee'].includes(order.status);
    if (activeTab === 'delivered') return ['livree', 'terminee'].includes(order.status);
    if (activeTab === 'cancelled') return ['annulee', 'litige'].includes(order.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">📦 Mes commandes</h1>
          <button onClick={() => void loadOrders()} className="p-2" aria-label="Actualiser" disabled={loading}>
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="flex px-2 pb-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex-1 py-2 text-sm font-medium transition-all',
                activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground')}>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {loading && <p className="py-12 text-center text-sm text-muted-foreground">Chargement de vos commandes…</p>}
        {!loading && error && (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => void loadOrders()} className="text-sm text-primary font-semibold">Réessayer</button>
          </div>
        )}
        {!loading && !error && filtered.map(order => {
          const status = statusConfig[order.status] ?? statusConfig.en_attente;
          return (
            <button key={order.id} onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left transition-all hover:border-primary/30">
              {order.product_image ? (
                <img loading="lazy" src={order.product_image} alt={order.product_name} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.product_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{order.quantity} article(s) · {order.payment_operator || 'Paiement'}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold text-primary">{Number(order.total_price).toLocaleString('fr-FR')} FCFA</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', status.color, status.bg)}>{status.emoji} {status.label}</span>
                </div>
              </div>
            </button>
          );
        })}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune commande réelle dans cette catégorie</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
