import { Crown, Check } from 'lucide-react';
import { formatFCFA } from '@/lib/creatorFormatters';

type FanClubCardProps = {
  name?: string;
  description?: string;
  priceMonthly?: number;
  perks?: string[];
};

export const FanClubCard = ({
  name = 'Fan Club Afrixa',
  description = 'Contenus exclusifs, badge Fan et accès prioritaire au créateur.',
  priceMonthly = 1000,
  perks = ['Vidéos exclusives', 'Badge Fan', 'Chat privé membres'],
}: FanClubCardProps) => (
  <div className="rounded-2xl border border-[#F59E0B]/30 bg-[#1A1A2E] p-5">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F59E0B]/15">
        <Crown className="h-6 w-6 text-[#F59E0B]" />
      </div>
      <div>
        <h2 className="font-bold text-white">{name}</h2>
        <p className="text-sm text-[#9CA3AF]">{formatFCFA(priceMonthly)} / mois</p>
      </div>
    </div>
    <p className="mt-4 text-sm text-[#9CA3AF]">{description}</p>
    <div className="mt-4 space-y-2">
      {perks.map((perk) => (
        <p key={perk} className="flex items-center gap-2 text-sm text-white">
          <Check className="h-4 w-4 text-[#10B981]" />
          {perk}
        </p>
      ))}
    </div>
  </div>
);
