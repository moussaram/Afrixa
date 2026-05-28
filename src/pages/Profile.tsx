import { useState } from 'react';
import { Settings, Share2, MoreHorizontal, Grid3X3, Heart, Bookmark, Link as LinkIcon, MessageCircle, Zap, MapPin, Briefcase, Globe, Copy, Check, X, Send } from 'lucide-react';
import { mockVideos } from '@/data/mockData';
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
  const { profile } = useAuth();
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

      {/* Profile info */}
      <section className="px-4 py-6">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-4">
            <img
              src={profile?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face'}
              alt={username}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary"
            />
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xl border-4 border-background">
              +
            </button>
          </div>

          {/* Username */}
          <h2 className="text-xl font-bold text-foreground mb-1">
            @{username}
          </h2>
          <p className="text-foreground font-medium">{displayName}</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <CreatorBadge level="starter" />
            {(profile as VendorProfile | null)?.is_vendor && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-xs font-bold text-orange-300">
                Vendeur
              </span>
            )}
          </div>

          {/* Public info badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile?.nationalite && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">
                {profile.nationalite_flag && <span>{profile.nationalite_flag}</span>}
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{profile.nationalite}</span>
              </span>
            )}
            {profile?.profession && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-sm text-foreground">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{profile.profession}</span>
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8 mt-4">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Abonnements</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Abonnés</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">J'aime</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6 w-full max-w-sm">
            <Button variant="gradient" className="flex-1">
              Modifier le profil
            </Button>
            <Button variant="glass" size="icon" onClick={() => setShareOpen(true)}>
              <Share2 className="w-5 h-5" />
            </Button>
          </div>

          {/* Boost Banner */}
          <button
            onClick={() => navigate('/boost')}
            className="mt-4 w-full max-w-sm flex items-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 to-secondary/10 px-4 py-3 transition-all hover:border-primary/70 hover:scale-[1.02]"
          >
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-foreground">Booster mes vidéos</p>
              <p className="text-xs text-muted-foreground">À partir de 2,99€ · Touche jusqu'à 500K personnes</p>
            </div>
            <div className="text-xs font-bold text-primary px-2 py-1 rounded-full bg-primary/10">
              Pub
            </div>
          </button>

          {/* Bio */}
          {profile?.bio && (
            <p className="text-foreground text-center mt-4 max-w-sm">
              {profile.bio}
            </p>
          )}

          {/* Link */}
          <button className="flex items-center gap-2 mt-3 text-primary hover:underline">
            <LinkIcon className="w-4 h-4" />
            <span className="text-sm font-medium">afrixa.app/@{username}</span>
          </button>
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
        {activeTab === 'videos' && (
          <div className="grid grid-cols-3 gap-0.5">
            {mockVideos.map((video) => (
              <VideoThumbnail
                key={video.id}
                video={video}
                className="aspect-[9/16]"
              />
            ))}
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="grid grid-cols-3 gap-0.5">
            {mockVideos.filter(v => v.isLiked).map((video) => (
              <VideoThumbnail
                key={video.id}
                video={video}
                className="aspect-[9/16]"
              />
            ))}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="grid grid-cols-3 gap-0.5">
            {mockVideos.filter(v => v.isSaved).map((video) => (
              <VideoThumbnail
                key={video.id}
                video={video}
                className="aspect-[9/16]"
              />
            ))}
          </div>
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
      {((activeTab === 'likes' && !mockVideos.some(v => v.isLiked)) ||
        (activeTab === 'saved' && !mockVideos.some(v => v.isSaved))) && (
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
