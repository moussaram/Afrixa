import { Wallet, Clock, TrendingUp } from 'lucide-react';
import { formatFCFA } from '@/lib/creatorFormatters';

type CreatorWalletProps = {
  balance?: number;
  pending?: number;
  totalEarned?: number;
};

export const CreatorWallet = ({ balance = 0, pending = 0, totalEarned = 0 }: CreatorWalletProps) => {
  const stats = [
    { label: 'Disponible', value: formatFCFA(balance), icon: Wallet },
    { label: 'En attente', value: formatFCFA(pending), icon: Clock },
    { label: 'Total gagné', value: formatFCFA(totalEarned), icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <Icon className="mb-3 h-5 w-5 text-[#7C3AED]" />
            <p className="text-sm text-[#9CA3AF]">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
};
