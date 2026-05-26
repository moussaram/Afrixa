import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Music, Play, Volume2, VolumeX, ShoppingCart } from 'lucide-react';
import { Video } from '@/types';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { CommentsPanel } from './CommentsPanel';
import { SharePanel } from './SharePanel';
import { ProductBottomSheet } from '@/components/marketplace/ProductBottomSheet';
import { useSocialInteractions, useFollow } from '@/hooks/useSocialInteractions';
import { useNavigate } from 'react-router-dom';
import { currentUser } from '@/data/mockData';

// Mock: some videos have tagged products
const taggedProducts: Record<string, { name: string; price: number; currency: string; imageUrl: string; sellerName: string }> = {
  '1': { name: 'Robe Wax Ankara Premium', price: 15000, currency: 'FCFA', imageUrl: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop', sellerName: 'Afri Fashion' },
  '4': { name: 'Écouteurs Bluetooth Pro', price: 8500, currency: 'FCFA', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=500&fit=crop', sellerName: 'TechZone Africa' },
};

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  onLike?: (videoId: string) => void;
  onComment?: (videoId: string) => void;
  onShare?: (videoId: string) => void;
  onSave?: (videoId: string) => void;
}

export const VideoCard = ({
  video,
  isActive,
  onLike,
  onComment,
  onShare,
  onSave,
}: VideoCardProps) => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [showHeart, setShowHeart] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Ref to block rapid double-click race condition
  const lastTapRef = useRef<number>(0);

  const {
    isLiked,
    isSaved,
    likeCount,
    saveCount,
    isLikeLoading,
    isSaveLoading,
    toggleLike,
    toggleSave,
  } = useSocialInteractions(video);

  const { isFollowing, toggle: toggleFollow } = useFollow(
    video.user.isFollowing ?? false,
    video.user.id,
    currentUser.id
  );

  // Play/pause when becoming active
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      v.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      v.play();
      setIsPlaying(true);
    }
  };

  // Double-tap to like — fixed race condition with timestamp check
  const handleDoubleClick = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 600) {
      if (!isLiked) {
        toggleLike();
        onLike?.(video.id);
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 900);
    }
    lastTapRef.current = now;
  };

  const handleLike = () => {
    toggleLike();
    onLike?.(video.id);
  };

  const handleSave = () => {
    toggleSave();
    onSave?.(video.id);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v && v.duration) {
      setProgress((v.currentTime / v.duration) * 100);
    }
  };

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Video */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleClick}
        onTimeUpdate={handleTimeUpdate}
        poster={video.thumbnailUrl}
      />

      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center animate-fade-in">
            <Play className="w-10 h-10 text-foreground ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Double-tap heart animation */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            className="w-32 h-32 text-destructive animate-heart-float"
            fill="currentColor"
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
        <div
          className="h-full gradient-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* User info — bottom left */}
      <div className="absolute left-4 bottom-20 right-20 z-10">
        <div className="flex items-center gap-3 mb-3">
          <img loading="lazy"
            src={video.user.avatar}
            alt={video.user.username}
            className="w-12 h-12 rounded-full border-2 border-primary object-cover cursor-pointer"
            onClick={() => navigate(`/user/${video.user.id}`)}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{video.user.username}</span>
              {video.user.isVerified && (
                <div className="w-4 h-4 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-[10px]">✓</span>
                </div>
              )}
            </div>
            {/* Inline follow button */}
            {video.user.id !== currentUser.id && (
              <button
                onClick={toggleFollow}
                className={cn(
                  "mt-1 px-3 py-0.5 rounded-full text-xs font-bold transition-all duration-200",
                  isFollowing
                    ? "bg-muted text-muted-foreground border border-border"
                    : "gradient-primary text-primary-foreground"
                )}
              >
                {isFollowing ? 'Abonné ✓' : '+ Suivre'}
              </button>
            )}
          </div>
        </div>

        <p className="text-foreground text-sm mb-2 line-clamp-2">{video.description}</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {video.hashtags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-sm text-primary font-medium">
              #{tag}
            </span>
          ))}
        </div>

        {/* Music info */}
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-foreground" />
          <div className="overflow-hidden flex-1">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-foreground">
                {video.music.title} - {video.music.artist}
              </span>
              <span className="mx-8 text-sm text-foreground">
                {video.music.title} - {video.music.artist}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-10">
        {/* Music disc */}
        <div className="relative w-12 h-12 mb-2">
          <div
            className={cn(
              'w-full h-full rounded-full border-2 border-muted overflow-hidden',
              isPlaying && 'animate-spin-slow'
            )}
          >
            <img loading="lazy" src={video.music.coverUrl} alt="Music" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-background" />
          </div>
        </div>

        {/* Save / Bookmark */}
        <button
          onClick={handleSave}
          disabled={isSaveLoading}
          className="interaction-btn"
          aria-label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <div
            className={cn(
              'p-2 rounded-full transition-all duration-200',
              isSaved ? 'text-accent' : 'text-foreground',
              isSaveLoading && 'opacity-60'
            )}
          >
            <Bookmark className="w-7 h-7" fill={isSaved ? 'currentColor' : 'none'} />
          </div>
          <span className="text-xs text-foreground">{formatNumber(saveCount)}</span>
        </button>

        {/* Share */}
        <button
          onClick={() => {
            setShowShare(true);
            onShare?.(video.id);
          }}
          className="interaction-btn"
          aria-label="Partager"
        >
          <div className="p-2 rounded-full text-foreground">
            <Share2 className="w-7 h-7" />
          </div>
          <span className="text-xs text-foreground">{formatNumber(video.shares)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={() => {
            setShowComments(true);
            onComment?.(video.id);
          }}
          className="interaction-btn"
          aria-label="Commentaires"
        >
          <div className="p-2 rounded-full text-foreground">
            <MessageCircle className="w-7 h-7" />
          </div>
          <span className="text-xs text-foreground">{formatNumber(video.comments)}</span>
        </button>

        {/* Like */}
        <button
          onClick={handleLike}
          disabled={isLikeLoading}
          className="interaction-btn"
          aria-label={isLiked ? 'Retirer le like' : 'Liker'}
        >
          <div
            className={cn(
              'p-2 rounded-full transition-all duration-200',
              isLiked && 'animate-like-pop',
              isLikeLoading && 'opacity-60'
            )}
          >
            <Heart
              className={cn(
                'w-8 h-8 transition-colors duration-200',
                isLiked ? 'text-destructive' : 'text-foreground'
              )}
              fill={isLiked ? 'currentColor' : 'none'}
            />
          </div>
          <span className="text-xs text-foreground font-medium">{formatNumber(likeCount)}</span>
        </button>

        {/* Profile avatar */}
        <div className="relative">
          <img loading="lazy"
            src={video.user.avatar}
            alt={video.user.username}
            className="w-12 h-12 rounded-full border-2 border-foreground object-cover cursor-pointer"
            onClick={() => navigate(`/user/${video.user.id}`)}
          />
          {video.user.id !== currentUser.id && (
            <button
              onClick={toggleFollow}
              className={cn(
                "absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-lg font-bold transition-all",
                isFollowing
                  ? "bg-muted text-muted-foreground text-xs"
                  : "gradient-primary"
              )}
            >
              {isFollowing ? '✓' : '+'}
            </button>
          )}
        </div>
      </div>

      {/* Volume toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-4 right-4 p-2 glass rounded-full z-10"
        aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-foreground" />
        ) : (
          <Volume2 className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Shoppable product button */}
      {taggedProducts[video.id] && (
        <button
          onClick={() => setShowProduct(true)}
          className="absolute bottom-24 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/90 backdrop-blur-sm"
        >
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
          <span className="text-xs font-semibold text-primary-foreground">Voir le produit</span>
        </button>
      )}

      {/* Panels */}
      {showComments && (
        <CommentsPanel
          videoId={video.id}
          commentCount={video.comments}
          onClose={() => setShowComments(false)}
        />
      )}
      {showShare && (
        <SharePanel video={video} onClose={() => setShowShare(false)} />
      )}
      {showProduct && taggedProducts[video.id] && (
        <ProductBottomSheet
          product={taggedProducts[video.id]}
          onClose={() => setShowProduct(false)}
        />
      )}
    </div>
  );
};
