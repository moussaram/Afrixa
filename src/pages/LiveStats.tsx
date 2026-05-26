import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Share2, RotateCcw, Users, Heart, MessageCircle, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}

const StatCard = ({ icon: Icon, label, value, color }: StatCardProps) => (
  <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 flex flex-col gap-2">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}

interface LiveStatsState {
  title?: string;
  duration?: number;
  viewerCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export default function LiveStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    title = 'Mon Live',
    duration = 0,
    viewerCount = 0,
    likeCount = 0,
    commentCount = 0,
  } = (location.state as LiveStatsState | null) ?? {};

  const peakViewers = Math.floor(viewerCount * 1.4);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `J'ai fait un live sur Afrixa : "${title}"`, url: 'https://afrixa.app' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 text-center border-b border-border/30">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
          <TrendingUp className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Live terminé !</h1>
        <p className="text-muted-foreground mt-1 text-sm">Voici les statistiques de votre live</p>
        <div className="mt-2 px-4 py-1.5 bg-muted/30 rounded-full inline-block">
          <p className="text-foreground font-semibold text-sm">« {title} »</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-5 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Clock} label="Durée du live" value={formatDuration(duration)} color="bg-primary" />
          <StatCard icon={Users} label="Spectateurs totaux" value={viewerCount.toLocaleString()} color="bg-secondary" />
          <StatCard icon={TrendingUp} label="Pic de spectateurs" value={peakViewers.toLocaleString()} color="bg-accent" />
          <StatCard icon={Heart} label="Likes reçus" value={likeCount.toLocaleString()} color="bg-destructive" />
          <StatCard icon={MessageCircle} label="Commentaires" value={commentCount.toLocaleString()} color="bg-green-600" />
          <StatCard icon={Users} label="Nouveaux abonnés" value={Math.floor(viewerCount * 0.12)} color="bg-yellow-600" />
        </div>

        {/* Engagement bar */}
        <div className="mt-5 bg-muted/30 border border-border/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Taux d'engagement</p>
            <span className="text-sm font-bold text-primary">
              {viewerCount > 0 ? Math.min(100, Math.round(((likeCount + commentCount) / viewerCount) * 100)) : 0}%
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary rounded-full transition-all duration-1000"
              style={{
                width: `${viewerCount > 0 ? Math.min(100, Math.round(((likeCount + commentCount) / viewerCount) * 100)) : 0}%`
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Basé sur les likes et commentaires par rapport aux spectateurs
          </p>
        </div>

        {/* Pro tip */}
        <div className="mt-3 bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-sm font-semibold text-primary mb-1">💡 Astuce</p>
          <p className="text-xs text-muted-foreground">
            Les statistiques détaillées de vos lives sont disponibles dans{' '}
            <strong className="text-foreground">Afrixa Studio</strong> sur votre profil.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 space-y-3 border-t border-border/30">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            Partager
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/live/setup')}>
            <RotateCcw className="w-4 h-4" />
            Relancer
          </Button>
        </div>
        <Button
          className="w-full gap-2 gradient-primary hover:scale-[1.01] transition-transform"
          onClick={() => navigate('/')}
        >
          <Home className="w-4 h-4" />
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}
