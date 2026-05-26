import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { type DeliveryMethod } from './yango';

interface YangoDeliveryStepProps {
  defaultAddress?: string;
  onContinue: (method: DeliveryMethod, buyerAddress: string) => void;
}

export const YangoDeliveryStep = ({ defaultAddress = '', onContinue }: YangoDeliveryStepProps) => {
  const [method, setMethod] = useState<DeliveryMethod>('yango');
  const [address, setAddress] = useState(defaultAddress);

  const handleContinue = () => {
    if (method === 'yango' && address.trim().length < 5) {
      toast.error('Veuillez renseigner votre adresse de livraison');
      return;
    }
    onContinue(method, address);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Comment voulez-vous recevoir votre commande ?</p>

      {/* Yango card */}
      <button
        onClick={() => setMethod('yango')}
        className={cn(
          'w-full p-4 rounded-2xl border text-left transition-all relative overflow-hidden',
          method === 'yango'
            ? 'border-[#FF6B00] bg-[#FF6B00]/5 shadow-[0_0_20px_rgba(255,107,0,0.3)]'
            : 'border-border/20 bg-[#0A0A0F] hover:border-border/40'
        )}
      >
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#3B82F6] text-[10px] font-bold text-white">
          Recommandé
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00] flex items-center justify-center text-xl shrink-0">
            🛵
          </div>
          <div className="flex-1 pr-16">
            <h4 className="font-bold text-foreground text-sm">Yango Livraison</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Livraison rapide à votre porte</p>
            <div className="flex items-center gap-3 mt-2 text-[11px]">
              <span className="text-[#FF6B00] font-semibold">⏱ 20 - 45 min</span>
              <span className="text-foreground/80">500 - 1 500 FCFA</span>
            </div>
          </div>
          {method === 'yango' && (
            <Check className="absolute bottom-3 right-3 w-5 h-5 text-[#FF6B00]" />
          )}
        </div>
      </button>

      {/* Pickup card */}
      <button
        onClick={() => setMethod('pickup')}
        className={cn(
          'w-full p-4 rounded-2xl border text-left transition-all',
          method === 'pickup'
            ? 'border-[#3B82F6] bg-[#3B82F6]/5 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
            : 'border-border/20 bg-[#0A0A0F] hover:border-border/40'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center text-xl shrink-0">
            🤝
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-foreground text-sm">Retrait en main propre</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Récupérez votre commande directement chez le vendeur
            </p>
            <p className="text-[11px] text-emerald-400 font-semibold mt-2">Gratuit</p>
          </div>
          {method === 'pickup' && <Check className="w-5 h-5 text-[#3B82F6]" />}
        </div>
      </button>

      {/* Address (Yango only) */}
      {method === 'yango' && (
        <div className="animate-fade-in space-y-2 pt-1">
          <label className="text-xs text-foreground font-medium">📍 Votre adresse de livraison</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF6B00]" />
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ex: Rue 12, Quartier Bè, Lomé"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm focus:border-[#FF6B00] transition-colors"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleContinue}
        className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm mt-2"
      >
        Continuer →
      </button>
    </div>
  );
};
