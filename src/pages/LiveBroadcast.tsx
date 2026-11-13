/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera, CameraOff, Mic, MicOff, FlipHorizontal, X,
  Share2, Users, Heart, MessageCircle, UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveChat } from '@/components/live/LiveChat';
import { LiveReactions } from '@/components/live/LiveReactions';
import { useReactions } from '@/components/live/useReactions';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { type GiftItem } from '@/components/live/gifts';
import { useCoins } from '@/hooks/useCoins';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAgoraLive } from '@/hooks/useAgoraLive';
import { useLiveChat } from '@/hooks/useLiveChat';
import { useLivePresence } from '@/hooks/useLivePresence';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface LiveBroadcastState {
  title?: string;
  commentsEnabled?: boolean;
  sessionId?: string;
  hostId?: string;
}

export default function LiveBroadcast() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as LiveBroadcastState | null) ?? {};
  const routeParams = new URLSearchParams(location.search);
  const title = routeState.title ?? 'Mon Live';
  const commentsEnabled = routeState.commentsEnabled ?? true;
  const sessionId = routeState.sessionId ?? routeParams.get('session') ?? undefined;
  const hostId = routeState.hostId ?? routeParams.get('host') ?? undefined;
  const agora = useAgoraLive(sessionId, 'publisher');
  const { user } = useAuth();
  const chat = useLiveChat(sessionId, { userId: user?.id, hostId, canModerate: true });
  const presence = useLivePresence(sessionId, user?.id, 'host');
  const { messages, sendMessage, hideMessage } = chat;
  const { counters } = presence;
  const { isMicOn, isCamOn } = agora;
  const [duration, setDuration] = useState(0);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const [receivedGifts, setReceivedGifts] = useState<GiftItem[]>([]);
  const coins = useCoins();
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showCohosts, setShowCohosts] = useState(false);
  const [cohosts, setCohosts] = useState<Array<{ user_id: string; username: string | null; avatar_url: string | null; is_cohost: boolean }>>([]);
  const [cohostLoading, setCohostLoading] = useState(false);

  const { reactions, addReaction } = useReactions();

  useEffect(() => {
    if (!sessionId) navigate('/live/setup', { replace: true });
  }, [navigate, sessionId]);

  // Cadeaux payes par les spectateurs, diffuses en temps reel.
  useEffect(() => {
    if (!sessionId) return;
    const channel = (supabase as any)
      .channel(`host-gifts-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gift_transactions', filter: `live_id=eq.${sessionId}` },
        async (payload: { new: { id: string; sender_id: string; gift_id: string | null; coins_spent: number } }) => {
          const row = payload.new;
          if (!row) return;
          const gift = coins.gifts.find((entry: { id: string }) => entry.id === row.gift_id);
          const { data: sender } = await (supabase as any)
            .from('public_profiles')
            .select('username')
            .eq('user_id', row.sender_id)
            .maybeSingle();
          const entry: GiftItem = {
            id: row.id,
            name: gift?.name ?? 'Cadeau',
            emoji: gift?.emoji ?? '🎁',
            coins: Number(row.coins_spent) || 0,
            fromUser: sender?.username ?? 'Un spectateur',
          };
          setActiveGift(entry);
          setReceivedGifts((current) => [entry, ...current].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      void (supabase as any).removeChannel(channel);
    };
  }, [sessionId, coins.gifts]);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback((text: string) => {
    void sendMessage(text).catch((sendError) => {
      console.error('Unable to send live message', sendError);
      toast.error('Impossible d’envoyer le message.');
    });
  }, [sendMessage]);

  const handleDelete = useCallback((id: string) => {
    void hideMessage(id).catch((hideError) => {
      console.error('Unable to hide live message', hideError);
      toast.error('Impossible de masquer ce message.');
    });
  }, [hideMessage]);

  const handleLike = () => {
    if (!sessionId || !user?.id) return;
    addReaction('❤️');
    void (supabase as any).from('live_reactions')
      .insert({ session_id: sessionId, user_id: user.id })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.warn('Unable to save live reaction', error);
      });
  };

  const handleEndLive = async () => {
    if (sessionId) {
      const { error } = await (supabase as any).rpc('end_live', { p_session_id: sessionId });
      if (error) {
        toast.error('Le live n’a pas pu être clôturé côté serveur');
        return;
      }
    }
    navigate('/live/stats', { state: { title, sessionId } });
  };

  const loadCohosts = useCallback(async () => {
    if (!sessionId) return;
    setCohostLoading(true);
    const { data, error } = await (supabase as any).rpc('list_live_viewers', { p_session_id: sessionId });
    if (error) {
      console.error('Unable to list live viewers', error);
      toast.error('Impossible de charger les spectateurs.');
    } else {
      setCohosts(data ?? []);
    }
    setCohostLoading(false);
  }, [sessionId]);

  const toggleCohost = async (viewer: { user_id: string; username: string | null; is_cohost: boolean }) => {
    if (!sessionId) return;
    const rpc = viewer.is_cohost ? 'remove_live_cohost' : 'promote_live_cohost';
    const { error } = await (supabase as any).rpc(rpc, {
      p_session_id: sessionId,
      p_user_id: viewer.user_id,
    });
    if (error) {
      console.error('Unable to update co-host', error);
      toast.error('Impossible de modifier ce co-animateur.');
      return;
    }
    toast.success(
      viewer.is_cohost
        ? `@${viewer.username ?? 'ce spectateur'} n’est plus co-animateur`
        : `@${viewer.username ?? 'ce spectateur'} peut maintenant publier`,
    );
    await loadCohosts();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Camera preview */}
      <div
        ref={agora.videoElementRef}
        data-agora-video="publisher"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity",
          !isCamOn && "opacity-0"
        )}
      />
      {!isCamOn && (
        <div className="absolute inset-0 bg-muted/20 flex items-center justify-center">
          <CameraOff className="w-16 h-16 text-muted-foreground/50" />
        </div>
      )}
      {agora.error && <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-destructive/90 p-3 text-sm text-white">{agora.error}</div>}
      {!agora.connected && !agora.error && <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-black/60 p-3 text-sm text-white">Connexion sécurisée à Agora…</div>}

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
              <span className="text-white text-xs font-semibold">{counters.viewersCount}</span>
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
          disabled={!agora.connected}
          onClick={() => void agora.switchCamera().catch(() => toast.error('Changement de caméra indisponible'))}
          className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
        >
          <FlipHorizontal className="w-5 h-5 text-white" />
        </button>
        <button
          disabled={!agora.connected}
          onClick={() => void agora.toggleMic().catch(() => toast.error('Microphone indisponible'))}
          className={cn(
            "p-3 rounded-full backdrop-blur-sm transition-colors",
            isMicOn ? "bg-black/40 hover:bg-black/60" : "bg-destructive/70 hover:bg-destructive/90"
          )}
        >
          {isMicOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
        </button>
        <button
          disabled={!agora.connected}
          onClick={() => void agora.toggleCamera().catch(() => toast.error('Caméra indisponible'))}
          className={cn(
            "p-3 rounded-full backdrop-blur-sm transition-colors",
            isCamOn ? "bg-black/40 hover:bg-black/60" : "bg-destructive/70 hover:bg-destructive/90"
          )}
        >
          {isCamOn ? <Camera className="w-5 h-5 text-white" /> : <CameraOff className="w-5 h-5 text-white" />}
        </button>
        <button
          onClick={() => {
            const url = `${window.location.origin}/live/view/${hostId ?? ''}`;
            void navigator.clipboard.writeText(url).then(() => toast.success('Lien du live copié !'))
              .catch(() => toast.error('Impossible de copier le lien'));
          }}
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
        <button
          onClick={() => {
            setShowCohosts(true);
            void loadCohosts();
          }}
          className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
          aria-label="Co-animateurs"
        >
          <UserPlus className="w-5 h-5 text-white" />
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
              currentUserId={user?.id ?? ''}
            />
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between px-4 pb-8 pt-3">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="flex flex-col items-center gap-1">
              <Heart className="w-7 h-7 text-destructive fill-destructive drop-shadow" />
              <span className="text-white text-xs font-semibold">{counters.likesCount}</span>
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

      {/* ── CO-HOSTS PANEL ── */}
      {showCohosts && (
        <div className="absolute bottom-28 left-4 right-4 z-20 bg-card/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Co-animateurs</p>
            <button onClick={() => setShowCohosts(false)} className="text-xs text-muted-foreground">
              Fermer
            </button>
          </div>
          {cohostLoading && <p className="py-4 text-center text-xs text-muted-foreground">Chargement…</p>}
          {!cohostLoading && cohosts.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Aucun spectateur connecté.</p>
          )}
          <div className="space-y-2">
            {cohosts.map((viewer) => (
              <div key={viewer.user_id} className="flex items-center gap-2">
                {viewer.avatar_url ? (
                  <img src={viewer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">
                    {(viewer.username ?? '?')[0]?.toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-sm text-foreground truncate">@{viewer.username ?? 'spectateur'}</span>
                <button
                  onClick={() => void toggleCohost(viewer)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-semibold',
                    viewer.is_cohost
                      ? 'bg-destructive/20 text-destructive'
                      : 'gradient-primary text-primary-foreground',
                  )}
                >
                  {viewer.is_cohost ? 'Retirer' : 'Inviter'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── GIFT PANEL ── */}
      {showGiftPanel && (
        <div className="absolute bottom-28 left-4 z-20 bg-card/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 w-72">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">🎁 Cadeaux reçus</p>
            <span className="text-xs font-semibold text-primary">
              {receivedGifts.reduce((total, gift) => total + gift.coins, 0)} coins
            </span>
          </div>
          {receivedGifts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Les cadeaux des spectateurs apparaîtront ici.
            </p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {receivedGifts.map((gift, index) => (
                <div key={`${gift.id}-${index}`} className="flex items-center justify-between rounded-xl bg-muted/40 p-2">
                  <span className="flex items-center gap-2 text-xs text-foreground">
                    <span className="text-lg">{gift.emoji}</span>
                    <span>
                      <span className="block font-semibold">{gift.name}</span>
                      <span className="block text-[10px] text-muted-foreground">@{gift.fromUser}</span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-primary">{gift.coins} 🪙</span>
                </div>
              ))}
            </div>
          )}
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
