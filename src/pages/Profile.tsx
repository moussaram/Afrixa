import { useEffect, useState } from 'react';
import { Settings, Share2, MoreHorizontal, Grid3X3, Heart, Bookmark, Link as LinkIcon, MessageCircle, Zap, Briefcase, Globe } from 'lucide-react';
import { Video } from '@/types';
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
import { useConversations } from '@/hooks/useConversations';

const tabs = [
  { id: 'videos', icon: Grid3X3, label: 'Vidéos' },
  { id: 'likes', icon: Heart, label: "J'aime" },
  { id: 'saved', icon: Bookmark, label: 'Enregistré' },
];

type VideoRow = {
  id: string; user_id: string; hls_url: string; thumbnail_url: string | null;
  title: string | null; description: string | null; views_count: number;
  likes_count: number; comments_count: number; shares_count: number;
  saves_count: number; created_at: string;
};
type VendorProfile = { is_vendor?: boolean };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const Profile = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [likes, setLikes] = useState(0);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { conversations } = useConversations();
  const unreadCount = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  const displayName = profile
    ? [profile.prenom, profile.deuxieme_prenom, profile.nom].filter(Boolean).join(' ')
    : 'Utilisateur';
  const username = profile?.username || 'utilisateur';

  useEffect(() => {
    if (!user?.id || !isUuid(user.id)) {
      setLoadingVideos(false);
      setVideos([]);
      setLikedVideos([]);
      setSavedVideos([]);
      return;
    }
    let active = true;
    const load = async () => {
      setLoadingVideos(true);
      const client = supabase as any;
      try {
        const [videoResult, followerResult, followingResult, likedResult, savedResult] = await Promise.all([
          client.from('videos').select('id,user_id,hls_url,thumbnail_url,title,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
            .eq('user_id', user.id).eq('is_published', true).order('created_at', { ascending: false }).limit(100),
          client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', user.id),
          client.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user.id),
          client.from('video_likes').select('video_id').eq('user_id', user.id).limit(100),
          client.from('video_saves').select('video_id').eq('user_id', user.id).limit(100),
        ]);
        for (const result of [videoResult, followerResult, followingResult, likedResult, savedResult]) {
          if (result.error) throw result.error;
        }
        const ownRows: VideoRow[] = videoResult.data ?? [];
        const allIds = [...new Set([
          ...(likedResult.data ?? []).map((row: { video_id: string }) => row.video_id),
          ...(savedResult.data ?? []).map((row: { video_id: string }) => row.video_id),
        ])];
        let relatedRows: VideoRow[] = [];
        if (allIds.length) {
          const { data, error } = await client.from('videos')
            .select('id,user_id,hls_url,thumbnail_url,title,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
            .in('id', allIds).eq('is_published', true);
          if (error) throw error;
          relatedRows = data ?? [];
        }
        const toVideo = (row: VideoRow): Video => ({
          id: row.id,
          user: {
            id: user.id,
            username,
            displayName: displayName || username,
            avatar: profile?.avatar_url || '',
            bio: profile?.bio || '',
            followers: followerResult.count || 0,
            following: followingResult.count || 0,
            likes: ownRows.reduce((sum, item) => sum + (item.likes_count || 0), 0),
          },
          videoUrl: row.hls_url,
          thumbnailUrl: row.thumbnail_url || '',
          description: row.description || row.title || '',
          hashtags: [],
          music: { title: 'Audio original', artist: username, coverUrl: '' },
          likes: row.likes_count || 0,
          comments: row.comments_count || 0,
          shares: row.shares_count || 0,
          saves: row.saves_count || 0,
          views: row.views_count || 0,
          createdAt: row.created_at,
        });
        const relatedById = new Map(relatedRows.map(row => [row.id, row]));
        if (!active) return;
        setVideos(ownRows.map(toVideo));
        setLikedVideos((likedResult.data ?? []).map((row: { video_id: string }) => relatedById.get(row.video_id)).filter(Boolean).map((row: VideoRow) => toVideo(row)));
        setSavedVideos((savedResult.data ?? []).map((row: { video_id: string }) => relatedById.get(row.video_id)).filter(Boolean).map((row: VideoRow) => toVideo(row)));
        setFollowers(followerResult.count || 0);
        setFollowing(followingResult.count || 0);
        setLikes(ownRows.reduce((sum, row) => sum + (row.likes_count || 0), 0));
      } catch (error) {
        console.error('Unable to load account social profile data', error);
      } finally {
        if (active) setLoadingVideos(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.id, profile?.avatar_url, profile?.bio, profile?.username, profile?.prenom, profile?.nom, profile?.deuxieme_prenom]);

  const displayedVideos = activeTab === 'videos' ? videos : activeTab === 'likes' ? likedVideos : savedVideos;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}><MoreHorizontal className="w-6 h-6" /></Button>
          <h1 className="text-lg font-bold text-foreground">@{username}</h1>
          <div className="flex items-center gap-1">
            <Link to="/messages" className="relative"><Button variant="ghost" size="icon"><MessageCircle className="w-6 h-6" /></Button>
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 flex items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <Link to="/settings"><Button variant="ghost" size="icon"><Settings className="w-6 h-6" /></Button></Link>
          </div>
        </div>
      </header>

      <ProfileCompletionBanner />
      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <img src={profile?.avatar_url || '/placeholder.svg'} alt={username} className="h-24 w-24 rounded-full border-4 border-primary object-cover" />
            <button onClick={() => navigate('/settings')} aria-label="Modifier la photo de profil" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background gradient-primary text-xl text-primary-foreground">+</button>
          </div>
          <h2 className="mb-1 text-xl font-bold">@{username}</h2>
          <p className="font-medium">{displayName}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <CreatorBadge level={followers >= 500000 ? 'elite' : followers >= 50000 ? 'verified' : 'starter'} />
            {(profile as VendorProfile | null)?.is_vendor && <span className="rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">Vendeur</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {profile?.nationalite && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm">{profile.nationalite_flag && <span>{profile.nationalite_flag}</span>}<Globe className="h-3.5 w-3.5 text-muted-foreground" />{profile.nationalite}</span>}
            {profile?.profession && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />{profile.profession}</span>}
          </div>
          <div className="mt-4 flex items-center gap-8">
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(following)}</p><p className="text-sm text-muted-foreground">Abonnements</p></div>
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(followers)}</p><p className="text-sm text-muted-foreground">Abonnés</p></div>
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(likes)}</p><p className="text-sm text-muted-foreground">J'aime</p></div>
          </div>
          {profile?.bio && <p className="mt-4 max-w-sm text-center">{profile.bio}</p>}
          <div className="mt-6 flex w-full max-w-sm items-center gap-3">
            <Button variant="gradient" className="flex-1" onClick={() => navigate('/settings')}>Modifier le profil</Button>
            <Button variant="glass" size="icon" onClick={() => setShareOpen(true)}><Share2 className="h-5 w-5" /></Button>
          </div>
          <button onClick={() => navigate('/boost')} className="mt-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 text-left transition-all hover:border-primary/70 hover:scale-[1.02]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary"><Zap className="h-5 w-5 text-primary-foreground" /></div>
            <div className="flex-1"><p className="text-sm font-bold">Booster mes vidéos</p><p className="text-xs text-muted-foreground">Développe ton audience sur Afrixa</p></div>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">Pub</span>
          </button>
          <button onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/user/${user?.id || ''}`); }} className="mt-3 flex items-center gap-2 text-primary hover:underline"><LinkIcon className="h-4 w-4" /><span className="text-sm font-medium">Partager mon profil Afrixa</span></button>
        </div>
      </section>

      <div className="flex border-b border-border/30">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex-1 flex items-center justify-center gap-2 py-3', activeTab === tab.id ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground')}><Icon className="h-5 w-5" /><span className="hidden text-sm font-medium sm:inline">{tab.label}</span></button>; })}
      </div>
      <div className="px-1 py-2">
        {loadingVideos ? <p className="py-12 text-center text-muted-foreground">Chargement de tes vidéos…</p> : displayedVideos.length ? <div className="grid grid-cols-3 gap-0.5">{displayedVideos.map(video => <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />)}</div> : <div className="py-16 text-center text-muted-foreground">{activeTab === 'videos' ? 'Tu n’as pas encore publié de vidéo.' : activeTab === 'likes' ? 'Aucune vidéo aimée pour le moment.' : 'Aucune vidéo enregistrée pour le moment.'}</div>}
      </div>
      <ProfileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <ProfileShareSheet open={shareOpen} onClose={() => setShareOpen(false)} username={username} displayName={displayName} avatarUrl={profile?.avatar_url || undefined} />
    </div>
  );
};

export default Profile;
