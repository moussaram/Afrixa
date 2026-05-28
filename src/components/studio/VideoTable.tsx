import { formatCompact } from '@/lib/creatorFormatters';

type VideoRow = {
  id: string;
  title?: string | null;
  views?: number | null;
  completion_rate?: number | null;
  likes?: number | null;
};

export const VideoTable = ({ videos }: { videos: VideoRow[] }) => (
  <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
    <h2 className="mb-4 font-bold text-white">Performances vidéos</h2>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-[#9CA3AF]">
          <tr className="border-b border-white/10">
            <th className="py-3 font-medium">Vidéo</th>
            <th className="py-3 font-medium">Vues</th>
            <th className="py-3 font-medium">Completion</th>
            <th className="py-3 font-medium">Likes</th>
          </tr>
        </thead>
        <tbody className="text-white">
          {videos.length === 0 ? (
            <tr>
              <td className="py-6 text-[#9CA3AF]" colSpan={4}>Aucune donnée vidéo pour le moment.</td>
            </tr>
          ) : (
            videos.map((video) => (
              <tr key={video.id} className="border-b border-white/5">
                <td className="py-3">{video.title || 'Vidéo sans titre'}</td>
                <td className="py-3">{formatCompact(video.views)}</td>
                <td className="py-3">{Math.round((video.completion_rate || 0) * 100)}%</td>
                <td className="py-3">{formatCompact(video.likes)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
