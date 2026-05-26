import { useState } from 'react';
import { ArrowLeft, Package, TrendingUp, Clock, DollarSign, AlertTriangle, Check, MessageCircle, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type OrderStatus = 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige';

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; emoji: string }> = {
  payee: { label: 'Nouvelle', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🔴' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '📦' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10', emoji: '🚚' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', emoji: '🔴' },
};

interface SellerOrder {
  id: string;
  orderNumber: string;
  productName: string;
  productImage: string;
  buyerName: string;
  buyerAvatar: string;
  quantity: number;
  totalPrice: number;
  commission: number;
  sellerAmount: number;
  currency: string;
  status: OrderStatus;
  deliveryAddress: string;
  buyerNote: string;
  createdAt: string;
}

const mockSellerOrders: SellerOrder[] = [
  {
    id: '1', orderNumber: '#AFR-847291', productName: 'Robe Wax Ankara Premium',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    buyerName: '@amina_ci', buyerAvatar: 'https://i.pravatar.cc/100?img=5',
    quantity: 1, totalPrice: 15000, commission: 750, sellerAmount: 14250, currency: 'FCFA',
    status: 'payee', deliveryAddress: 'Cocody, Abidjan', buyerNote: 'Taille M', createdAt: '2024-01-16',
  },
  {
    id: '2', orderNumber: '#AFR-392017', productName: 'Ensemble Bogolan',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    buyerName: '@moussa_bko', buyerAvatar: 'https://i.pravatar.cc/100?img=6',
    quantity: 2, totalPrice: 30000, commission: 1500, sellerAmount: 28500, currency: 'FCFA',
    status: 'en_preparation', deliveryAddress: 'Bamako, Mali', buyerNote: '', createdAt: '2024-01-15',
  },
  {
    id: '3', orderNumber: '#AFR-610483', productName: 'Sac en Cuir Artisanal',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    buyerName: '@fatou_dkr', buyerAvatar: 'https://i.pravatar.cc/100?img=7',
    quantity: 1, totalPrice: 25000, commission: 1250, sellerAmount: 23750, currency: 'FCFA',
    status: 'terminee', deliveryAddress: 'Dakar, Sénégal', buyerNote: 'Livraison rapide svp', createdAt: '2024-01-10',
  },
];

const tabs = [
  { id: 'payee', label: 'Nouvelles 🔴' },
  { id: 'en_preparation', label: 'Préparation' },
  { id: 'expediee', label: 'Expédiées' },
  { id: 'terminee', label: 'Terminées' },
  { id: 'litige', label: 'Litiges' },
];

const SellerSales = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('payee');
  const [orders, setOrders] = useState(mockSellerOrders);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  const filtered = orders.filter(o => {
    if (activeTab === 'terminee') return ['livree', 'terminee'].includes(o.status);
    return o.status === activeTab;
  });

  const stats = [
    { label: 'Ventes du jour', value: '45 000', icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'En attente', value: String(orders.filter(o => o.status === 'payee').length), icon: Clock, color: 'text-[#F59E0B]' },
    { label: 'Expédiées', value: String(orders.filter(o => o.status === 'expediee').length), icon: Package, color: 'text-[#7C3AED]' },
    { label: 'Revenus mois', value: '245K', icon: DollarSign, color: 'text-primary' },
  ];

  const handlePrepare = (order: SellerOrder) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'en_preparation' as OrderStatus } : o));
    setSelectedOrder(null);
    toast.success('Commande en préparation');
  };

  const handleShip = (order: SellerOrder) => {
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'expediee' as OrderStatus } : o));
    setShowShipModal(false);
    setSelectedOrder(null);
    toast.success('Commande marquée comme expédiée ! L\'acheteur a été notifié.');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">🛍️ Mes ventes</h1>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-4 py-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-2 rounded-xl bg-[#1A1A2E] border border-border/20 text-center">
              <Icon className={cn('w-4 h-4 mx-auto mb-1', s.color)} />
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar px-2 border-b border-border/20">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-all whitespace-nowrap',
              activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="px-4 py-4 space-y-3">
        {filtered.map(order => {
          const sc = statusConfig[order.status];
          return (
            <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left transition-all hover:border-primary/30"
            >
              <img loading="lazy" src={order.productImage} alt="" className="w-14 h-14 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.productName}</h3>
                <p className="text-xs text-muted-foreground">{order.buyerName} · Qté: {order.quantity}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-sm font-bold text-emerald-400">{order.sellerAmount.toLocaleString()} {order.currency}</p>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', sc.color, sc.bg)}>
                    {sc.emoji} {sc.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Aucune commande ici</p>
          </div>
        )}
      </div>

      {/* Order detail sheet */}
      {selectedOrder && !showShipModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setSelectedOrder(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[#1A1A2E] rounded-t-[20px] max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">{selectedOrder.orderNumber}</h3>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                  statusConfig[selectedOrder.status].color, statusConfig[selectedOrder.status].bg)}>
                  {statusConfig[selectedOrder.status].label}
                </span>
              </div>

              {/* Buyer info */}
              <div className="p-4 rounded-xl bg-[#0A0A0F] space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Acheteur</h4>
                <div className="flex items-center gap-3">
                  <img loading="lazy" src={selectedOrder.buyerAvatar} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedOrder.buyerName}</p>
                    <p className="text-xs text-muted-foreground">{selectedOrder.deliveryAddress}</p>
                  </div>
                </div>
                {selectedOrder.buyerNote && (
                  <p className="text-xs text-muted-foreground italic">📝 "{selectedOrder.buyerNote}"</p>
                )}
              </div>

              {/* Financial */}
              <div className="p-4 rounded-xl bg-[#052e16] border border-[#10B981]/30 space-y-2">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase">Détail financier</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix total</span>
                  <span className="text-foreground">{selectedOrder.totalPrice.toLocaleString()} {selectedOrder.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commission Afrixa (5%)</span>
                  <span className="text-[#EF4444]">-{selectedOrder.commission.toLocaleString()} {selectedOrder.currency}</span>
                </div>
                <div className="border-t border-emerald-800 pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-emerald-400">Vous recevrez</span>
                  <span className="text-lg font-bold text-emerald-400">{selectedOrder.sellerAmount.toLocaleString()} {selectedOrder.currency}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Versement après confirmation de livraison</p>
              </div>

              {/* Actions */}
              <div className="space-y-3 pb-4">
                {selectedOrder.status === 'payee' && (
                  <button
                    onClick={() => handlePrepare(selectedOrder)}
                    className="w-full py-3 rounded-xl bg-[#3B82F6] text-white font-semibold text-sm"
                  >
                    📦 Confirmer et préparer
                  </button>
                )}
                {selectedOrder.status === 'en_preparation' && (
                  <button
                    onClick={() => setShowShipModal(true)}
                    className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
                  >
                    🚚 Marquer comme expédiée
                  </button>
                )}
                <button className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Contacter l'acheteur
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ship confirmation modal */}
      {showShipModal && selectedOrder && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => setShowShipModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] bg-[#1A1A2E] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground text-center">Confirmer l'expédition</h3>
            <input
              type="text"
              placeholder="Numéro de suivi (optionnel)"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
            />
            <p className="text-xs text-muted-foreground text-center">
              L'acheteur sera notifié et aura 7 jours pour confirmer la réception.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowShipModal(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">
                Annuler
              </button>
              <button onClick={() => handleShip(selectedOrder)} className="flex-1 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
                Confirmer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SellerSales;
