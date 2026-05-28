import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const SpotlightBanner = () => (
  <section className="mx-4 my-4 rounded-2xl border border-[#7C3AED]/30 bg-[#1A1A2E] p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7C3AED]/20">
        <Sparkles className="h-6 w-6 text-[#7C3AED]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7C3AED]">Spotlight de la semaine</p>
        <h2 className="mt-1 text-lg font-bold text-white">Createurs Afrixa a suivre</h2>
        <p className="mt-1 text-sm text-[#9CA3AF]">Les profils et videos selectionnes par Afrixa apparaissent ici en priorite.</p>
      </div>
    </div>
    <Button asChild className="mt-4 w-full bg-[#7C3AED] hover:bg-[#6D28D9]">
      <Link to="/creators/challenges">Voir les challenges</Link>
    </Button>
  </section>
);
