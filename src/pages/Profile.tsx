import { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings, Share2, MoreHorizontal, Grid3X3, Heart, Bookmark, MessageCircle, Zap, Briefcase, Globe } from 'lucide-react';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { ProfileMenuDrawer } from '@/components/profile-menu/ProfileMenuDrawer';
import { useAuth } from '@/contexts/useAuth';
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { ProfileCompletionBanner } from '@/components/onboarding/ProfileCompletionBanner';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from '@/types';

const tabs = [
  { id: 'videos', icon: Grid3X3, label: 'Vidéos' },
  { id: 'likes', icon: Heart, label: "J'aime" },
  { id: 'saved', icon: Bookmark, label: 'Enregistré' },
];

type ProfileVendor = { is_vendor?: boolean };
type VideoRow = {
  id: string; user_id: string; hls_url: string | null; thumbnail_url: string | null;
  description: string | null; views_count: number | null; likes_count: number | null;
  comments_count: number | null; shares_count: number | null; saves_count: number | null; created_at: string;
};

const Profile = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const userId = user?.id;

  const displayName = profile
    ? [profile.prenom, profile.deuxieme_prenom, profile.nom].filter(Boolean).join(' ') || profile.username || 'Utilisateur'
    : 'Utilisateur';
  const username = profile?.username || 'utilisateur';

  const loadProfileData = useCallback(async () => {
    if (!userId) {
      setVideos([]); setLikedVideos([]); setSavedVideos([]);
      setFollowingCount(0); setFollowersCount(0); setLikesCount(0); setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [videoResult, followingResult, followersResult, unreadResult, likeResult, saveResult] = await Promise.all([
        supabase.from('videos')
          .select('id,user_id,hls_url,thumbnail_url,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
        supabase.from('video_likes').select('video_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
        supabase.from('video_saves').select('video_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      ]);
      if (videoResult.error) throw videoResult.error;
      if (followingResult.error) throw followingResult.error;
      if (followersResult.error) throw followersResult.error;
      if (unreadResult.error) throw unreadResult.error;
      if (likeResult.error) throw likeResult.error;
      if (saveResult.error) throw saveResult.error;

      const ownRows = (videoResult.data || []) as VideoRow[];
      const likedIds = (likeResult.data || []).map(row => row.video_id);
      const savedIds = (saveResult.data || []).map(row => row.video_id);
      const extraIds = Array.from(new Set([...likedIds, ...savedIds])).filter(id => !ownRows.some(row => row.id === id));
      const { data: extraRows, error: extraError } = extraIds.length
        ? await supabase.from('videos')
            .select('id,user_id,hls_url,thumbnail_url,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
            .in('id', extraIds)
        : { data: [], error: null };
      if (extraError) throw extraError;

      const allRows = [...ownRows, ...((extraRows || []) as VideoRow[])];
      const authorIds = Array.from(new Set(allRows.map(row => row.user_id)));
      const { data: authors, error: authorError } = authorIds.length
        ? await supabase.from('profiles').select('user_id,username,prenom,nom,avatar_url').in('user_id', authorIds)
        : { data: [], error: null };
      if (authorError) throw authorError;
      const authorMap = new Map((authors || []).map(author => [author.user_id, author]));
      const mapped = new Map<string, Video>();
      for (const row of allRows) {
        const author = authorMap.get(row.user_id);
        const name = [author?.prenom, author?.nom].filter(Boolean).join(' ') || author?.username || 'Utilisateur';
        mapped.set(row.id, {
          id: row.id,
          user: { id: row.user_id, username: author?.username || 'utilisateur', displayName: name, avatar: author?.avatar_url || '/placeholder.svg', followers: 0, following: 0, likes: 0 },
          videoUrl: row.hls_url || '',
          thumbnailUrl: row.thumbnail_url || '/placeholder.svg',
          description: row.description || '',
          hashtags: [],
          music: { title: '', artist: '', coverUrl: '' },
          likes: row.likes_count || 0,
          comments: row.comments_count || 0,
          shares: row.shares_count || 0,
          saves: row.saves_count || 0,
          views: row.views_count || 0,
          createdAt: row.created_at,
        });
      }
      setVideos(ownRows.map(row => mapped.get(row.id)!).filter(Boolean));
      setLikedVideos(likedIds.map(id => mapped.get(id)!).filter(Boolean));
      setSavedVideos(savedIds.map(id => mapped.get(id)!).filter(Boolean));
      setFollowingCount(followingResult.count || 0);
      setFollowersCount(followersResult.count || 0);
      setUnreadCount(unreadResult.count || 0);
      const ownVideoIds = ownRows.map(row => row.id);
      if (ownVideoIds.length) {
        const { count, error: likesCountError } = await supabase.from('video_likes')
          .select('video_id', { count: 'exact', head: true }).in('video_id', ownVideoIds);
        if (likesCountError) throw likesCountError;
        setLikesCount(count || 0);
      } else setLikesCount(0);
    } catch (error) {
      console.error('Profile data load failed', error);
      setLoadError('Impossible de charger toutes les données du profil.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadProfileData(); }, [loadProfileData]);

  const activeVideos = useMemo(() => activeTab === 'videos' ? videos : activeTab === 'likes' ? likedVideos : savedVideos,
    [activeTab, videos, likedVideos, savedVideos]);
  const creatorLevel = followersCount >= 500000 ? 'elite' : followersCount >= 50000 ? 'verified' : followersCount >= 5000 ? 'rising' : 'starter';

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}><MoreHorizontal className="w-6 h-6" /></Button>
          <h1 className="text-lg font-bold text-foreground">@{username}</h1>
          <div className="flex items-center gap-1">
            <Link to="/messages" className="relative"><Button variant="ghost" size="icon"><MessageCircle className="w-6 h-6" /></Button>
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <Link to="/settings"><Button variant="ghost" size="icon"><Settings className="w-6 h-6" /></Button></Link>
          </div>
        </div>
      </header>

      <ProfileCompletionBanner />
      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          <button onClick={() => navigate('/settings')} className="relative mb-4" aria-label="Modifier la photo de profil">
            <img src={profile?.avatar_url || '/placeholder.svg'} alt={username} className="w-24 h-24 rounded-full object-cover border-4 border-primary" />
            <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xl border-4 border-background">+</span>
          </button>
          <h2 className="text-xl font-bold text-foreground mb-1">@{username}</h2>
          <p className="text-foreground font-medium">{displayName}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <CreatorBadge level={creatorLevel} />
            {(profile as (typeof profile & ProfileVendor) | null)?.is_vendor && <span className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">Vendeur</span>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile?.nationalite && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">{profile.nationalite_flag && <span>{profile.nationalite_flag}</span>}<Globe className="w-3.5 h-3.5 text-muted-foreground" /><span>{profile.nationalite}</span></span>}
            {profile?.profession && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground"><Briefcase className="w-3.5 h-3.5 text-muted-foreground" /><span>{profile.profession}</span></span>}
          </div>
          <div className="flex items-center gap-8 mt-4">
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(followingCount)}</p><p className="text-sm text-muted-foreground">Abonnements</p></div>
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(followersCount)}</p><p className="text-sm text-muted-foreground">Abonnés</p></div>
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(likesCount)}</p><p className="text-sm text-muted-foreground">J'aime</p></div>
          </div>
          <div className="flex items-center gap-3 mt-6 w-full max-w-sm">
            <Button variant="gradient" className="flex-1" onClick={() => navigate('/settings')}>Modifier le profil</Button>
            <Button variant="glass" size="icon" onClick={() => setShareOpen(true)}><Share2 className="w-5 h-5" /></Button>
          </div>
          <button onClick={() => navigate('/boost')} className="mt-4 w-full max-w-sm flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 transition-all hover:border-primary/70">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0"><Zap className="w-5 h-5 text-primary-foreground" /></div>
            <div className="text-left flex-1"><p className="text-sm font-bold text-foreground">Booster mes vidéos</p><p className="text-xs text-muted-foreground">Découvrir les options de promotion</p></div>
            <span className="text-xs font-bold text-primary px-2 py-1 rounded-full bg-primary/10">Pub</span>
          </button>
          {profile?.bio && <p className="text-foreground text-center mt-4 max-w-sm">{profile.bio}</p>}
        </div>
      </section>

      <div className="flex border-b border-border/30">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex-1 flex items-center justify-center gap-2 py-3 transition-all duration-200', activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground')}><Icon className="w-5 h-5" /><span className="text-sm font-medium hidden sm:inline">{tab.label}</span></button>; })}
      </div>
      <div className="px-1 py-2">
        {loading && <p className="py-10 text-center text-xs text-muted-foreground">Chargement du profil…</p>}
        {!loading && loadError && <div className="py-10 text-center"><p className="text-sm text-destructive">{loadError}</p><button onClick={() => void loadProfileData()} className="mt-2 text-sm text-primary">Réessayer</button></div>}
        {!loading && !loadError && activeVideos.length > 0 && <div className="grid grid-cols-3 gap-0.5">{activeVideos.map(video => <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />)}</div>}
        {!loading && !loadError && activeVideos.length === 0 && <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">{activeTab === 'videos' ? <Grid3X3 className="w-10 h-10 text-muted-foreground" /> : activeTab === 'likes' ? <Heart className="w-10 h-10 text-muted-foreground" /> : <Bookmark className="w-10 h-10 text-muted-foreground" />}</div>
          <p className="text-muted-foreground text-center">{activeTab === 'videos' ? 'Aucune vidéo publiée pour le moment' : activeTab === 'likes' ? 'Aucune vidéo aimée pour le moment' : 'Aucune vidéo enregistrée pour le moment'}</p>
        </div>}
      </div>

      <ProfileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <ProfileShareSheet open={shareOpen} onClose={() => setShareOpen(false)} username={username} displayName={displayName} avatarUrl={profile?.avatar_url || undefined} />
    </div>
  );
};

export default Profile;
