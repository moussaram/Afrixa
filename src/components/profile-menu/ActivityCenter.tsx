import { useState } from 'react';
import { Heart, MessageCircle, Eye, UserPlus, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { mockVideos, mockUsers } from '@/data/mockData';

type ActivityTab = 'watch' | 'likes' | 'comments' | 'interactions';

const tabs = [
  { id: 'watch' as ActivityTab, label: 'Vus', icon: Eye },
  { id: 'likes' as ActivityTab, label: 'J\'aime', icon: Heart },
  { id: 'comments' as ActivityTab, label: 'Commentaires', icon: MessageCircle },
  { id: 'interactions' as ActivityTab, label: 'Activité', icon: UserPlus },
];

const mockWatchHistory = mockVideos.map((v, i) => ({
  ...v,
  watchedAt: new Date(Date.now() - i * 3600000 * 2).toISOString(),
  watchProgress: Math.floor(Math.random() * 100),
}));

const mockComments = [
  { id: '1', video: mockVideos[0], comment: '🔥 Incroyable cette vidéo !', date: '2h' },
  { id: '2', video: mockVideos[2], comment: 'Trop drôle 😂', date: '1j' },
  { id: '3', video: mockVideos[4], comment: 'Je vais essayer cette recette !', date: '2j' },
];

const mockInteractions = [
  { id: '1', user: mockUsers[0], action: 'a commencé à vous suivre', icon: UserPlus, date: '30min' },
  { id: '2', user: mockUsers[1], action: 'a aimé votre vidéo', icon: Heart, date: '1h' },
  { id: '3', user: mockUsers[2], action: 'a commenté votre vidéo', icon: MessageCircle, date: '3h' },
  { id: '4', user: mockUsers[3], action: 'a aimé votre vidéo', icon: Heart, date: '5h' },
];

export const ActivityCenter = () => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('watch');

  const formatTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}j`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border/30 px-2 pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
        <span className="text-xs text-muted-foreground">7 derniers jours</span>
        <Button variant="ghost" size="iconSm">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'watch' && (
          <div className="divide-y divide-border/20">
            {mockWatchHistory.map((video) => (
              <div key={video.id} className="flex items-center gap-3 px-4 py-3">
                <img loading="lazy"
                  src={video.thumbnailUrl}
                  alt=""
                  className="w-14 h-20 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">@{video.user.username}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {formatNumber(video.views)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 inline mr-1" />{formatTime(video.watchedAt)}
                    </span>
                  </div>
                  <div className="mt-1.5 w-full bg-muted/30 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-primary"
                      style={{ width: `${video.watchProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {mockVideos.map((video) => (
              <div key={video.id} className="relative aspect-[9/16]">
                <img loading="lazy" src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                  <Heart className="w-3 h-3 text-destructive fill-destructive" />
                  <span className="text-white text-xs font-bold drop-shadow">{formatNumber(video.likes)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="divide-y divide-border/20">
            {mockComments.map((item) => (
              <div key={item.id} className="flex gap-3 px-4 py-3">
                <img loading="lazy"
                  src={item.video.thumbnailUrl}
                  alt=""
                  className="w-12 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm text-foreground">"{item.comment}"</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.video.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Il y a {item.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'interactions' && (
          <div className="divide-y divide-border/20">
            {mockInteractions.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <img loading="lazy" src={item.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">@{item.user.username} </span>
                    <span className="text-sm text-muted-foreground">{item.action}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Il y a {item.date}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
