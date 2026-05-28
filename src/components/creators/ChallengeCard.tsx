import { Trophy, Users, Eye } from 'lucide-react';
import { formatCompact, formatFCFA } from '@/lib/creatorFormatters';

export type Challenge = {
  id: string;
  title: string;
  hashtag: string;
  description?: string | null;
  cover_image?: string | null;
  prize_description?: string | null;
  prize_amount?: number | null;
  sponsor_name?: string | null;
  participants_count?: number | null;
  views_count?: number | null;
};

export const ChallengeCard = ({ challenge }: { challenge: Challenge }) => (
  <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A2E]">
    <div
      className="h-32 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(124,58,237,.75), rgba(16,185,129,.35)), url(${challenge.cover_image || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&auto=format&fit=crop'})`,
      }}
    />
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#7C3AED]">{challenge.hashtag}</p>
          <h3 className="text-lg font-bold text-white">{challenge.title}</h3>
        </div>
        <Trophy className="h-5 w-5 shrink-0 text-[#F59E0B]" />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[#9CA3AF]">{challenge.description || 'Défi officiel Afrixa ouvert aux créateurs.'}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-[#9CA3AF]">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{formatCompact(challenge.participants_count)} participants</span>
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatCompact(challenge.views_count)} vues</span>
      </div>
      <div className="mt-4 rounded-xl bg-[#7C3AED]/15 px-3 py-2 text-sm font-bold text-white">
        {challenge.prize_description || formatFCFA(challenge.prize_amount || 0)}
      </div>
    </div>
  </article>
);
