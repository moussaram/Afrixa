import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, X } from 'lucide-react';
import { categories } from '@/data/mockData';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { MarketplaceContent } from '@/components/marketplace/MarketplaceContent';
import { GroupBuyList } from '@/components/groupbuy/GroupBuyList';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { User, Video } from '@/types';

const boutiqueCategory = { id: 'boutique', name: 'Boutique', icon: '🛍️' };
const groupBuyCategory = { id: 'groupbuy', name: 'Group Buy', icon: '⚡' };
const challengesCategory = { id: 'challenges', name: 'Challenges', icon: '🏆' };
const allCategories = [boutiqueCategory, groupBuyCategory, challengesCategory, ...categories];

type ProfileRow = {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
};
type VideoRow = {
  id: string;
  user_id: string;
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  saves_count: number | null;
  created_at: string;
};

const toVideo = (row: VideoRow, profile?: ProfileRow): Video => {
  const username = profile?.username || 'utilisateur';
  const description = row.description || row.title || '';
  const hashtags = Array.from(description.matchAll(/#([\p{L}\p{N}_]+)/gu), match => match[1]);
  const user: User = {
    id: row.user_id,
    username,
    displayName: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || username,
    avatar: profile?.avatar_url || '/placeholder.svg',
    bio: profile?.bio || '',
    followers: 0,
    following: 0,
    likes: 0,
  };
  return {
    id: row.id,
    user,
    videoUrl: '',
    thumbnailUrl: row.thumbnail_url || '/placeholder.svg',
    description,
    hashtags,
    music: { title: 'Audio original', artist: username, coverUrl: profile?.avatar_url || '/placeholder.svg' },
    likes: row.likes_count || 0,
    comments: row.comments_count || 0,
    shares: row.shares_count || 0,
    saves: row.saves_count || 0,
    views: row.views_count || 0,
    createdAt: row.created_at,
  };
};

const Discover = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('boutique');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [trending, setTrending] = useState<Array<{ tag: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadDiscovery = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const query = searchQuery.trim();
        const profilesQuery = supabase.from('public_profiles')
          .select('user_id,username,prenom,nom,avatar_url,bio')
          .order('created_at', { ascending: false })
          .limit(query ? 20 : 12);
        const videosQuery = supabase.from('videos')
          .select('id,user_id,thumbnail_url,title,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
          .eq('is_published', true)
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(60);

        const [profileResult, videoResult] = await Promise.all([
          query
            ? profilesQuery.or(`username.ilike.%${query}%,prenom.ilike.%${query}%,nom.ilike.%${query}%`)
            : profilesQuery,
          query
            ? videosQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            : videosQuery,
        ]);
        if (profileResult.error) throw profileResult.error;
        if (videoResult.error) throw videoResult.error;

        const videoRows = (videoResult.data || []) as VideoRow[];
        const authorIds = Array.from(new Set(videoRows.map(row => row.user_id)));
        const authorsResult = authorIds.length
          ? await supabase.from('profiles')
              .select('user_id,username,prenom,nom,avatar_url,bio')
              .in('user_id', authorIds)
          : { data: [], error: null };
        if (authorsResult.error) throw authorsResult.error;
        const authorMap = new Map((authorsResult.data || []).map(profile => [profile.user_id, profile as ProfileRow]));

        if (!active) return;
        const nextProfiles = (profileResult.data || []) as ProfileRow[];
        setProfiles(nextProfiles);
        setVideos(videoRows.map(row => toVideo(row, authorMap.get(row.user_id))));

        if (!query) {
          const counts = new Map<string, number>();
          for (const row of videoRows) {
            for (const match of (row.description || row.title || '').matchAll(/#([\p{L}\p{N}_]+)/gu)) {
              const tag = match[1].toLowerCase();
              counts.set(tag, (counts.get(tag) || 0) + 1);
            }
          }
          setTrending(Array.from(counts, ([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count).slice(0, 12));
        }
      } catch (error) {
        console.error('Afrixa discovery load failed', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDiscovery();
    return () => { active = false; };
  }, [searchQuery]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const displayedVideos = useMemo(() => normalizedQuery
    ? videos.filter(video =>
        video.description.toLowerCase().includes(normalizedQuery) ||
        video.user.username.toLowerCase().includes(normalizedQuery) ||
        video.hashtags.some(tag => tag.toLowerCase().includes(normalizedQuery)))
    : videos, [normalizedQuery, videos]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher des vidéos, utilisateurs, sons..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="input-search pl-12 pr-10"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full" aria-label="Effacer la recherche">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto hide-scrollbar">
          {allCategories.map((category) => (
            <button key={category.id} onClick={() => setActiveCategory(category.id)} className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200',
              activeCategory === category.id ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}>
              <span>{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
        </div>
      </header>

      {activeCategory === 'boutique' && <MarketplaceContent />}
      {activeCategory === 'groupbuy' && <GroupBuyList />}
      {activeCategory === 'challenges' && (
        <div className="px-4 py-12 text-center">
          <h2 className="font-semibold text-foreground">Défis Afrixa</h2>
          <p className="mt-2 text-sm text-muted-foreground">Aucun défi actif n’est publié pour le moment.</p>
        </div>
      )}

      {activeCategory !== 'boutique' && activeCategory !== 'groupbuy' && activeCategory !== 'challenges' && (
        <>
          {(isSearchFocused || searchQuery) && (
            <section className="px-4 py-4 border-b border-border/30">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {searchQuery ? `Comptes correspondant à « ${searchQuery} »` : 'Comptes récents'}
              </h3>
              {loading && <p className="text-sm text-muted-foreground">Recherche en cours…</p>}
              {!loading && profiles.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte trouvé.</p>}
              <div className="space-y-3">
                {profiles.slice(0, 8).map(profile => {
                  const username = profile.username || 'utilisateur';
                  return (
                    <div key={profile.user_id} className="flex items-center gap-3">
                      <img loading="lazy" src={profile.avatar_url || '/placeholder.svg'} alt={username} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{[profile.prenom, profile.nom].filter(Boolean).join(' ') || username}</p>
                        <p className="text-xs text-muted-foreground">@{username}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="px-4 py-4 border-b border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Tendances</h2>
            </div>
            {trending.length ? (
              <div className="flex flex-wrap gap-2">
                {trending.map(item => (
                  <button key={item.tag} onClick={() => setSearchQuery(item.tag)} className="px-4 py-2 glass rounded-full hover:bg-muted/80 transition-colors duration-200">
                    <span className="text-sm font-medium text-gradient">#{item.tag}</span>
                    <span className="text-xs text-muted-foreground ml-2">{item.count} vidéos</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Les tendances apparaîtront à mesure que les vidéos seront publiées.</p>}
          </section>

          <section className="px-4 py-4 border-b border-border/30">
            <h2 className="text-lg font-semibold text-foreground mb-3">Comptes récents</h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {profiles.map(profile => (
                <div key={profile.user_id} className="flex flex-col items-center gap-2 min-w-[80px]">
                  <img loading="lazy" src={profile.avatar_url || '/placeholder.svg'} alt={profile.username || 'Utilisateur'} className="w-16 h-16 rounded-full object-cover border-2 border-primary" />
                  <span className="text-xs font-medium text-foreground truncate max-w-[80px]">{profile.username || 'utilisateur'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="px-2 py-4">
            <h2 className="text-lg font-semibold text-foreground mb-3 px-2">{searchQuery ? 'Vidéos correspondantes' : 'Vidéos récentes'}</h2>
            {loadError && <p className="px-2 py-6 text-sm text-destructive">Impossible de charger la découverte. Réessayez plus tard.</p>}
            {!loading && displayedVideos.length === 0 && !loadError && (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">Aucune vidéo publiée ne correspond à cette recherche.</p>
            )}
            <div className="grid grid-cols-3 gap-1">
              {displayedVideos.map(video => <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Discover;
