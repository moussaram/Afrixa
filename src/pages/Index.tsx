import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { VideoCard } from '@/components/video/VideoCard';
import { FeedTutorialOverlay } from '@/components/onboarding/FeedTutorialOverlay';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// The checked-in generated schema currently omits the videos table even though
// its migrations exist. Keep this boundary explicit until types are regenerated.
const db = supabase as unknown as SupabaseClient<any>;
import { useAuth } from '@/contexts/useAuth';
import type { User, Video } from '@/types';

type FeedVideoRow = {
  id: string;
  user_id: string;
  hls_url: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  duration: number | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  saves_count: number | null;
  created_at: string;
  sound_id?: string | null;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
};

const PAGE_SIZE = 20;
const FALLBACK_AVATAR = '/placeholder.svg';

const toVideo = (row: FeedVideoRow, profile?: ProfileRow, isFollowing = false): Video => {
  const username = profile?.username || 'utilisateur';
  const description = row.description || row.title || '';
  const hashtags = Array.from(description.matchAll(/#([\p{L}\p{N}_]+)/gu), match => match[1]);
  const user: User = {
    id: row.user_id,
    username,
    displayName: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || username,
    avatar: profile?.avatar_url || FALLBACK_AVATAR,
    bio: profile?.bio || '',
    isFollowing,
    followers: 0,
    following: 0,
    likes: 0,
  };

  return {
    id: row.id,
    user,
    videoUrl: row.hls_url,
    thumbnailUrl: row.thumbnail_url || FALLBACK_AVATAR,
    description,
    hashtags,
    music: { title: 'Audio original', artist: username, coverUrl: profile?.avatar_url || FALLBACK_AVATAR },
    likes: row.likes_count || 0,
    comments: row.comments_count || 0,
    shares: row.shares_count || 0,
    saves: row.saves_count || 0,
    views: row.views_count || 0,
    createdAt: row.created_at,
  };
};

const Index = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (nextPage = 0, append = false) => {
    if (nextPage === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      let followedIds: string[] = [];
      if (user?.id) {
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        if (followsError) throw followsError;
        followedIds = (follows || []).map(item => item.following_id);
      }
      if (activeTab === 'following' && followedIds.length === 0) {
        setVideos([]);
        setHasMore(false);
        setPage(0);
        return;
      }

      let query = supabase
        .from('videos')
        .select('id,user_id,hls_url,thumbnail_url,title,description,duration,views_count,likes_count,comments_count,shares_count,saves_count,created_at,sound_id')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1);

      if (activeTab === 'following') query = query.in('user_id', followedIds);

      const { data, error: videosError } = await query;
      if (videosError) throw videosError;

      const rows = (data || []) as FeedVideoRow[];
      const authorIds = Array.from(new Set(rows.map(row => row.user_id)));
      const { data: profiles, error: profilesError } = authorIds.length
        ? await supabase.from('profiles')
            .select('user_id,username,prenom,nom,avatar_url,bio')
            .in('user_id', authorIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile as ProfileRow]));
      const followingSet = new Set(followedIds);
      const mapped = rows.map(row => toVideo(row, profileMap.get(row.user_id), followingSet.has(row.user_id)));
      setVideos(current => append ? [...current, ...mapped] : mapped);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(nextPage);
    } catch (loadError) {
      console.error('Afrixa feed load failed', loadError);
      setError("Le fil d’actualité n’a pas pu être chargé. Vérifiez la connexion et réessayez.");
      if (!append) setVideos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, user?.id]);

  useEffect(() => {
    setActiveIndex(0);
    setPage(0);
    containerRef.current?.scrollTo({ top: 0 });
    void loadFeed(0, false);
  }, [loadFeed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const itemHeight = container.clientHeight;
      if (itemHeight > 0) setActiveIndex(Math.round(container.scrollTop / itemHeight));
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const loadNextPage = () => {
    if (!loadingMore && hasMore) void loadFeed(page + 1, true);
  };

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="flex items-center justify-center gap-8 h-14 px-4">
          <button onClick={() => setActiveTab('following')} className={cn('text-base font-semibold transition-all duration-200', activeTab === 'following' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80')}>
            Abonnements
          </button>
          <div className="w-px h-4 bg-border" />
          <button onClick={() => setActiveTab('foryou')} className={cn('text-base font-semibold transition-all duration-200', activeTab === 'foryou' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80')}>
            Pour toi
          </button>
        </div>
        <div className="relative h-0.5 w-32 mx-auto -mt-0.5">
          <div className={cn('absolute h-full w-16 gradient-primary rounded-full transition-all duration-300', activeTab === 'foryou' ? 'right-0' : 'left-0')} />
        </div>
      </header>

      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-14 pb-16">
        {loading && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement du fil Afrixa…</div>
        )}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => void loadFeed(0, false)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
              <RefreshCw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        )}
        {!loading && !error && videos.length === 0 && (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-8 gap-2">
            <p className="text-foreground font-semibold">Aucune vidéo disponible</p>
            <p className="text-muted-foreground text-sm">{activeTab === 'following' ? 'Abonnez-vous à des créateurs pour retrouver leurs vidéos ici.' : 'Les vidéos publiées et validées apparaîtront ici.'}</p>
          </div>
        )}
        {videos.map((video, index) => (
          <div key={video.id} className="h-full w-full snap-start snap-always">
            <VideoCard video={video} isActive={index === activeIndex} />
          </div>
        ))}
        {!loading && !error && videos.length > 0 && hasMore && (
          <div className="flex justify-center py-4">
            <button onClick={loadNextPage} disabled={loadingMore} className="rounded-full border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50">
              {loadingMore ? 'Chargement…' : 'Charger plus de vidéos'}
            </button>
          </div>
        )}
      </div>
      {activeTab === 'foryou' && <FeedTutorialOverlay />}
    </div>
  );
};

export default Index;
