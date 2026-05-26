import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera, CameraOff, Mic, MicOff, FlipHorizontal, X,
  Share2, Users, Heart, MessageCircle, MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { LiveChat, LiveMessage, COLORS } from '@/components/live/LiveChat';
import { LiveReactions } from '@/components/live/LiveReactions';
import { useReactions } from '@/components/live/useReactions';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { type GiftItem, GIFTS } from '@/components/live/gifts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MOCK_VIEWERS = [
  { id: '1', username: 'alex_93', avatar: 'https://i.pravatar.cc/40?img=1', color: COLORS[0] },
  { id: '2', username: 'sara_m', avatar: 'https://i.pravatar.cc/40?img=5', color: COLORS[1] },
  { id: '3', username: 'kevin_dj', avatar: 'https://i.pravatar.cc/40?img=8', color: COLORS[2] },
];

function makeMockMessage(viewer: (typeof MOCK_VIEWERS)[0], texts: string[]): LiveMessage {
  const text = texts[Math.floor(Math.random() * texts.length)];
  return {
    id: Math.random().toString(36).slice(2),
    userId: viewer.id,
    username: viewer.username,
    avatar: viewer.avatar,
    text,
    color: viewer.color,
    timestamp: Date.now(),
  };
}

const MOCK_TEXTS = [
  '🔥 Incroyable !', "C'est trop bien !", '❤️❤️❤️', 'Bravo !',
  'Super live !', '👑 Le meilleur !', 'Continue comme ça !', '😍',
];

interface LiveBroadcastState {
  title?: string;
  commentsEnabled?: boolean;
}

export default function LiveBroadcast() {
  const navigate = useNavigate();
  const location = useLocation();
  const { title = 'Mon Live', commentsEnabled = true } = (location.state as LiveBroadcastState | null) ?? {};

  const camera = useCamera({ initialFacing: 'user' });
  const { startStream } = camera;

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const { reactions, addReaction } = useReactions();

  // Start camera on mount
  useEffect(() => {
    startStream();
  }, [startStream]);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate viewer growth
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(v => v + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Simulate incoming mock comments
  useEffect(() => {
    const interval = setInterval(() => {
      const viewer = MOCK_VIEWERS[Math.floor(Math.random() * MOCK_VIEWERS.length)];
      const msg = makeMockMessage(viewer, MOCK_TEXTS);
      setMessages(prev => [...prev.slice(-49), msg]);
      if (Math.random() < 0.3) addReaction('❤️');
    }, 4000);
    return () => clearInterval(interval);
  }, [addReaction]);

  // Simulate occasional gifts
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.2) {
        const g = GIFTS[Math.floor(Math.random() * GIFTS.length)];
        const viewer = MOCK_VIEWERS[Math.floor(Math.random() * MOCK_VIEWERS.length)];
        setActiveGift({ ...g, id: Math.random().toString(36).slice(2), fromUser: viewer.username });
        setLikeCount(l => l + g.value);
        addReaction('🎁');
        setTimeout(() => setActiveGift(null), 3500);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [addReaction]);

  const handleSend = useCallback((text: string) => {
    const msg: LiveMessage = {
      id: Math.random().toString(36).slice(2),
      userId: 'me',
      username: 'Moi',
      avatar: 'https://i.pravatar.cc/40?img=12',
      text,
      color: COLORS[5],
      timestamp: Date.now(),
      isCreator: true,
    };
    setMessages(prev => [...prev.slice(-49), msg]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const handleLike = () => {
    setLikeCount(l => l + 1);
    addReaction('❤️');
  };

  const handleEndLive = () => {
    camera.stopStream();
    navigate('/live/stats', {
      state: { title, duration, viewerCount, likeCount, commentCount: messages.length },
    });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Camera preview */}
      <video
        ref={camera.videoRef}
        autoPlay playsInline muted
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity",
          !isCamOn && "opacity-0"
        )}
        style={{ transform: 'scaleX(-1)' }}
      />
      {!isCamOn && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <CameraOff className="w-16 h-16 text-muted-foreground/50" />
        </div>
      )}

      {/* Dark gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          {/* Live badge + stats */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-destructive px-3 py-1.5 rounded-full shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-bold">EN DIRECT</span>
            </div>
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full">
              <Users className="w-3 h-3 text-white" />
              <span className="text-white text-xs font-semibold">{viewerCount}</span>
            </div>
          </div>

          {/* Duration + controls */}
          <div className="flex items-center gap-2">
            <span className="bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-mono">
              {formatDuration(duration)}
            </span>
            <button
              onClick={() => setShowEndConfirm(true)}
              className="bg-black/40 backdrop-blur-sm p-2 rounded-full hover:bg-destructive/60 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mt-3">
          <p className="text-white text-sm font-semibold drop-shadow-lg">{title}</p>
        </div>
      </div>

      {/* ── REACTIONS ── */}
      <LiveReactions reactions={reactions} />

      {/* ── GIFT ANIMATION ── */}
      <GiftAnimation gift={activeGift} />

      {/* ── RIGHT SIDE CONTROLS ── */}
      <div className="absolute right-4 bottom-48 z-10 flex flex-col gap-3">
        <button
          onClick={() => camera.toggleCamera()}
          className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
        >
          <FlipHorizontal className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setIsMicOn(v => !v)}
          className={cn(
            "p-3 rounded-full backdrop-blur-sm transition-colors",
            isMicOn ? "bg-black/40 hover:bg-black/60" : "bg-destructive/70 hover:bg-destructive/90"
          )}
        >
          {isMicOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
        </button>
        <button
          onClick={() => setIsCamOn(v => !v)}
          className={cn(
            "p-3 rounded-full backdrop-blur-sm transition-colors",
            isCamOn ? "bg-black/40 hover:bg-black/60" : "bg-destructive/70 hover:bg-destructive/90"
          )}
        >
          {isCamOn ? <Camera className="w-5 h-5 text-white" /> : <CameraOff className="w-5 h-5 text-white" />}
        </button>
        <button
          onClick={() => { toast.success('Lien copié !'); }}
          className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
        >
          <Share2 className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() => setChatVisible(v => !v)}
          className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
        >
          <MessageCircle className={cn("w-5 h-5", chatVisible ? "text-white" : "text-muted-foreground")} />
        </button>
      </div>

      {/* ── BOTTOM AREA ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Chat */}
        {chatVisible && (
          <div className="h-56 mx-2 mb-2 bg-black/20 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
            <LiveChat
              messages={messages}
              onSend={handleSend}
              onDelete={handleDelete}
              isCreator={true}
              commentsEnabled={commentsEnabled}
              currentUserId="me"
            />
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-4 pb-8 pt-3">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
              <Heart className="w-7 h-7 text-destructive fill-destructive drop-shadow" />
              <span className="text-white text-xs font-semibold">{likeCount}</span>
            </button>
            <button
              onClick={() => setShowGiftPanel(v => !v)}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-2xl">🎁</span>
              <span className="text-white text-xs">Cadeaux</span>
            </button>
          </div>
          <button
            onClick={() => setShowEndConfirm(true)}
            className="bg-destructive/80 hover:bg-destructive text-white px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
          >
            Terminer
          </button>
        </div>
      </div>

      {/* ── GIFT PANEL ── */}
      {showGiftPanel && (
        <div className="absolute bottom-28 left-4 z-20 bg-card/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 w-72">
          <p className="text-sm font-semibold text-foreground mb-3">🎁 Cadeaux des spectateurs</p>
          <div className="grid grid-cols-3 gap-3">
            {GIFTS.map(g => (
              <button
                key={g.name}
                onClick={() => {
                  setShowGiftPanel(false);
                  toast.info(`Vous ne pouvez pas vous envoyer des cadeaux`);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="text-xs text-foreground">{g.name}</span>
                <span className="text-xs text-primary">{g.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── END CONFIRM DIALOG ── */}
      {showEndConfirm && (
        <div className="absolute inset-0 bg-black/70 z-30 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border/30">
            <h3 className="text-lg font-bold text-foreground mb-2">Terminer le live ?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Votre live sera terminé et les statistiques seront disponibles.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEndConfirm(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={handleEndLive}
              >
                Terminer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
