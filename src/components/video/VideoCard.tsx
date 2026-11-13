import { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Music, Play, Volume2, VolumeX, ShoppingCart } from 'lucide-react';
import { Video } from '@/types';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { CommentsPanel } from './CommentsPanel';
import { SharePanel } from './SharePanel';
import { ProductBottomSheet } from '@/components/marketplace/ProductBottomSheet';
import { useSocialInteractions, useFollow } from '@/hooks/useSocialInteractions';
import { useAuth } from '@/contexts/useAuth';
import { useNavigate } from 'react-router-dom';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { CreatorTipButton } from '@/components/creators/CreatorTipButton';
import { AdvancedVideoControls } from '@/components/video/AdvancedVideoControls';
import { trackFollow, trackProductView, trackVideoComplete, trackVideoLike, trackVideoView } from '@/lib/firebase/analytics';
import { getVideoWatchStates, recordVideoWatch } from '@/lib/watchHistory';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/marketplace';

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
  const { user } = useAuth();
  const viewerId = user?.id ?? '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const longPressRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const previousSpeedRef = useRef(1);

  useEffect(() => () => {
    if (longPressRef.current) window.window.clearTimeout(longPressRef.current);
    if (seekFeedbackTimerRef.current) window.window.clearTimeout(seekFeedbackTimerRef.current);
  }, []);
  const [progress, setProgress] = useState(0);
  const completionTrackedRef = useRef(false);
  const viewTrackedRef = useRef(false);
  const lastWatchSaveRef = useRef(0);
  const [alreadyWatched, setAlreadyWatched] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [taggedProduct, setTaggedProduct] = useState<Product | null>(null);
  const [showHeart, setShowHeart] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);
  const seekFeedbackTimerRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let active = true;
    const loadTaggedProduct = async () => {
      try {
        const { data: videoRow, error: videoError } = await supabase.from('videos')
          .select('tagged_products')
          .eq('id', video.id)
          .maybeSingle();
        if (videoError) throw videoError;
        const productId = videoRow?.tagged_products?.[0];
        if (!productId) {
          if (active) setTaggedProduct(null);
          return;
        }
        const { data: productRow, error: productError } = await supabase.from('products')
          .select('id, name, description, price, promo_price, category, seller_id, images, stock, unlimited_stock, city, country, views_count, sales_count, created_at')
          .eq('id', productId)
          .eq('is_active', true)
          .maybeSingle();
        if (productError) throw productError;
        if (!productRow) {
          if (active) setTaggedProduct(null);
          return;
        }
        const { data: seller, error: sellerError } = await supabase.from('public_profiles')
          .select('user_id, username, prenom, nom, avatar_url')
          .eq('user_id', productRow.seller_id)
          .maybeSingle();
        if (sellerError) throw sellerError;
        if (!active) return;
        setTaggedProduct({
          id: productRow.id,
          name: productRow.name,
          description: productRow.description ?? '',
          price: productRow.promo_price && productRow.promo_price > 0 && productRow.promo_price < productRow.price
            ? productRow.promo_price : productRow.price,
          currency: 'FCFA',
          imageUrl: productRow.images?.[0] ?? '',
          category: productRow.category,
          sellerId: productRow.seller_id,
          sellerName: seller?.username || [seller?.prenom, seller?.nom].filter(Boolean).join(' ') || 'Vendeur Afrixa',
          sellerAvatar: seller?.avatar_url ?? '',
          sellerVerified: false,
          stock: productRow.unlimited_stock ? -1 : productRow.stock ?? 0,
          city: productRow.city ?? '',
          country: productRow.country ?? '',
          views: productRow.views_count ?? 0,
          sales: productRow.sales_count ?? 0,
          rating: 0,
          createdAt: productRow.created_at,
        });
      } catch (error) {
        console.error('Unable to load tagged marketplace product', error);
        if (active) setTaggedProduct(null);
      }
    };
    void loadTaggedProduct();
    return () => { active = false; };
  }, [video.id]);

  const saveWatchProgress = useCallback((force = false) => {
    const element = videoRef.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    if (!force && element.currentTime - lastWatchSaveRef.current < 10) return;
    lastWatchSaveRef.current = element.currentTime;
    void recordVideoWatch(video.id, element.currentTime, element.duration);
  }, [video.id]);

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    void getVideoWatchStates([video.id]).then((states) => {
      if (active) setAlreadyWatched(states.get(video.id)?.completed ?? false);
    });
    return () => { active = false; };
  }, [isActive, video.id]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (!video.videoUrl.includes('.m3u8')) {
      element.src = video.videoUrl;
      return;
    }

    let hls: { destroy: () => void } | null = null;
    let active = true;
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = video.videoUrl;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (!active) return;
        if (Hls.isSupported()) {
          const player = new Hls({ enableWorker: true });
          hls = player;
          player.loadSource(video.videoUrl);
          player.attachMedia(element);
        } else {
          element.src = video.videoUrl;
        }
      }).catch((error) => console.error('Unable to load the HLS player', error));
    }

    return () => {
      active = false;
      hls?.destroy();
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [video.videoUrl]);

  const {
    isLiked,
    isSaved,
    likeCount,
    saveCount,
    shareCount,
    isLikeLoading,
    isSaveLoading,
    toggleLike,
    toggleSave,
    registerShare,
  } = useSocialInteractions(video);

  const { isFollowing, toggle: toggleFollow } = useFollow(
    video.user.isFollowing ?? false,
    video.user.id,
    viewerId
  );

  // Play/pause when becoming active
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      if (!viewTrackedRef.current) void trackVideoView();
      viewTrackedRef.current = true;
      completionTrackedRef.current = false;
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      saveWatchProgress(true);
      v.pause();
      v.currentTime = 0;
      setIsPlaying(false);
      viewTrackedRef.current = false;
    }
  }, [isActive, saveWatchProgress]);

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

  const handleVideoDoubleClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    const position = (event.clientX - element.getBoundingClientRect().left) / element.clientWidth;
    if (position < 0.33 || position > 0.67) {
      const direction = position < 0.33 ? 'backward' : 'forward';
      const duration = element.duration;
      if (Number.isFinite(duration) && duration > 0) {
        element.currentTime = Math.max(0, Math.min(duration, element.currentTime + (direction === 'forward' ? 10 : -10)));
      }
      setSeekFeedback(direction);
      if (seekFeedbackTimerRef.current) window.clearTimeout(seekFeedbackTimerRef.current);
      seekFeedbackTimerRef.current = window.setTimeout(() => setSeekFeedback(null), 700);
      return;
    }

    if (!isLiked) {
      toggleLike();
      void trackVideoLike();
      onLike?.(video.id);
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 900);
  };

  const handleLike = () => {
    toggleLike();
    if (!isLiked) void trackVideoLike();
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
      saveWatchProgress();
      if (v.currentTime >= v.duration * 0.95 && !completionTrackedRef.current) {
        completionTrackedRef.current = true;
        void trackVideoComplete(v.duration);
        setAlreadyWatched(true);
      } else if (v.currentTime < 2) {
        completionTrackedRef.current = false;
      }
    }
  };

  const handleVideoPointerDown = (event: React.PointerEvent<HTMLVideoElement>) => {
    if (event.pointerType === 'mouse' || event.button !== 0) return;
    longPressTriggeredRef.current = false;
    previousSpeedRef.current = playbackSpeed;
    longPressRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPlaybackSpeed(2);
    }, 450);
  };

  const handleVideoPointerEnd = () => {
    if (longPressRef.current) window.window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
    if (longPressTriggeredRef.current) setPlaybackSpeed(previousSpeedRef.current);
    longPressTriggeredRef.current = false;
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
        onDoubleClick={handleVideoDoubleClick}
        onPointerDown={handleVideoPointerDown}
        onPointerUp={handleVideoPointerEnd}
        onPointerCancel={handleVideoPointerEnd}
        onPointerLeave={handleVideoPointerEnd}
        onContextMenu={event => event.preventDefault()}
        onTimeUpdate={handleTimeUpdate}
        onPause={() => saveWatchProgress(true)}
        onCanPlay={() => { if (isActive) videoRef.current?.play().catch(() => {}); }}
        poster={video.thumbnailUrl}
      />

      {alreadyWatched && (
        <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          Déjà vue
        </span>
      )}
      <AdvancedVideoControls videoRef={videoRef} videoId={video.id} speed={playbackSpeed} onSpeedChange={setPlaybackSpeed} />

      {seekFeedback && (
        <div className={cn(
          'pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/65 px-4 py-2 text-lg font-bold text-white animate-fade-in',
          seekFeedback === 'backward' ? 'left-8' : 'right-8'
        )}>
          {seekFeedback === 'backward' ? '−10 sec' : '+10 sec'}
        </div>
      )}

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
              {video.user.followers >= 500 && (
                <CreatorBadge level={video.user.followers >= 500000 ? 'elite' : video.user.followers >= 50000 ? 'verified' : 'rising'} compact />
              )}
            </div>
            {/* Inline follow button */}
            {video.user.id !== user?.id && (
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
          <span className="text-xs text-foreground">{formatNumber(shareCount)}</span>
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

        {/* Tip */}
        <div className="interaction-btn">
          <CreatorTipButton creatorId={video.user.id} videoId={video.id} compact />
          <span className="text-xs text-foreground">Tip</span>
        </div>

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
              onClick={() => {
                if (!isFollowing) void trackFollow();
                toggleFollow();
              }}
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
      {taggedProduct && (
        <button
          onClick={() => {
            void trackProductView(taggedProduct.price, 'XOF');
            setShowProduct(true);
          }}
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
          videoOwnerId={video.user.id}
          onClose={() => setShowComments(false)}
        />
      )}
      {showShare && (
        <SharePanel video={video} onClose={() => setShowShare(false)} onShared={registerShare} />
      )}
      {showProduct && taggedProduct && (
        <ProductBottomSheet
          product={taggedProduct}
          onClose={() => setShowProduct(false)}
        />
      )}
    </div>
  );
};
