import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee' | 'remboursee';
type OrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_name: string;
  variant_name: string | null;
  product_image: string | null;
  quantity: number;
  total_price: number;
  payment_operator: string | null;
  status: OrderStatus;
  created_at: string;
};

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🟡' },
  payee: { label: 'Payée', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10', emoji: '🟣' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]', bg: 'bg-[#6B7280]/10', emoji: '⚫' },
  remboursee: { label: 'Remboursée', color: 'text-muted-foreground', bg: 'bg-muted', emoji: '↩️' },
};

const tabs = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'delivered', label: 'Livrées' },
  { id: 'cancelled', label: 'Annulées / litiges / remboursées' },
];

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('id, buyer_id, seller_id, product_name, variant_name, product_image, quantity, total_price, payment_operator, status, created_at')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setOrders((data ?? []) as OrderRow[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(order => {
    if (activeTab === 'active') return ['en_attente', 'payee', 'en_preparation', 'expediee'].includes(order.status);
    if (activeTab === 'delivered') return ['livree', 'terminee'].includes(order.status);
    if (activeTab === 'cancelled') return ['annulee', 'litige', 'remboursee'].includes(order.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">📦 Mes commandes</h1>
          <button onClick={() => void loadOrders()} className="p-2 rounded-lg hover:bg-muted" aria-label="Actualiser">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
        <div className="flex px-2 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn('flex-1 py-2 text-xs sm:text-sm font-medium transition-all', activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {!user?.id && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Connecte-toi pour consulter tes commandes.
            <button onClick={() => navigate('/auth/login')} className="block mx-auto mt-3 text-primary underline">Se connecter</button>
          </div>
        )}
        {user?.id && loading && Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-muted animate-pulse" />
        ))}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
            <button onClick={() => void loadOrders()} className="ml-2 underline">Réessayer</button>
          </div>
        )}
        {!loading && !error && user?.id && filtered.map(order => {
          const status = statusConfig[order.status] ?? statusConfig.en_attente;
          return (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full flex gap-3 p-4 rounded-2xl bg-card border border-border/20 text-left transition-all hover:border-primary/30"
            >
              {order.product_image ? (
                <img loading="lazy" src={order.product_image} alt={order.product_name} className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.product_name}</h3>
                {order.variant_name && <p className="text-xs text-muted-foreground">{order.variant_name}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.buyer_id === user?.id ? 'Achat' : 'Vente'} · Qté {order.quantity}
                  {order.payment_operator ? ` · ${order.payment_operator}` : ''}
                </p>
                <p className="text-[10px] text-muted-foreground">{new Date(order.created_at).toLocaleString('fr-FR')}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold text-primary">{order.total_price.toLocaleString('fr-FR')} FCFA</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', status.color, status.bg)}>{status.emoji} {status.label}</span>
                </div>
              </div>
            </button>
          );
        })}
        {!loading && !error && user?.id && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune commande dans cette catégorie.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
