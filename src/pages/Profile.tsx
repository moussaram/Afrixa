import { useState } from 'react';
import { Settings, Share2, MoreHorizontal, Grid3X3, Heart, Bookmark, Link as LinkIcon, MessageCircle, Zap, MapPin, Briefcase, Globe, Copy, Check, X, Send } from 'lucide-react';
import { mockConversations } from '@/data/mockChatData';
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
import { useProfileVideoCollections } from '@/hooks/useProfileVideoCollections';
import { useProfileVideos } from '@/hooks/useProfileVideos';
import { useProfileStats } from '@/hooks/useProfileStats';
import { toast } from 'sonner';
import { ProfileBannerEditor } from '@/components/profile/ProfileBanner';

const tabs = [
  { id: 'videos', icon: Grid3X3, label: 'Vidéos' },
  { id: 'likes', icon: Heart, label: 'J\'aime' },
  { id: 'saved', icon: Bookmark, label: 'Enregistré' },
];

type VendorProfile = { is_vendor?: boolean };

const Profile = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const {
    likedVideos,
    savedVideos,
    loading: collectionsLoading,
    error: collectionsError,
  } = useProfileVideoCollections(user?.id);
  const { videos: ownVideos, loading: ownVideosLoading, error: ownVideosError } = useProfileVideos(user?.id);
  const { stats } = useProfileStats(user?.id);
  const unreadCount = mockConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const displayName = profile
    ? [profile.prenom, profile.deuxieme_prenom, profile.nom].filter(Boolean).join(' ')
    : 'Utilisateur';
  const username = profile?.username || 'utilisateur';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}>
            <MoreHorizontal className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">@{username}</h1>
          <div className="flex items-center gap-1">
            <Link to="/messages" className="relative">
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-6 h-6" />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 flex items-center justify-center text-xs font-bold bg-destructive text-destructive-foreground rounded-full px-1 animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="w-6 h-6" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <ProfileCompletionBanner />
      <ProfileBannerEditor userId={user?.id || ''} imageUrl={profile?.banner_url || null} imagePath={profile?.banner_path || null} position={profile?.banner_position} onSaved={refreshProfile} />
      <section className="px-4 pb-6">
        <div className="mx-auto max-w-5xl">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative shrink-0">
              <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'} alt={username} className="h-24 w-24 rounded-full border-[5px] border-background object-cover shadow-xl ring-2 ring-primary/70" />
              <button onClick={() => navigate('/settings/my-info')} aria-label="Modifier la photo de profil" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background gradient-primary text-xl text-primary-foreground">+</button>
            </div>
            <div className="min-w-0 pb-1"><p className="truncate text-sm font-semibold text-foreground">@{username}</p><p className="truncate text-xs text-muted-foreground">{displayName}</p></div>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <CreatorBadge level="starter" />
              {(profile as VendorProfile | null)?.is_vendor && <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">Vendeur</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {profile?.nationalite && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm text-foreground">{profile.nationalite_flag && <span>{profile.nationalite_flag}</span>}<Globe className="h-3.5 w-3.5 text-muted-foreground" /><span>{profile.nationalite}</span></span>}
              {profile?.profession && <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-3 py-1 text-sm text-foreground"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" /><span>{profile.profession}</span></span>}
            </div>
            <div className="mt-4 flex items-center gap-8">
              <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(stats.followingCount)}</p><p className="text-sm text-muted-foreground">Abonnements</p></div>
              <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(stats.followersCount)}</p><p className="text-sm text-muted-foreground">Abonnés</p></div>
              <div className="text-center"><p className="text-xl font-bold text-foreground">{formatNumber(stats.likesCount)}</p><p className="text-sm text-muted-foreground">J'aime</p></div>
            </div>
            <div className="mt-6 flex w-full max-w-sm items-center gap-3">
              <Button variant="gradient" className="flex-1" onClick={() => navigate('/settings/my-info')}>Modifier le profil</Button>
              <Button variant="glass" size="icon" onClick={() => setShareOpen(true)}><Share2 className="h-5 w-5" /></Button>
            </div>
            <button onClick={() => navigate('/boost')} className="mt-4 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 transition-all hover:scale-[1.02] hover:border-primary/70">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary"><Zap className="h-5 w-5 text-primary-foreground" /></div>
              <div className="flex-1 text-left"><p className="text-sm font-bold text-foreground">Booster mes vidéos</p><p className="text-xs text-muted-foreground">À partir de 2,99€ · Touche jusqu'à 500K personnes</p></div>
              <div className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">Pub</div>
            </button>
            {profile?.bio && <p className="mt-4 max-w-sm text-center text-foreground">{profile.bio}</p>}
            <button onClick={async () => { await navigator.clipboard.writeText(`https://afrixa.app/user/${user?.id ?? ''}`); toast.success('Lien du profil copié'); }} className="mt-3 flex items-center gap-2 text-primary hover:underline"><LinkIcon className="h-4 w-4" /><span className="text-sm font-medium">afrixa.app/@{username}</span></button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-border/30">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 transition-all duration-200",
                activeTab === tab.id 
                  ? "text-foreground border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-1 py-2">
        {collectionsError && (activeTab === 'likes' || activeTab === 'saved') && (
          <p className="px-4 py-6 text-center text-sm text-destructive">
            Impossible de charger cette collection.
          </p>
        )}
        {activeTab === 'videos' && (
          ownVideosLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : ownVideosError ? (
            <p className="py-10 text-center text-sm text-destructive">Impossible de charger tes vidéos.</p>
          ) : ownVideos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucune vidéo publiée pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {ownVideos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  video={video}
                  className="aspect-[9/16]"
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'likes' && (
          collectionsLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {likedVideos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  video={video}
                  className="aspect-[9/16]"
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'saved' && (
          collectionsLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {savedVideos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  video={video}
                  className="aspect-[9/16]"
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Profile Menu Drawer */}
      <ProfileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Share Sheet */}
      <ProfileShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        username={username}
        displayName={displayName}
        avatarUrl={profile?.avatar_url || undefined}
      />

      {/* Empty state */}
      {!collectionsLoading && !collectionsError &&
        ((activeTab === 'likes' && likedVideos.length === 0) ||
          (activeTab === 'saved' && savedVideos.length === 0)) && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center mb-4">
            {activeTab === 'likes' ? (
              <Heart className="w-10 h-10 text-muted-foreground" />
            ) : (
              <Bookmark className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <p className="text-muted-foreground text-center">
            {activeTab === 'likes' 
              ? "Aucune vidéo aimée pour le moment" 
              : "Aucune vidéo enregistrée pour le moment"}
          </p>
        </div>
      )}
    </div>
  );
};

export default Profile;
