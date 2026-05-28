import { Sparkles, Trophy } from 'lucide-react';
import { CreatorPageShell } from './CreatorPageShell';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { mockUsers, mockVideos } from '@/data/mockData';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';

const SpotlightPage = () => {
  const creator = mockUsers.find((user) => user.followers >= 500000) || mockUsers[0];
  const videos = mockVideos.slice(0, 6);

  return (
    <CreatorPageShell title="Spotlight Afrixa" subtitle="Selection officielle de la semaine">
      <section className="rounded-2xl border border-[#7C3AED]/30 bg-[#1A1A2E] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C3AED]/20">
            <Sparkles className="h-7 w-7 text-[#7C3AED]" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#7C3AED]">Createur de la semaine</p>
            <h2 className="text-xl font-bold text-white">@{creator.username}</h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CreatorBadge level="elite" />
          <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/15 px-3 py-1 text-xs font-bold text-[#F59E0B]">
            <Trophy className="h-3.5 w-3.5" />
            Spotlight officiel
          </span>
        </div>
        <p className="mt-4 text-sm text-[#9CA3AF]">Afrixa met en avant chaque semaine des createurs et videos qui inspirent la communaute.</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-white">Videos selectionnees</h2>
        <div className="grid grid-cols-3 gap-1">
          {videos.map((video) => (
            <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />
          ))}
        </div>
      </section>
    </CreatorPageShell>
  );
};

export default SpotlightPage;
