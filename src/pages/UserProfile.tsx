import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, MoreHorizontal, Grid3X3, Heart, MessageCircle, Link as LinkIcon, Globe, Briefcase, ShoppingBag } from 'lucide-react';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useFollow } from '@/hooks/useSocialInteractions';
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { SuperNotificationButton } from '@/components/creators/SuperNotificationButton';
import { CollabRequestButton } from '@/components/creators/CollabRequestButton';
import { FanClubCard } from '@/components/creators/FanClubCard';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from '@/types';

const tabs = [
  { id: 'videos', icon: Grid3X3 },
  { id: 'likes', icon: Heart },
];

type PublicProfile = {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
  bio: string | null;
  profession: string | null;
  nationalite: string | null;
  nationalite_flag: string | null;
};
type VideoRow = {
  id: string; user_id: string; hls_url: string; thumbnail_url: string | null;
  description: string | null; views_count: number; likes_count: number;
  comments_count: number; shares_count: number; saves_count: number; created_at: string;
};

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [initialFollowing, setInitialFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [shareOpen, setShareOpen] = useState(false);
  const [hasShop, setHasShop] = useState(false);
  const isOwnProfile = Boolean(currentUser?.id && currentUser.id === userId);

  const { isFollowing, isLoading: followLoading, toggle: toggleFollow } = useFollow(
    initialFollowing,
    userId || '',
    currentUser?.id || '',
  );

  const loadProfile = useCallback(async () => {
    if (!userId) { setError('Profil introuvable.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [profileResult, videoResult, followersResult, followingResult] = await Promise.all([
        supabase.from('profiles')
          .select('user_id,username,prenom,nom,avatar_url,bio,profession,nationalite,nationalite_flag')
          .eq('user_id', userId).maybeSingle(),
        supabase.from('videos')
          .select('id,user_id,hls_url,thumbnail_url,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
          .eq('user_id', userId).eq('is_published', true).eq('moderation_status', 'approved')
          .order('created_at', { ascending: false }).limit(100),
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (!profileResult.data) { setProfile(null); setVideos([]); return; }
      if (videoResult.error) throw videoResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;

      const profileRow = profileResult.data as PublicProfile;
      const videoRows = (videoResult.data || []) as VideoRow[];
      const mapped: Video[] = videoRows.map(row => ({
        id: row.id,
        user: {
          id: userId,
          username: profileRow.username || 'utilisateur',
          displayName: [profileRow.prenom, profileRow.nom].filter(Boolean).join(' ') || profileRow.username || 'Utilisateur',
          avatar: profileRow.avatar_url || '/placeholder.svg',
          followers: followersResult.count || 0,
          following: followingResult.count || 0,
          likes: 0,
        },
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
      }));
      setProfile(profileRow);
      setVideos(mapped);
      setFollowersCount(followersResult.count || 0);
      setFollowingCount(followingResult.count || 0);

      const { count: publishedProducts, error: shopError } = await supabase.from('products')
        .select('id', { count: 'exact', head: true }).eq('seller_id', userId)
        .eq('is_active', true).eq('publication_status', 'published')
        .eq('moderation_status', 'approved').is('deleted_at', null);
      if (shopError) throw shopError;
      setHasShop((publishedProducts || 0) > 0);

      if (videoRows.length) {
        const { count, error: likesError } = await supabase.from('video_likes')
          .select('video_id', { count: 'exact', head: true }).in('video_id', videoRows.map(row => row.id));
        if (likesError) throw likesError;
        setLikesCount(count || 0);
      } else setLikesCount(0);

      if (currentUser?.id && currentUser.id !== userId) {
        const { data: followRow, error: followError } = await supabase.from('follows')
          .select('follower_id').eq('follower_id', currentUser.id).eq('following_id', userId).maybeSingle();
        if (followError) throw followError;
        setInitialFollowing(Boolean(followRow));
      } else setInitialFollowing(false);
    } catch (loadError) {
      console.error('Public profile load failed', loadError);
      setError('Impossible de charger ce profil.');
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser?.id]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const username = profile?.username || 'utilisateur';
  const displayName = [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || username;
  const creatorLevel = followersCount >= 500000 ? 'elite' : followersCount >= 50000 ? 'verified' : followersCount >= 5000 ? 'rising' : 'starter';

  const handleFollow = async () => {
    await toggleFollow();
    toast.success(isFollowing ? `Vous ne suivez plus @${username}.` : `Vous suivez maintenant @${username}.`);
  };
  const handleMessage = () => {
    if (!currentUser) { toast.error('Connectez-vous pour envoyer un message.'); return; }
    navigate(`/messages?userId=${encodeURIComponent(userId || '')}`);
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://afrixa.app/@${username}`);
      toast.success('Lien du profil copié.');
    } catch {
      toast.error('Impossible de copier le lien sur cet appareil.');
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Chargement du profil…</div>;
  if (error || !profile) return <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center"><p className="text-sm text-muted-foreground">{error || 'Profil introuvable.'}</p><Button className="mt-4" onClick={() => navigate(-1)}>Retour</Button></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></Button>
          <h1 className="text-lg font-bold text-foreground">@{username}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}><Share2 className="w-5 h-5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink}><LinkIcon className="w-4 h-4 mr-2" />Copier le lien</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          <img src={profile.avatar_url || '/placeholder.svg'} alt={username} className="w-24 h-24 rounded-full object-cover border-4 border-primary mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-1">@{username}</h2>
          <p className="text-foreground font-medium">{displayName}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><CreatorBadge level={creatorLevel} /></div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile.nationalite && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">{profile.nationalite_flag && <span>{profile.nationalite_flag}</span>}<Globe className="w-3.5 h-3.5 text-muted-foreground" />{profile.nationalite}</span>}
            {profile.profession && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground"><Briefcase className="w-3.5 h-3.5 text-muted-foreground" />{profile.profession}</span>}
          </div>
          <div className="flex items-center gap-8 mt-4">
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(followingCount)}</p><p className="text-sm text-muted-foreground">Abonnements</p></div>
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(followersCount)}</p><p className="text-sm text-muted-foreground">Abonnés</p></div>
            <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(likesCount)}</p><p className="text-sm text-muted-foreground">J'aime</p></div>
          </div>
          {profile.bio && <p className="text-foreground text-center mt-4 max-w-sm">{profile.bio}</p>}
          {!isOwnProfile && <div className="flex items-center gap-3 mt-5 w-full max-w-sm">
            <Button variant={isFollowing ? 'outline' : 'gradient'} className="flex-1" onClick={() => void handleFollow()} disabled={followLoading}>{isFollowing ? 'Abonné ✓' : 'Suivre'}</Button>
            <Button variant="glass" className="flex-1" onClick={handleMessage}><MessageCircle className="w-4 h-4 mr-2" />Message</Button>
            <SuperNotificationButton creatorId={userId || ''} />
          </div>}
          {!isOwnProfile && <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-3"><CollabRequestButton receiverId={userId || ''} /><Button variant="glass" onClick={() => navigate('/creators/fan-club')}>Fan Club</Button></div>}
          {hasShop && <Button variant="glass" className="mt-3 w-full max-w-sm" onClick={() => navigate('/profile/' + encodeURIComponent(username) + '/shop')}><ShoppingBag className="mr-2 h-4 w-4" />Voir la boutique</Button>}
        </div>
      </section>

      {followersCount >= 500000 && <section className="px-4 pb-4"><FanClubCard name={`VIP ${username}`} priceMonthly={1000} /></section>}
      <div className="flex border-b border-border/30">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex-1 flex items-center justify-center py-3 transition-all duration-200', activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground')}><Icon className="w-5 h-5" /></button>; })}
      </div>
      <div className="px-1 py-2">
        {activeTab === 'videos' && (videos.length ? <div className="grid grid-cols-3 gap-0.5">{videos.map(video => <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />)}</div> : <div className="py-16 text-center"><Grid3X3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Aucune vidéo publiée pour le moment.</p></div>)}
        {activeTab === 'likes' && <div className="py-16 text-center"><Heart className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-sm text-muted-foreground">Les vidéos aimées par ce compte restent privées.</p></div>}
      </div>
      <ProfileShareSheet open={shareOpen} onClose={() => setShareOpen(false)} username={username} displayName={displayName} avatarUrl={profile.avatar_url || undefined} />
    </div>
  );
};

export default UserProfile;
