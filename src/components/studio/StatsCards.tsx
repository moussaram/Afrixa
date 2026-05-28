import { Eye, Heart, Users, Wallet } from 'lucide-react';
import { formatCompact, formatFCFA } from '@/lib/creatorFormatters';

type StatsCardsProps = {
  totalViews?: number;
  followers?: number;
  totalLikes?: number;
  monthlyRevenue?: number;
};

export const StatsCards = ({ totalViews = 0, followers = 0, totalLikes = 0, monthlyRevenue = 0 }: StatsCardsProps) => {
  const stats = [
    { label: 'Vues totales', value: formatCompact(totalViews), icon: Eye, color: 'text-[#7C3AED]' },
    { label: 'Abonnés', value: formatCompact(followers), icon: Users, color: 'text-[#10B981]' },
    { label: 'Likes', value: formatCompact(totalLikes), icon: Heart, color: 'text-[#EF4444]' },
    { label: 'Revenus du mois', value: formatFCFA(monthlyRevenue), icon: Wallet, color: 'text-[#F59E0B]' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <Icon className={`mb-3 h-5 w-5 ${stat.color}`} />
            <p className="text-xs text-[#9CA3AF]">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
};
