import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, MoreHorizontal, Grid3X3, Heart, MessageCircle, UserX, Flag, Link as LinkIcon, Globe, Briefcase } from 'lucide-react';
import { mockUsers, mockVideos, currentUser } from '@/data/mockData';
import { VideoThumbnail } from '@/components/video/VideoThumbnail';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useFollow } from '@/hooks/useSocialInteractions';
import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { SuperNotificationButton } from '@/components/creators/SuperNotificationButton';
import { CollabRequestButton } from '@/components/creators/CollabRequestButton';
import { FanClubCard } from '@/components/creators/FanClubCard';

const tabs = [
  { id: 'videos', icon: Grid3X3 },
  { id: 'likes', icon: Heart },
];

const UserProfile = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  const user = mockUsers.find(u => u.id === userId) || mockUsers[0];
  const { isFollowing, isLoading: followLoading, toggle: toggleFollow } = useFollow(
    user.isFollowing ?? false,
    user.id,
    currentUser.id
  );
  const followersCount = user.followers + (isFollowing === (user.isFollowing ?? false) ? 0 : isFollowing ? 1 : -1);
  const [activeTab, setActiveTab] = useState('videos');
  const [shareOpen, setShareOpen] = useState(false);

  const userVideos = mockVideos.filter(v => v.user.id === user.id);

  const handleFollow = () => {
    toggleFollow();
    toast({
      title: isFollowing ? `Désabonné de @${user.username}` : `Abonné à @${user.username}`,
    });
  };

  const handleMessage = () => {
    navigate('/messages');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://afrixa.app/@${user.username}`);
    toast({ title: 'Lien du profil copié !' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">@{user.username}</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}>
              <Share2 className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Copier le lien
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <UserX className="w-4 h-4 mr-2" />
                  Bloquer
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Flag className="w-4 h-4 mr-2" />
                  Signaler
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Profile info */}
      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-4">
            <img
              src={user.avatar}
              alt={user.username}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary"
            />
            {user.isVerified && (
              <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full gradient-primary flex items-center justify-center border-2 border-background">
                <span className="text-xs text-primary-foreground font-bold">✓</span>
              </div>
            )}
          </div>

          {/* Username */}
          <h2 className="text-xl font-bold text-foreground mb-1">@{user.username}</h2>
          <p className="text-foreground font-medium">{user.displayName}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <CreatorBadge level={user.followers >= 500000 ? 'elite' : user.followers >= 50000 ? 'verified' : 'rising'} />
            {user.followers >= 500000 && (
              <span className="inline-flex items-center rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/15 px-3 py-1 text-xs font-bold text-[#F59E0B]">
                Spotlight Afrixa
              </span>
            )}
          </div>

          {/* Public info badges - simulated for mock users */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              Afrique
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
              Créateur
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(user.following)}</p>
              <p className="text-sm text-muted-foreground">Abonnements</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(followersCount)}</p>
              <p className="text-sm text-muted-foreground">Abonnés</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{formatNumber(user.likes)}</p>
              <p className="text-sm text-muted-foreground">J'aime</p>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-foreground text-center mt-4 max-w-sm">{user.bio}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5 w-full max-w-sm">
            <Button
              variant={isFollowing ? 'outline' : 'gradient'}
              className="flex-1"
              onClick={handleFollow}
              disabled={followLoading}
            >
              {isFollowing ? 'Abonné ✓' : 'Suivre'}
            </Button>
            <Button variant="glass" className="flex-1" onClick={handleMessage}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Message
            </Button>
            <SuperNotificationButton creatorId={user.id} />
          </div>

          <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-3">
            <CollabRequestButton receiverId={user.id} />
            <Button variant="glass" onClick={() => navigate('/creators/fan-club')}>
              Fan Club
            </Button>
          </div>
        </div>
      </section>

      {user.followers >= 500000 && (
        <section className="px-4 pb-4">
          <FanClubCard name={`VIP ${user.username}`} priceMonthly={1000} />
        </section>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center py-3 transition-all duration-200",
                activeTab === tab.id
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-1 py-2">
        {activeTab === 'videos' && (
          <>
            {userVideos.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5">
                {userVideos.map((video) => (
                  <VideoThumbnail key={video.id} video={video} className="aspect-[9/16]" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
                  <Grid3X3 className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-center">Aucune vidéo pour le moment</p>
              </div>
            )}
            {userVideos.length === 0 && (
              <div className="grid grid-cols-3 gap-0.5 mt-2">
                {mockVideos.slice(0, 6).map((video) => (
                  <VideoThumbnail key={`demo-${video.id}`} video={video} className="aspect-[9/16]" />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'likes' && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
              <Heart className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              Les vidéos aimées sont privées
            </p>
          </div>
        )}
      </div>

      {/* Share Sheet */}
      <ProfileShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        username={user.username}
        displayName={user.displayName}
        avatarUrl={user.avatar}
      />
    </div>
  );
};

export default UserProfile;
