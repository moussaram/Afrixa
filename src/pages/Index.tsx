import { useState, useRef, useEffect } from 'react';
import { VideoCard } from '@/components/video/VideoCard';
import { AdCard } from '@/components/video/AdCard';
import { FeedTutorialOverlay } from '@/components/onboarding/FeedTutorialOverlay';
import { StoriesRail } from '@/components/stories/StoriesRail';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFeed, type FeedMode } from '@/hooks/useFeed';

const Index = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<FeedMode>('foryou');
  const containerRef = useRef<HTMLDivElement>(null);

  const { videos, loading, loadingMore, error, hasMore, loadMore, reload } = useFeed(activeTab);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const itemHeight = container.clientHeight;
      if (itemHeight <= 0) return;
      const newIndex = Math.round(scrollTop / itemHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
        setActiveIndex(newIndex);
      }
      // Chargement anticipé : on prépare la suite avant la dernière vidéo.
      if (hasMore && !loadingMore && newIndex >= videos.length - 3) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, hasMore, loadMore, loadingMore, videos.length]);

  // Reset to first video on tab change
  useEffect(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="flex items-center justify-center gap-8 h-14 px-4">
          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              'text-base font-semibold transition-all duration-200',
              activeTab === 'following'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            Abonnements
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => setActiveTab('foryou')}
            className={cn(
              'text-base font-semibold transition-all duration-200',
              activeTab === 'foryou'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            )}
          >
            Pour toi
          </button>
        </div>
        {/* Active indicator */}
        <div className="relative h-0.5 w-32 mx-auto -mt-0.5">
          <div
            className={cn(
              "absolute h-full w-16 gradient-primary rounded-full transition-all duration-300",
              activeTab === 'foryou' ? 'right-0' : 'left-0'
            )}
          />
        </div>
      </header>
      {activeTab === 'foryou' && <StoriesRail />}

      {/* Video Feed */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-14 pb-16"
      >
        {loading && (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement du fil…</p>
          </div>
        )}

        {!loading && error && (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 gap-3">
            <p className="text-foreground font-semibold">Impossible de charger le fil</p>
            <p className="text-muted-foreground text-sm">Vérifie ta connexion puis réessaie.</p>
            <Button variant="outline" size="sm" onClick={reload}>
              Réessayer
            </Button>
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 gap-2">
            <p className="text-foreground font-semibold">
              {activeTab === 'following' ? 'Aucune vidéo pour le moment' : 'Rien à te recommander pour l’instant'}
            </p>
            <p className="text-muted-foreground text-sm">
              {activeTab === 'following'
                ? 'Suis des créateurs pour voir leurs vidéos ici.'
                : 'Les nouvelles vidéos apparaîtront ici dès leur publication.'}
            </p>
          </div>
        )}

        {!loading && !error && videos.map((video, index) => (
          <div
            key={video.id}
            className="h-full w-full snap-start snap-always"
          >
            <VideoCard
              video={video}
              isActive={index === activeIndex}
            />
            {/* Inject ad every 5 videos */}
            {(index + 1) % 5 === 0 && (
              <div className="h-full w-full snap-start snap-always">
                <AdCard />
              </div>
            )}
          </div>
        ))}

        {!loading && !error && videos.length > 0 && (
          <div className="h-16 w-full flex items-center justify-center">
            {loadingMore ? (
              <div className="w-5 h-5 rounded-full border-2 border-muted border-t-primary animate-spin" />
            ) : hasMore ? (
              <span className="text-xs text-muted-foreground">Fais défiler pour voir la suite</span>
            ) : (
              <span className="text-xs text-muted-foreground">Tu es à jour ✨</span>
            )}
          </div>
        )}
      </div>
      {activeTab === 'foryou' && <FeedTutorialOverlay />}
    </div>
  );
};

export default Index;
