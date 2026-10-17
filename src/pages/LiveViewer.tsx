import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Heart, Share2, Users, UserPlus, Flag, MoreVertical,
} from 'lucide-react';
import { LiveChat, LiveMessage, COLORS } from '@/components/live/LiveChat';
import { LiveReactions } from '@/components/live/LiveReactions';
import { useReactions } from '@/components/live/useReactions';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { type GiftItem, GIFTS } from '@/components/live/gifts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAgoraLive } from '@/hooks/useAgoraLive';

interface LiveViewerState {
  title?: string;
}

export default function LiveViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { creatorId } = useParams<{ creatorId: string }>();
  const routeState = (location.state as LiveViewerState | null) ?? {};
  const [sessionId, setSessionId] = useState<string>();
  const [title, setTitle] = useState(routeState.title ?? 'Live en cours');
  const [creatorName, setCreatorName] = useState('Créateur en direct');
  const agora = useAgoraLive(sessionId, 'audience');

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const { viewerCount } = agora;
  const [likeCount, setLikeCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);

  const { reactions, addReaction } = useReactions();

  useEffect(() => {
    if (!creatorId) return;
    let active = true;
    void (async () => {
      const { data: session, error } = await supabase.from('live_sessions')
        .select('id, host_id, title, status').eq('host_id', creatorId).eq('status', 'live')
        .order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (error || !session) {
        toast.error('Ce live n’est plus disponible');
        navigate(-1);
        return;
      }
      setSessionId(session.id);
      setTitle(session.title);
      const { data: profile } = await supabase.from('profiles')
        .select('username, prenom, nom').eq('user_id', session.host_id).maybeSingle();
      if (active && profile) setCreatorName(profile.username || [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Créateur en direct');
    })();
    return () => { active = false; };
  }, [creatorId, navigate]);

  const handleSend = useCallback((text: string) => {
    setMessages(prev => [...prev.slice(-49), {
      id: Math.random().toString(36).slice(2),
      userId: 'me',
      username: 'Moi',
      avatar: 'https://i.pravatar.cc/40?img=12',
      text,
      color: COLORS[4],
      timestamp: Date.now(),
    }]);
  }, []);

  const handleLike = () => {
    if (hasLiked) return;
    setHasLiked(true);
    setLikeCount(l => l + 1);
    addReaction('❤️');
    setTimeout(() => setHasLiked(false), 3000);
  };

  const handleSendGift = (g: typeof GIFTS[0]) => {
    const giftItem: GiftItem = { ...g, id: Math.random().toString(36).slice(2), fromUser: 'Moi' };
    setActiveGift(giftItem);
    setShowGiftPanel(false);
    addReaction('🎁');
    toast.success(`${g.emoji} ${g.name} envoyé !`);
    setTimeout(() => setActiveGift(null), 3500);
  };

  const handleFollow = () => {
    setIsFollowing(v => !v);
    toast.success(isFollowing ? 'Abonnement annulé' : `Vous suivez ${creatorName}`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title, url: `https://afrixa.app/live/view/${creatorId}` });
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/live/view/${creatorId}`);
      toast.success('Lien copié !');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <div ref={agora.videoElementRef} data-agora-video="audience" className="absolute inset-0 h-full w-full bg-gradient-to-br from-primary/30 via-secondary/20 to-background" />
      {agora.error && <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-destructive/90 p-3 text-sm text-white">{agora.error}</div>}
      {!agora.connected && !agora.error && <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-black/60 p-3 text-sm text-white">Connexion au live…</div>}

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

      {/* ── TOP ── */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Creator info */}
          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-full border-2 border-white/50 bg-primary/70 flex items-center justify-center text-white font-bold">{creatorName.slice(0, 1).toUpperCase()}</div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">{creatorName}</p>
            </div>
            <button
              onClick={handleFollow}
              className={cn(
                "ml-1 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                isFollowing
                  ? "bg-white/20 text-white border border-white/30"
                  : "gradient-primary text-primary-foreground"
              )}
            >
              {isFollowing ? 'Abonné ✓' : '+ Suivre'}
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-semibold">{viewerCount}</span>
          </div>
          <div className="flex items-center gap-1 bg-destructive px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold">LIVE</span>
          </div>
        </div>

        {/* Title */}
        <div className="mt-2 ml-12">
          <p className="text-white/80 text-sm">{title}</p>
        </div>
      </div>

      {/* ── REACTIONS ── */}
      <LiveReactions reactions={reactions} />

      {/* ── GIFT ANIMATION ── */}
      <GiftAnimation gift={activeGift} />

      {/* ── RIGHT CONTROLS ── */}
      <div className="absolute right-4 bottom-48 z-10 flex flex-col gap-3">
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group"
        >
          <div className={cn(
            "p-3 rounded-full transition-all",
            hasLiked ? "bg-destructive scale-110" : "bg-black/40 group-hover:bg-black/60"
          )}>
            <Heart className={cn("w-5 h-5 transition-all", hasLiked ? "text-white fill-white" : "text-white")} />
          </div>
          <span className="text-white text-xs font-semibold">{likeCount}</span>
        </button>
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Partager</span>
        </button>
        <button onClick={() => toast.info('Signalement envoyé')} className="flex flex-col items-center gap-1">
          <div className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Signaler</span>
        </button>
      </div>

      {/* ── BOTTOM ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {chatVisible && (
          <div className="h-52 mx-2 mb-2 bg-black/20 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
            <LiveChat
              messages={messages}
              onSend={handleSend}
              isCreator={false}
              commentsEnabled={true}
              currentUserId="me"
            />
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between px-4 pb-8 pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-2xl">🎁</span>
              <span className="text-white text-xs">Cadeaux</span>
            </button>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="bg-black/60 border border-white/20 text-white px-5 py-2.5 rounded-full text-sm font-semibold"
          >
            Quitter
          </button>
        </div>
      </div>

      {/* ── GIFT PANEL ── */}
      {showGiftPanel && (
        <div className="absolute bottom-28 left-4 z-20 bg-card/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 w-72 shadow-2xl">
          <p className="text-sm font-semibold text-foreground mb-3">🎁 Envoyer un cadeau</p>
          <div className="grid grid-cols-3 gap-3">
            {GIFTS.map(g => (
              <button
                key={g.name}
                onClick={() => handleSendGift(g)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all active:scale-95"
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="text-xs text-foreground">{g.name}</span>
                <span className="text-xs font-semibold text-primary">{g.value} 🪙</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
