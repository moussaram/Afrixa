/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Grid3X3,
  Heart,
  MessageCircle,
  UserX,
  Flag,
  Link as LinkIcon,
} from 'lucide-react';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { reportContent } from '@/lib/security';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useFollow } from '@/hooks/useSocialInteractions';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useProfileVideos } from '@/hooks/useProfileVideos';
import { useProfileVideoCollections } from '@/hooks/useProfileVideoCollections';
import { getOrCreateConversation } from '@/lib/conversations';
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { SuperNotificationButton } from '@/components/creators/SuperNotificationButton';
import { CollabRequestButton } from '@/components/creators/CollabRequestButton';
import { FanClubCard } from '@/components/creators/FanClubCard';

const client = supabase as any;

const tabs = [
  { id: 'videos', icon: Grid3X3 },
  { id: 'likes', icon: Heart },
];

const creatorLevel = (followers: number) => {
  if (followers >= 500000) return 'elite';
  if (followers >= 50000) return 'verified';
  if (followers >= 5000) return 'rising';
  return 'starter';
};

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user: viewer } = useAuth();
  const { profile, stats, loading, error, notFound, reload } = usePublicProfile(userId);
  const { videos, loading: videosLoading, error: videosError } = useProfileVideos(userId);
  const { likedVideos, loading: likesLoading } = useProfileVideoCollections(
    viewer?.id && viewer.id === userId ? userId : undefined,
  );

  const isOwnProfile = Boolean(viewer?.id && viewer.id === userId);
  const { isFollowing, isLoading: followLoading, toggle: toggleFollow } = useFollow(
    stats.isFollowing,
    userId ?? '',
    viewer?.id ?? '',
  );

  const [activeTab, setActiveTab] = useState('videos');
  const [shareOpen, setShareOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    if (!viewer?.id || !userId || viewer.id === userId) {
      setIsBlocked(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await client
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', viewer.id)
        .eq('blocked_id', userId)
        .maybeSingle();
      if (active) setIsBlocked(Boolean(data));
    })();
    return () => {
      active = false;
    };
  }, [userId, viewer?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (notFound || error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-foreground">Profil introuvable</p>
        <p className="text-sm text-muted-foreground">
          {error ?? 'Ce compte n’existe pas ou n’est plus disponible.'}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Retour
        </Button>
      </div>
    );
  }

  const username = profile.username || 'utilisateur';
  const displayName =
    [profile.prenom, profile.nom].filter(Boolean).join(' ') || username;
  const followersCount = stats.followersCount;
  const isLocked = Boolean(profile.is_private) && !isOwnProfile && !isFollowing;
  // Un compte bloqué ne doit plus exposer ses vidéos dans cette vue.
  const visibleVideos = isBlocked ? [] : videos;

  const handleFollow = async () => {
    if (!viewer?.id) {
      toast.error('Connecte-toi pour suivre ce créateur.');
      return;
    }
    const next = !isFollowing;
    await toggleFollow();
    toast.success(next ? `Abonné à @${username}` : `Désabonné de @${username}`);
    void reload();
  };

  const handleMessage = async () => {
    if (!viewer?.id) {
      toast.error('Connecte-toi pour envoyer un message.');
      return;
    }
    setActionPending(true);
    try {
      const conversationId = await getOrCreateConversation(viewer.id, profile.user_id);
      if (!conversationId) throw new Error('Conversation indisponible');
      navigate(`/chat/${conversationId}`);
    } catch (messageError) {
      console.error('Unable to open conversation', messageError);
      toast.error('Impossible d’ouvrir la conversation.');
    } finally {
      setActionPending(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`https://afrixa.app/user/${profile.user_id}`);
    toast.success('Lien du profil copié');
  };

  const handleBlock = async () => {
    if (!viewer?.id) {
      toast.error('Connecte-toi pour gérer ce compte.');
      return;
    }
    setActionPending(true);
    try {
      if (isBlocked) {
        const { error: unblockError } = await client
          .from('user_blocks')
          .delete()
          .eq('blocker_id', viewer.id)
          .eq('blocked_id', profile.user_id);
        if (unblockError) throw unblockError;
        setIsBlocked(false);
        toast.success(`@${username} débloqué`);
      } else {
        const { error: blockError } = await client
          .from('user_blocks')
          .insert({ blocker_id: viewer.id, blocked_id: profile.user_id });
        if (blockError) throw blockError;
        setIsBlocked(true);
        toast.success(`@${username} bloqué`);
      }
      void reload();
    } catch (blockActionError) {
      console.error('Unable to update block state', blockActionError);
      toast.error('Impossible de modifier le blocage.');
    } finally {
      setActionPending(false);
    }
  };

  const handleReport = async () => {
    if (!viewer?.id) {
      toast.error('Connecte-toi pour signaler un compte.');
      return;
    }
    if (!window.confirm(`Signaler @${username} à la modération ?`)) return;
    setActionPending(true);
    try {
      const result = await reportContent({
        reporterId: viewer.id,
        contentType: 'user',
        contentId: profile.user_id,
        reason: 'Signalement utilisateur',
      });
      toast.success(result?.auto_hidden
        ? 'Signalement enregistré, le contenu est masqué en attente de moderation.'
        : 'Signalement enregistré, merci.');
    } catch (reportActionError) {
      console.error('Unable to report profile', reportActionError);
      toast.error('Impossible d’enregistrer le signalement.');
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">@{username}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}>
              <Share2 className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={actionPending}>
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Copier le lien
                </DropdownMenuItem>
                {!isOwnProfile && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBlock} disabled={actionPending}>
                      <UserX className="w-4 h-4 mr-2" />
                      {isBlocked ? 'Débloquer' : 'Bloquer'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleReport}
                      disabled={actionPending}
                      className="text-destructive focus:text-destructive"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Signaler
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <img
              src={profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'}
              alt={username}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary"
            />
            {followersCount >= 50000 && (
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full gradient-primary flex items-center justify-center border-2 border-background">
                <span className="text-xs text-primary-foreground font-bold">✓</span>
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">@{username}</h2>
          <p className="text-foreground font-medium">{displayName}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <CreatorBadge level={creatorLevel(followersCount)} />
            {followersCount >= 500000 && (
              <span className="inline-flex items-center rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/15 px-3 py-1 text-xs font-bold text-[#F59E0B]">
                Spotlight Afrixa
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3" />

          <div className="flex items-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(stats.followingCount)}</p>
              <p className="text-sm text-muted-foreground">Abonnements</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(followersCount)}</p>
              <p className="text-sm text-muted-foreground">Abonnés</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(stats.likesCount)}</p>
              <p className="text-sm text-muted-foreground">J'aime</p>
            </div>
          </div>

          {profile.bio && (
            <p className="text-foreground text-center mt-4 max-w-sm">{profile.bio}</p>
          )}

          {isBlocked && (
            <p className="mt-3 text-xs text-destructive">
              Tu as bloqué ce compte : ses vidéos ne te sont plus recommandées.
            </p>
          )}

          <div className="flex items-center gap-3 mt-5 w-full max-w-sm">
            {isOwnProfile ? (
              <Button variant="gradient" className="flex-1" onClick={() => navigate('/settings/my-info')}>
                Modifier le profil
              </Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? 'outline' : 'gradient'}
                  className="flex-1"
                  onClick={handleFollow}
                  disabled={followLoading || actionPending}
                >
                  {isFollowing ? 'Abonné ✓' : 'Suivre'}
                </Button>
                <Button
                  variant="glass"
                  className="flex-1"
                  onClick={handleMessage}
                  disabled={actionPending}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
                <SuperNotificationButton creatorId={profile.user_id} />
              </>
            )}
          </div>

          {!isOwnProfile && (
            <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-3">
              <CollabRequestButton receiverId={profile.user_id} />
              <Button variant="glass" onClick={() => navigate('/creators/fan-club')}>
                Fan Club
              </Button>
            </div>
          )}
        </div>
      </section>

      {followersCount >= 500000 && (
        <section className="px-4 pb-4">
          <FanClubCard name={`VIP ${username}`} priceMonthly={1000} />
        </section>
      )}

      <div className="flex border-b border-border/30">
        {tabs.map((tab) => {
          if (tab.id === 'likes' && !isOwnProfile) return null;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 transition-all duration-200',
                activeTab === tab.id
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">
                {tab.id === 'videos' ? `${stats.videosCount} vidéos` : 'J’aime'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-1 py-2">
        {activeTab === 'videos' && (
          <>
            {isLocked && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
                  <Grid3X3 className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium">Ce compte est privé</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Abonne-toi pour voir ses vidéos.
                </p>
              </div>
            )}
            {!isLocked && videosLoading && (
              <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
            )}
            {!isLocked && !videosLoading && videosError && (
              <p className="py-10 text-center text-sm text-destructive">Impossible de charger les vidéos.</p>
            )}
            {!isLocked && !videosLoading && !videosError && visibleVideos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
                  <Grid3X3 className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-center">Aucune vidéo publiée pour le moment</p>
              </div>
            )}
            {!isLocked && visibleVideos.length > 0 && (
              <div className="grid grid-cols-3 gap-0.5">
                {visibleVideos.map((video) => (
                  <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'likes' && (
          likesLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : likedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
                <Heart className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-center">Aucune vidéo aimée pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {likedVideos.map((video) => (
                <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />
              ))}
            </div>
          )
        )}
      </div>

      <ProfileShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        username={username}
        displayName={displayName}
        avatarUrl={profile.avatar_url || undefined}
      />
    </div>
  );
};

export default UserProfile;
