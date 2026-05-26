import { useState } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AfrixaPayment } from '@/components/payment/AfrixaPayment';

interface ProductBottomSheetProps {
  product: {
    id?: string;
    name: string;
    price: number;
    currency: string;
    imageUrl: string;
    sellerName: string;
    sellerId?: string;
    sellerVerified?: boolean;
  };
  onClose: () => void;
}

export const ProductBottomSheet = ({ product, onClose }: ProductBottomSheetProps) => {
  const [showPayment, setShowPayment] = useState(false);

  if (showPayment) {
    return <AfrixaPayment product={product} onClose={onClose} />;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl border-t border-border/30 animate-slide-up">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-foreground">Produit tagué</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 pb-6">
          <div className="flex gap-4 p-3 rounded-2xl bg-card/30 border border-border/20">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-24 h-24 rounded-xl object-cover"
            />
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h4 className="font-semibold text-foreground text-sm">{product.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{product.sellerName}</p>
              </div>
              <p className="text-lg font-bold text-primary">
                {product.price.toLocaleString()} {product.currency}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            className="w-full mt-4 py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Acheter
          </button>
        </div>
      </div>
    </>
  );
};
