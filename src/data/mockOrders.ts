export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  productName: string;
  productImage: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: string;
  sellerName: string;
  createdAt: string;
}

export const mockOrders: Order[] = [
  {
    id: 'ord1',
    productName: 'Robe Wax Ankara Premium',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    amount: 15000,
    currency: 'FCFA',
    status: 'confirmed',
    paymentMethod: 'Orange Money',
    sellerName: 'Afri Fashion',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'ord2',
    productName: 'Écouteurs Bluetooth Pro',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=500&fit=crop',
    amount: 8500,
    currency: 'FCFA',
    status: 'delivered',
    paymentMethod: 'Wave',
    sellerName: 'TechZone Africa',
    createdAt: '2024-01-12T14:00:00Z',
  },
  {
    id: 'ord3',
    productName: 'Beurre de Karité Bio 250g',
    productImage: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=500&fit=crop',
    amount: 3500,
    currency: 'FCFA',
    status: 'pending',
    paymentMethod: 'MTN MoMo',
    sellerName: 'NaturAfrik',
    createdAt: '2024-01-16T09:00:00Z',
  },
  {
    id: 'ord4',
    productName: 'Panier Tressé Décoratif',
    productImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=400&h=500&fit=crop',
    amount: 12000,
    currency: 'FCFA',
    status: 'cancelled',
    paymentMethod: 'Moov Money',
    sellerName: 'Afri Fashion',
    createdAt: '2024-01-10T16:00:00Z',
  },
];

export const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  confirmed: { label: 'Confirmé', color: 'text-green-400', bg: 'bg-green-400/10' },
  delivered: { label: 'Livré', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  cancelled: { label: 'Annulé', color: 'text-red-400', bg: 'bg-red-400/10' },
};
