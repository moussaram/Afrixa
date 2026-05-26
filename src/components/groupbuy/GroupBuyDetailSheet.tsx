import { useState } from 'react';
import { X, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import { GroupBuy } from '@/data/mockGroupBuy';
import { AfrixaPaySheet } from '@/components/payment/AfrixaPaySheet';

interface GroupBuyDetailSheetProps {
  groupBuy: GroupBuy;
  onClose: () => void;
}

export const GroupBuyDetailSheet = ({ groupBuy, onClose }: GroupBuyDetailSheetProps) => {
  const [showPayment, setShowPayment] = useState(false);
  const { hours, minutes, seconds } = useCountdown(groupBuy.endsAt);

  const currentPrice = getCurrentPrice(groupBuy);
  const progress = (groupBuy.currentMembers / groupBuy.maxMembers) * 100;

  if (showPayment) {
    return (
      <AfrixaPaySheet
        product={{
          name: groupBuy.productName,
          price: groupBuy.soloPrice,
          currency: groupBuy.currency,
          imageUrl: groupBuy.productImage,
          sellerName: groupBuy.sellerName,
          sellerVerified: groupBuy.sellerVerified,
        }}
        customPrice={currentPrice}
        subtitle="Vous ne serez débité que si le groupe atteint le palier minimum avant la fin du délai"
        onClose={onClose}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-[hsl(var(--background))] rounded-t-3xl border-t border-border/30 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-bold text-foreground">🔥 Détail du Group Buy</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-5">
          {/* Product */}
          <div className="flex gap-4 p-4 rounded-2xl bg-card/30 border border-border/20">
            <img loading="lazy" src={groupBuy.productImage} alt={groupBuy.productName} className="w-20 h-20 rounded-xl object-cover" />
            <div className="flex-1">
              <h4 className="font-semibold text-foreground text-sm">{groupBuy.productName}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{groupBuy.productDescription}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">{groupBuy.sellerName}</span>
                {groupBuy.sellerVerified && <span className="text-xs text-primary">✓</span>}
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400 tabular-nums">
              {String(hours).padStart(2, '0')}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s
            </span>
          </div>

          {/* Price tiers */}
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-foreground">Paliers de prix</h5>
            <div className="space-y-2">
              {/* Solo tier */}
              <div className={cn(
                'flex justify-between items-center px-4 py-3 rounded-xl border',
                groupBuy.currentMembers < groupBuy.tiers[0].minPeople
                  ? 'border-primary bg-primary/5'
                  : 'border-border/20 bg-card/20'
              )}>
                <span className="text-sm text-foreground">1-{groupBuy.tiers[0].minPeople - 1} personnes</span>
                <span className="text-sm font-bold text-foreground">{groupBuy.soloPrice.toLocaleString()} {groupBuy.currency}</span>
              </div>
              {groupBuy.tiers.map((tier, i) => {
                const nextMin = groupBuy.tiers[i + 1]?.minPeople ?? groupBuy.maxMembers + 1;
                const isActive = groupBuy.currentMembers >= tier.minPeople && groupBuy.currentMembers < nextMin;
                return (
                  <div key={i} className={cn(
                    'flex justify-between items-center px-4 py-3 rounded-xl border',
                    isActive ? 'border-primary bg-primary/5' : 'border-border/20 bg-card/20'
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {tier.minPeople}{groupBuy.tiers[i + 1] ? `-${groupBuy.tiers[i + 1].minPeople - 1}` : '+'} personnes
                      </span>
                      {isActive && <span className="text-[10px] text-primary font-bold">← actuel</span>}
                    </div>
                    <span className="text-sm font-bold text-primary">{tier.price.toLocaleString()} {groupBuy.currency}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{groupBuy.currentMembers}/{groupBuy.maxMembers}</span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Avatars */}
            <div className="flex -space-x-2">
              {groupBuy.memberAvatars.slice(0, 5).map((av, i) => (
                <img loading="lazy" key={i} src={av} className="w-8 h-8 rounded-full border-2 border-[hsl(var(--background))] object-cover" alt="" />
              ))}
              {groupBuy.currentMembers > 5 && (
                <div className="w-8 h-8 rounded-full bg-muted border-2 border-[hsl(var(--background))] flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">+{groupBuy.currentMembers - 5}</span>
                </div>
              )}
            </div>
          </div>

          {/* Join button */}
          <button
            onClick={() => setShowPayment(true)}
            className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
          >
            Rejoindre pour {currentPrice.toLocaleString()} {groupBuy.currency}
          </button>
        </div>
      </div>
    </>
  );
};

function getCurrentPrice(gb: GroupBuy): number {
  let price = gb.soloPrice;
  for (const tier of gb.tiers) {
    if (gb.currentMembers >= tier.minPeople) price = tier.price;
  }
  return price;
}
