import { useState } from 'react';
import { Download, Trash2, Play, WifiOff, HardDrive, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mockVideos } from '@/data/mockData';
import { formatNumber } from '@/lib/formatters';
import { toast } from 'sonner';

interface DownloadedVideo {
  id: string;
  thumbnailUrl: string;
  description: string;
  username: string;
  size: string;
  downloadedAt: string;
  progress?: number;
}

export const OfflineVideos = () => {
  const [downloaded, setDownloaded] = useState<DownloadedVideo[]>([
    {
      id: '2',
      thumbnailUrl: mockVideos[1].thumbnailUrl,
      description: mockVideos[1].description,
      username: mockVideos[1].user.username,
      size: '42 MB',
      downloadedAt: '2j',
    },
    {
      id: '4',
      thumbnailUrl: mockVideos[3].thumbnailUrl,
      description: mockVideos[3].description,
      username: mockVideos[3].user.username,
      size: '28 MB',
      downloadedAt: '5j',
    },
  ]);

  const [downloading, setDownloading] = useState<Record<string, number>>({});

  const handleDownload = (video: typeof mockVideos[0]) => {
    if (downloaded.find(d => d.id === video.id)) return;
    setDownloading(prev => ({ ...prev, [video.id]: 0 }));

    const interval = setInterval(() => {
      setDownloading(prev => {
        const current = prev[video.id] ?? 0;
        if (current >= 100) {
          clearInterval(interval);
          setDownloaded(d => [...d, {
            id: video.id,
            thumbnailUrl: video.thumbnailUrl,
            description: video.description,
            username: video.user.username,
            size: `${Math.floor(Math.random() * 50 + 20)} MB`,
            downloadedAt: 'À l\'instant',
          }]);
          const { [video.id]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [video.id]: current + 10 };
      });
    }, 200);
    toast.success('Téléchargement démarré');
  };

  const handleDelete = (id: string) => {
    setDownloaded(d => d.filter(v => v.id !== id));
    toast.success('Vidéo supprimée du stockage');
  };

  const totalSize = downloaded.reduce((sum, v) => sum + parseInt(v.size), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Storage info */}
      <div className="mx-4 mt-4 mb-3 rounded-2xl bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <HardDrive className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{downloaded.length} vidéo{downloaded.length > 1 ? 's' : ''} hors ligne</p>
          <p className="text-xs text-muted-foreground">{totalSize} MB utilisés</p>
        </div>
        <WifiOff className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Downloaded videos */}
      {downloaded.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Téléchargés</p>
          <div className="space-y-2">
            {downloaded.map(video => (
              <div key={video.id} className="flex items-center gap-3 bg-card/30 rounded-xl p-2.5">
                <div className="relative">
                  <img loading="lazy" src={video.thumbnailUrl} alt="" className="w-14 h-20 object-cover rounded-lg" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">@{video.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-muted-foreground">{video.size} · {video.downloadedAt}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => handleDelete(video.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available to download */}
      <div className="px-4 flex-1 overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Disponibles au téléchargement</p>
        <div className="space-y-2">
          {mockVideos.filter(v => !downloaded.find(d => d.id === v.id)).map(video => {
            const progress = downloading[video.id];
            const isDownloading = progress !== undefined;
            return (
              <div key={video.id} className="flex items-center gap-3 bg-card/30 rounded-xl p-2.5">
                <img loading="lazy" src={video.thumbnailUrl} alt="" className="w-14 h-20 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">@{video.user.username}</p>
                  {isDownloading && (
                    <div className="mt-1.5">
                      <div className="w-full bg-muted/30 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-primary mt-0.5">{progress}%</p>
                    </div>
                  )}
                </div>
                <Button
                  variant={isDownloading ? 'ghost' : 'outline'}
                  size="iconSm"
                  onClick={() => handleDownload(video)}
                  disabled={isDownloading}
                  className={cn('shrink-0', !isDownloading && 'text-primary border-primary/30 hover:bg-primary/10')}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
