export interface GroupBuyTier {
  minPeople: number;
  price: number;
}

export interface GroupBuy {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  productDescription: string;
  category: string;
  currency: string;
  soloPrice: number;
  tiers: GroupBuyTier[];
  currentMembers: number;
  maxMembers: number;
  endsAt: string; // ISO date
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerVerified: boolean;
  memberAvatars: string[];
}

// Helper to create future dates
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

export const mockGroupBuys: GroupBuy[] = [
  {
    id: 'gb1',
    productId: 'p1',
    productName: 'Robe Wax Ankara Premium',
    productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
    productDescription: 'Magnifique robe en wax africain, taille S-XL',
    category: 'Mode',
    currency: 'FCFA',
    soloPrice: 15000,
    tiers: [
      { minPeople: 5, price: 10000 },
      { minPeople: 10, price: 7000 },
    ],
    currentMembers: 3,
    maxMembers: 10,
    endsAt: hoursFromNow(18),
    sellerId: 's1',
    sellerName: 'Afri Fashion',
    sellerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    sellerVerified: true,
    memberAvatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
    ],
  },
  {
    id: 'gb2',
    productId: 'p2',
    productName: 'Écouteurs Bluetooth Pro',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=500&fit=crop',
    productDescription: 'Son HD, autonomie 24h, résistant à la sueur',
    category: 'Électronique',
    currency: 'FCFA',
    soloPrice: 8500,
    tiers: [
      { minPeople: 5, price: 6000 },
      { minPeople: 15, price: 4500 },
    ],
    currentMembers: 7,
    maxMembers: 15,
    endsAt: hoursFromNow(6),
    sellerId: 's2',
    sellerName: 'TechZone Africa',
    sellerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    sellerVerified: true,
    memberAvatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop&crop=face',
    ],
  },
  {
    id: 'gb3',
    productId: 'p3',
    productName: 'Beurre de Karité Bio 250g',
    productImage: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=500&fit=crop',
    productDescription: '100% naturel, pressé à froid, du Burkina Faso',
    category: 'Beauté',
    currency: 'FCFA',
    soloPrice: 3500,
    tiers: [
      { minPeople: 10, price: 2500 },
      { minPeople: 20, price: 2000 },
    ],
    currentMembers: 12,
    maxMembers: 20,
    endsAt: hoursFromNow(36),
    sellerId: 's3',
    sellerName: 'NaturAfrik',
    sellerAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    sellerVerified: false,
    memberAvatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=face',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
    ],
  },
  {
    id: 'gb4',
    productId: 'p6',
    productName: 'Lampe Solaire LED',
    productImage: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&h=500&fit=crop',
    productDescription: 'Rechargeable solaire, 3 modes, pour intérieur/extérieur',
    category: 'Maison',
    currency: 'FCFA',
    soloPrice: 6500,
    tiers: [
      { minPeople: 5, price: 5000 },
      { minPeople: 10, price: 4000 },
    ],
    currentMembers: 1,
    maxMembers: 10,
    endsAt: hoursFromNow(42),
    sellerId: 's2',
    sellerName: 'TechZone Africa',
    sellerAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    sellerVerified: true,
    memberAvatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop&crop=face',
    ],
  },
];
