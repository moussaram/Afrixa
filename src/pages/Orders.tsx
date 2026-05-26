import { useState } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';

interface MockOrder {
  id: string;
  orderNumber: string;
  productName: string;
  productImage: string;
  sellerName: string;
  sellerAvatar: string;
  quantity: number;
  totalPrice: number;
  currency: string;
  paymentOperator: string;
  status: OrderStatus;
  createdAt: string;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', emoji: '🟡' },
  payee: { label: 'Payée', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', emoji: '🔵' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', bg: 'bg-[#7C3AED]/10', emoji: '🟣' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', bg: 'bg-[#34D399]/10', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]', bg: 'bg-[#6B7280]/10', emoji: '⚫' },
};

const mockOrders: MockOrder[] = [
  {
    id: '1', orderNumber: '#AFR-847291', productName: 'Robe Wax Ankara Premium',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    sellerName: '@afrifashion', sellerAvatar: 'https://i.pravatar.cc/100?img=1',
    quantity: 1, totalPrice: 15000, currency: 'FCFA', paymentOperator: 'Orange Money',
    status: 'expediee', createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2', orderNumber: '#AFR-392017', productName: 'Écouteurs Bluetooth Pro',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=500&fit=crop',
    sellerName: '@techzone', sellerAvatar: 'https://i.pravatar.cc/100?img=2',
    quantity: 2, totalPrice: 17000, currency: 'FCFA', paymentOperator: 'Wave',
    status: 'livree', createdAt: '2024-01-12T14:00:00Z',
  },
  {
    id: '3', orderNumber: '#AFR-610483', productName: 'Beurre de Karité Bio 250g',
    productImage: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=500&fit=crop',
    sellerName: '@naturafrik', sellerAvatar: 'https://i.pravatar.cc/100?img=3',
    quantity: 1, totalPrice: 3500, currency: 'FCFA', paymentOperator: 'MTN MoMo',
    status: 'en_preparation', createdAt: '2024-01-16T09:00:00Z',
  },
  {
    id: '4', orderNumber: '#AFR-158702', productName: 'Panier Tressé Décoratif',
    productImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=500&fit=crop',
    sellerName: '@artisanmali', sellerAvatar: 'https://i.pravatar.cc/100?img=4',
    quantity: 1, totalPrice: 12000, currency: 'FCFA', paymentOperator: 'Moov Money',
    status: 'annulee', createdAt: '2024-01-10T16:00:00Z',
  },
];

const tabs = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'delivered', label: 'Livrées' },
  { id: 'cancelled', label: 'Annulées' },
];

const Orders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');

  const filtered = mockOrders.filter(o => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ['en_attente', 'payee', 'en_preparation', 'expediee'].includes(o.status);
    if (activeTab === 'delivered') return ['livree', 'terminee'].includes(o.status);
    if (activeTab === 'cancelled') return ['annulee', 'litige'].includes(o.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">📦 Mes commandes</h1>
        </div>
        <div className="flex px-2 pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-all',
                activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {filtered.map(order => {
          const status = statusConfig[order.status];
          return (
            <button
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full flex gap-3 p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 text-left transition-all hover:border-primary/30"
            >
              <img loading="lazy" src={order.productImage} alt={order.productName} className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{order.productName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{order.sellerName} · {order.paymentOperator}</p>
                <p className="text-[10px] text-muted-foreground">{order.orderNumber}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-bold text-primary">{order.totalPrice.toLocaleString()} {order.currency}</p>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', status.color, status.bg)}>
                    {status.emoji} {status.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune commande dans cette catégorie</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
