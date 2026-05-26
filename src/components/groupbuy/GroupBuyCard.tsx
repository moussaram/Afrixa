import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCountdown } from '@/hooks/useCountdown';
import { GroupBuy } from '@/data/mockGroupBuy';
import { GroupBuyDetailSheet } from './GroupBuyDetailSheet';

interface GroupBuyCardProps {
  groupBuy: GroupBuy;
}

export const GroupBuyCard = ({ groupBuy }: GroupBuyCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  const { hours, minutes, expired } = useCountdown(groupBuy.endsAt);

  const currentPrice = getCurrentPrice(groupBuy);
  const progress = (groupBuy.currentMembers / groupBuy.maxMembers) * 100;

  if (expired) return null;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="rounded-2xl bg-card/30 border border-border/20 overflow-hidden cursor-pointer hover:border-border/40 transition-all"
      >
        {/* Image */}
        <div className="relative">
          <img loading="lazy" src={groupBuy.productImage} alt={groupBuy.productName} className="w-full h-44 object-cover" />
          <span className="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold bg-red-500 text-white rounded-lg animate-pulse">
            🔥 GROUP BUY
          </span>
          <span className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium bg-black/60 text-white rounded-lg">
            ⏱️ {hours}h {minutes}min
          </span>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{groupBuy.productName}</h3>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {groupBuy.currentMembers}/{groupBuy.maxMembers} personnes
            </p>
          </div>

          {/* Prices */}
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary">{currentPrice.toLocaleString()} {groupBuy.currency}</span>
            <span className="text-xs text-muted-foreground line-through">{groupBuy.soloPrice.toLocaleString()} {groupBuy.currency}</span>
          </div>

          <button className="w-full py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-xs">
            Rejoindre le groupe
          </button>
        </div>
      </div>

      {showDetail && (
        <GroupBuyDetailSheet groupBuy={groupBuy} onClose={() => setShowDetail(false)} />
      )}
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
