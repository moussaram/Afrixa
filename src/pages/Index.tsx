import { useState, useRef, useEffect, useMemo } from 'react';
import { VideoCard } from '@/components/video/VideoCard';
import { AdCard } from '@/components/video/AdCard';
import { FeedTutorialOverlay } from '@/components/onboarding/FeedTutorialOverlay';
import { StoriesRail } from '@/components/stories/StoriesRail';
import { mockVideos } from '@/data/mockData';
import { cn } from '@/lib/utils';

const Index = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const containerRef = useRef<HTMLDivElement>(null);

  const videos = useMemo(
    () =>
      activeTab === 'following'
        ? mockVideos.filter((v) => v.user.isFollowing)
        : mockVideos,
    [activeTab]
  );




  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const itemHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / itemHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
        setActiveIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, videos.length]);

  // Reset to first video on tab change
  useEffect(() => {
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const handleLike = (videoId: string) => {
    console.log('Liked video:', videoId);
  };

  const handleComment = (videoId: string) => {
    console.log('Comment on video:', videoId);
  };

  const handleShare = (videoId: string) => {
    console.log('Share video:', videoId);
  };

  const handleSave = (videoId: string) => {
    console.log('Save video:', videoId);
  };

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
        {videos.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 gap-2">
            <p className="text-foreground font-semibold">Aucune vidéo pour le moment</p>
            <p className="text-muted-foreground text-sm">Suis des créateurs pour voir leurs vidéos ici.</p>
          </div>
        )}
        {videos.map((video, index) => (
          <div
            key={video.id}
            className="h-full w-full snap-start snap-always"
          >
            <VideoCard
              video={video}
              isActive={index === activeIndex}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onSave={handleSave}
            />
            {/* Inject ad every 5 videos */}
            {(index + 1) % 5 === 0 && (
              <div className="h-full w-full snap-start snap-always">
                <AdCard />
              </div>
            )}
          </div>
        ))}
      </div>
      {activeTab === 'foryou' && <FeedTutorialOverlay />}
    </div>
  );
};

export default Index;
