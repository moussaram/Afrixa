export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl: string;
  category: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerVerified: boolean;
  stock: number;
  city: string;
  country: string;
  views: number;
  sales: number;
  rating: number;
  createdAt: string;
}

export interface Shop {
  id: string;
  name: string;
  avatar: string;
  description: string;
  verified: boolean;
  productCount: number;
  followers: number;
  rating: number;
  city: string;
  country: string;
}

export interface ShoppableVideo {
  id: string;
  thumbnailUrl: string;
  videoUrl: string;
  productId: string;
  productName: string;
  productPrice: number;
  productCurrency: string;
  productImage: string;
  views: number;
  sellerName: string;
}

export type MarketplaceCategory = 'Mode' | 'Électronique' | 'Beauté' | 'Artisanat' | 'Alimentation' | 'Maison';
