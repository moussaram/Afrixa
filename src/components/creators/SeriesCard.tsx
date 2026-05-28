import { PlaySquare, Users } from 'lucide-react';
import { formatCompact } from '@/lib/creatorFormatters';

export type CreatorSeries = {
  id: string;
  title: string;
  description?: string | null;
  cover_image?: string | null;
  category?: string | null;
  total_episodes?: number | null;
  subscribers_count?: number | null;
  is_complete?: boolean | null;
};

export const SeriesCard = ({ series }: { series: CreatorSeries }) => (
  <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1A2E]">
    <div
      className="aspect-video bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(180deg, transparent, rgba(10,10,15,.85)), url(${series.cover_image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop'})`,
      }}
    />
    <div className="p-4">
      <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
        <PlaySquare className="h-4 w-4 text-[#7C3AED]" />
        {series.total_episodes || 0} épisodes
        <span className="h-1 w-1 rounded-full bg-[#9CA3AF]" />
        <Users className="h-4 w-4 text-[#10B981]" />
        {formatCompact(series.subscribers_count)} abonnés
      </div>
      <h3 className="mt-2 text-lg font-bold text-white">{series.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-[#9CA3AF]">{series.description || 'Série créée pour fidéliser la communauté.'}</p>
    </div>
  </article>
);
