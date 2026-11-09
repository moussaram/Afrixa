import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, MoreHorizontal, Grid3X3, Heart, MessageCircle, UserX, Flag, Link as LinkIcon, Globe, Briefcase } from 'lucide-react';
import { Video } from '@/types';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useFollow } from '@/hooks/useSocialInteractions';
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { SuperNotificationButton } from '@/components/creators/SuperNotificationButton';
import { CollabRequestButton } from '@/components/creators/CollabRequestButton';
import { FanClubCard } from '@/components/creators/FanClubCard';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';

type PublicProfile = {
  user_id: string; username: string | null; prenom: string | null; nom: string | null;
  avatar_url: string | null; bio: string | null; is_private?: boolean;
  nationalite?: string | null; profession?: string | null;
};

type VideoRow = {
  id: string; user_id: string; hls_url: string; thumbnail_url: string | null;
  title: string | null; description: string | null; views_count: number;
  likes_count: number; comments_count: number; shares_count: number;
  saves_count: number; created_at: string;
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const tabs = [{ id: 'videos', icon: Grid3X3 }, { id: 'likes', icon: Heart }];

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId = '' } = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [likedVideos, setLikedVideos] = useState<Video[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [likes, setLikes] = useState(0);
  const [activeTab, setActiveTab] = useState('videos');
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isFollowing, isLoading: followLoading, toggle: toggleFollow } = useFollow(false, userId, authUser?.id || '');

  const displayName = useMemo(
    () => [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || profile?.username || 'Utilisateur',
    [profile]
  );

  useEffect(() => {
    if (!isUuid(userId)) {
      setError('Profil introuvable');
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const client = supabase as any;
      try {
        const { data: person, error: profileError } = await client
          .from('public_profiles')
          .select('user_id,username,prenom,nom,avatar_url,bio,is_private')
          .eq('user_id', userId).maybeSingle();
        if (profileError) throw profileError;
        if (!person) throw new Error('Ce profil est privé ou indisponible.');

        const [
          videoResult, followerResult, followingResult, likedResult,
        ] = await Promise.all([
          client.from('videos').select('id,user_id,hls_url,thumbnail_url,title,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
            .eq('user_id', userId).eq('is_published', true).order('created_at', { ascending: false }).limit(60),
          client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
          client.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
          authUser?.id === userId
            ? client.from('video_likes').select('video_id').eq('user_id', userId).limit(60)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (videoResult.error) throw videoResult.error;
        if (followerResult.error) throw followerResult.error;
        if (followingResult.error) throw followingResult.error;
        if (likedResult.error) throw likedResult.error;
        const rows: VideoRow[] = videoResult.data ?? [];
        const toVideo = (row: VideoRow): Video => ({
          id: row.id,
          user: {
            id: person.user_id,
            username: person.username || 'utilisateur',
            displayName: [person.prenom, person.nom].filter(Boolean).join(' ') || person.username || 'Utilisateur',
            avatar: person.avatar_url || '',
            bio: person.bio || '',
            followers: followerResult.count || 0,
            following: followingResult.count || 0,
            likes: rows.reduce((sum, item) => sum + (item.likes_count || 0), 0),
            isFollowing,
          },
          videoUrl: row.hls_url,
          thumbnailUrl: row.thumbnail_url || '',
          description: row.description || row.title || '',
          hashtags: [],
          music: { title: 'Audio original', artist: person.username || 'Afrixa', coverUrl: '' },
          likes: row.likes_count || 0,
          comments: row.comments_count || 0,
          shares: row.shares_count || 0,
          saves: row.saves_count || 0,
          views: row.views_count || 0,
          createdAt: row.created_at,
        });
        const mapped = rows.map(toVideo);
        let likedMapped: Video[] = [];
        const likedIds = (likedResult.data ?? []).map((item: { video_id: string }) => item.video_id);
        if (likedIds.length) {
          const { data: likedRows, error: likedError } = await client.from('videos')
            .select('id,user_id,hls_url,thumbnail_url,title,description,views_count,likes_count,comments_count,shares_count,saves_count,created_at')
            .in('id', likedIds).eq('is_published', true);
          if (likedError) throw likedError;
          likedMapped = (likedRows ?? []).map((row: VideoRow) => toVideo(row));
        }
        if (!active) return;
        setProfile(person);
        setVideos(mapped);
        setLikedVideos(likedMapped);
        setFollowers(followerResult.count || 0);
        setFollowing(followingResult.count || 0);
        setLikes(rows.reduce((sum, row) => sum + (row.likes_count || 0), 0));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Impossible de charger ce profil.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId, authUser?.id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/user/${userId}`);
      toast({ title: 'Lien du profil copié !' });
    } catch {
      toast({ title: 'Copie impossible', description: 'Vérifie les permissions du navigateur.' });
    }
  };

  const handleFollow = async () => {
    if (!authUser) {
      toast({ title: 'Connexion nécessaire', description: 'Connecte-toi pour suivre ce profil.' });
      return;
    }
    await toggleFollow();
    toast({ title: isFollowing ? 'Abonnement supprimé' : 'Abonnement ajouté' });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement du profil…</div>;
  if (error || !profile) return (
    <div className="min-h-screen bg-background p-6">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-5 w-5" />Retour</Button>
      <p className="mt-10 text-center text-muted-foreground">{error || 'Profil introuvable'}</p>
    </div>
  );

  const isOwnProfile = authUser?.id === userId;
  const displayedVideos = activeTab === 'videos' ? videos : likedVideos;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-6 h-6" /></Button>
          <h1 className="text-lg font-bold text-foreground">@{profile.username || 'utilisateur'}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}><Share2 className="w-5 h-5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink}><LinkIcon className="w-4 h-4 mr-2" />Copier le lien</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast({ title: 'Blocage', description: 'La gestion des blocages sera reliée dans une prochaine étape.' })}><UserX className="w-4 h-4 mr-2" />Bloquer</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Signalement', description: 'Le formulaire de signalement sera relié dans une prochaine étape.' })}><Flag className="w-4 h-4 mr-2" />Signaler</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          <img src={profile.avatar_url || '/placeholder.svg'} alt={profile.username || 'Profil'} className="mb-4 h-24 w-24 rounded-full border-4 border-primary object-cover" />
          <h2 className="mb-1 text-xl font-bold">@{profile.username || 'utilisateur'}</h2>
          <p className="font-medium">{displayName}</p>
          <div className="mt-3"><CreatorBadge level={followers >= 500000 ? 'elite' : followers >= 50000 ? 'verified' : 'rising'} /></div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {profile.nationalite && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm"><Globe className="h-3.5 w-3.5" />{profile.nationalite}</span>}
            {profile.profession && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm"><Briefcase className="h-3.5 w-3.5" />{profile.profession}</span>}
          </div>
          <div className="mt-4 flex items-center gap-8">
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(following)}</p><p className="text-sm text-muted-foreground">Abonnements</p></div>
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(followers)}</p><p className="text-sm text-muted-foreground">Abonnés</p></div>
            <div className="text-center"><p className="text-xl font-bold">{formatNumber(likes)}</p><p className="text-sm text-muted-foreground">J'aime</p></div>
          </div>
          {profile.bio && <p className="mt-4 max-w-sm text-center">{profile.bio}</p>}
          {!isOwnProfile && <div className="mt-5 flex w-full max-w-sm items-center gap-3">
            <Button variant={isFollowing ? 'outline' : 'gradient'} className="flex-1" onClick={() => void handleFollow()} disabled={followLoading}>{isFollowing ? 'Abonné ✓' : 'Suivre'}</Button>
            <Button variant="glass" className="flex-1" onClick={() => navigate('/messages')}><MessageCircle className="mr-2 h-4 w-4" />Message</Button>
            <SuperNotificationButton creatorId={userId} />
          </div>}
          {!isOwnProfile && <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-3"><CollabRequestButton receiverId={userId} /><Button variant="glass" onClick={() => navigate('/creators/fan-club')}>Fan Club</Button></div>}
        </div>
      </section>

      {followers >= 500000 && <section className="px-4 pb-4"><FanClubCard name={`VIP ${profile.username || 'Créateur'}`} priceMonthly={1000} /></section>}
      <div className="flex border-b border-border/30">
        {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex-1 flex items-center justify-center py-3', activeTab === tab.id ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground')}><Icon className="h-5 w-5" /></button>; })}
      </div>
      <div className="px-1 py-2">
        {displayedVideos.length ? <div className="grid grid-cols-3 gap-0.5">{displayedVideos.map(video => <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />)}</div> : <div className="py-16 text-center text-muted-foreground">{activeTab === 'videos' ? 'Aucune vidéo publiée pour le moment.' : isOwnProfile ? 'Aucune vidéo aimée.' : 'Les vidéos aimées ne sont pas publiques.'}</div>}
      </div>
      <ProfileShareSheet open={shareOpen} onClose={() => setShareOpen(false)} username={profile.username || 'utilisateur'} displayName={displayName} avatarUrl={profile.avatar_url || undefined} />
    </div>
  );
};

export default UserProfile;
