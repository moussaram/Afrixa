import { Gift } from 'lucide-react';
import { formatFCFA } from '@/lib/creatorFormatters';

const gifts = [
  { name: 'Rose', emoji: '🌹', coins: 10, value: 50 },
  { name: 'Coeur', emoji: '💜', coins: 50, value: 250 },
  { name: 'Lion', emoji: '🦁', coins: 200, value: 1000 },
  { name: 'Couronne', emoji: '👑', coins: 500, value: 2500 },
  { name: 'Diamant', emoji: '💎', coins: 2000, value: 10000 },
];

export const VirtualGifts = () => (
  <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
    <div className="mb-4 flex items-center gap-2">
      <Gift className="h-5 w-5 text-[#7C3AED]" />
      <h2 className="font-bold text-white">Cadeaux virtuels</h2>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {gifts.map((gift) => (
        <div key={gift.name} className="rounded-xl bg-white/5 p-3 text-center">
          <div className="text-3xl">{gift.emoji}</div>
          <p className="mt-2 text-sm font-semibold text-white">{gift.name}</p>
          <p className="text-xs text-[#9CA3AF]">{gift.coins} coins</p>
          <p className="text-xs font-semibold text-[#10B981]">{formatFCFA(gift.value)}</p>
        </div>
      ))}
    </div>
  </div>
);
