import { useCoins } from '@/hooks/useCoins';
import { formatFCFA } from '@/lib/creatorFormatters';
import { Gift } from 'lucide-react';

export const VirtualGifts = () => {
  const { gifts, loading } = useCoins();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Gift className="h-5 w-5 text-[#7C3AED]" />
        <h2 className="font-bold text-white">Cadeaux virtuels</h2>
      </div>
      {loading ? (
        <p className="text-sm text-[#9CA3AF]">Chargement du catalogue…</p>
      ) : gifts.length === 0 ? (
        <p className="text-sm text-[#9CA3AF]">Le catalogue des cadeaux est indisponible.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {gifts.map((gift) => (
            <div key={gift.id} className="rounded-xl bg-white/5 p-3 text-center">
              <div className="text-3xl">{gift.emoji || '🎁'}</div>
              <p className="mt-2 text-sm font-semibold text-white">{gift.name}</p>
              <p className="text-xs text-[#9CA3AF]">{gift.price_coins} coins</p>
              <p className="text-xs font-semibold text-[#10B981]">{formatFCFA(gift.fcfa_value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
