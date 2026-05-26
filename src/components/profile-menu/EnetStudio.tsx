import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle, Video, Calendar, Clock, ChevronRight, Play, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { mockVideos } from '@/data/mockData';

type StudioTab = 'stats' | 'videos' | 'drafts' | 'schedule';

const studioTabs = [
  { id: 'stats' as StudioTab, label: 'Stats', icon: BarChart3 },
  { id: 'videos' as StudioTab, label: 'Vidéos', icon: Video },
  { id: 'drafts' as StudioTab, label: 'Brouillons', icon: Pencil },
  { id: 'schedule' as StudioTab, label: 'Planifiées', icon: Calendar },
];

const weekData = [28, 45, 32, 67, 89, 54, 76];
const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const BarChartMini = () => {
  const max = Math.max(...weekData);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {weekData.map((val, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn(
              'w-full rounded-t-sm transition-all',
              i === weekData.length - 1 ? 'bg-primary' : 'bg-primary/30'
            )}
            style={{ height: `${(val / max) * 52}px` }}
          />
          <span className="text-[9px] text-muted-foreground">{weekDays[i]}</span>
        </div>
      ))}
    </div>
  );
};

const mockDrafts = [
  { id: 'd1', thumbnail: mockVideos[2].thumbnailUrl, title: 'Mon nouveau clip dance...', duration: '0:32', savedAt: '2h' },
  { id: 'd2', thumbnail: mockVideos[4].thumbnailUrl, title: 'Recette rapide en cuisine', duration: '1:04', savedAt: '1j' },
];

const mockScheduled = [
  { id: 's1', thumbnail: mockVideos[0].thumbnailUrl, title: 'Coucher de soleil incroyable', scheduledFor: 'Demain 18:00' },
  { id: 's2', thumbnail: mockVideos[1].thumbnailUrl, title: 'Nouveau tutorial de danse', scheduledFor: 'Ven. 20:00' },
];

export const EnetStudio = () => {
  const [activeTab, setActiveTab] = useState<StudioTab>('stats');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">Afrixa Studio</span>
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Créateur</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        {studioTabs.map((tab) => {
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

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'stats' && (
          <div className="px-4 py-4 space-y-4">
            {/* Period selector */}
            <div className="flex rounded-lg bg-muted/20 p-0.5">
              {['7j', '28j', '3m', '12m'].map((p, i) => (
                <button
                  key={p}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-xs font-medium transition-all',
                    i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Views chart */}
            <div className="bg-card/30 rounded-2xl border border-border/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Vues cette semaine</p>
                  <p className="text-2xl font-bold text-foreground">391K</p>
                </div>
                <span className="text-xs font-semibold text-green-500 bg-green-500/10 px-2 py-1 rounded-full">+24.5%</span>
              </div>
              <BarChartMini />
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: 'Abonnés', value: '1.2K', change: '+48', color: 'text-primary' },
                { icon: Eye, label: 'Vues totales', value: '391K', change: '+12K', color: 'text-blue-500' },
                { icon: Heart, label: 'J\'aime', value: '24.5K', change: '+2.1K', color: 'text-destructive' },
                { icon: MessageCircle, label: 'Commentaires', value: '3.8K', change: '+340', color: 'text-yellow-500' },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="bg-card/30 rounded-xl border border-border/20 p-3">
                    <Icon className={cn('w-4 h-4 mb-2', m.color)} />
                    <p className="text-lg font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-xs text-green-500 mt-0.5 font-medium">{m.change} ce mois</p>
                  </div>
                );
              })}
            </div>

            {/* Top video */}
            <div className="bg-card/30 rounded-2xl border border-border/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Meilleure vidéo</p>
              <div className="flex gap-3 items-center">
                <img loading="lazy" src={mockVideos[2].thumbnailUrl} alt="" className="w-12 h-16 object-cover rounded-lg" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{mockVideos[2].description}</p>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(mockVideos[2].views)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(mockVideos[2].likes)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="divide-y divide-border/20">
            {mockVideos.map((video) => (
              <div key={video.id} className="flex gap-3 px-4 py-3 items-center">
                <div className="relative shrink-0">
                  <img loading="lazy" src={video.thumbnailUrl} alt="" className="w-14 h-20 object-cover rounded-lg" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{video.description}</p>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(video.views)}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(video.likes)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNumber(video.comments)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Publié il y a 3j</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'drafts' && (
          <div className="px-4 py-4 space-y-3">
            {mockDrafts.map(draft => (
              <div key={draft.id} className="flex gap-3 items-center bg-card/30 rounded-xl border border-border/20 p-3">
                <img loading="lazy" src={draft.thumbnail} alt="" className="w-14 h-20 object-cover rounded-lg shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{draft.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{draft.duration} · Sauvegardé il y a {draft.savedAt}</span>
                  </div>
                </div>
                <Button variant="gradient" size="sm" className="shrink-0 text-xs">
                  Éditer
                </Button>
              </div>
            ))}
            {mockDrafts.length === 0 && (
              <div className="text-center py-8">
                <Pencil className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Aucun brouillon</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="px-4 py-4 space-y-3">
            {mockScheduled.map(item => (
              <div key={item.id} className="flex gap-3 items-center bg-card/30 rounded-xl border border-border/20 p-3">
                <img loading="lazy" src={item.thumbnail} alt="" className="w-14 h-20 object-cover rounded-lg shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">{item.scheduledFor}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 text-xs border-border/30">
                  Modifier
                </Button>
              </div>
            ))}
            <Button variant="gradient" className="w-full gap-2 mt-2">
              <Calendar className="w-4 h-4" /> Planifier une vidéo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
