/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, Heart, Share2, Users, Flag, MessageCircle,
} from 'lucide-react';
import { LiveChat } from '@/components/live/LiveChat';
import { LiveReactions } from '@/components/live/LiveReactions';
import { useReactions } from '@/components/live/useReactions';
import { GiftAnimation } from '@/components/live/GiftAnimation';
import { type GiftCatalogEntry, type GiftItem } from '@/components/live/gifts';
import { useCoins } from '@/hooks/useCoins';
import { sendLiveGift } from '@/lib/coins';
import { reportContent } from '@/lib/security';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { useAgoraLive } from '@/hooks/useAgoraLive';
import { useLiveChat } from '@/hooks/useLiveChat';
import { useLivePresence } from '@/hooks/useLivePresence';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useFollow } from '@/hooks/useSocialInteractions';

interface LiveViewerState {
  title?: string;
}

const client = supabase as any;

export default function LiveViewer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { creatorId } = useParams<{ creatorId: string }>();
  const { user } = useAuth();
  const routeState = (location.state as LiveViewerState | null) ?? {};
  const [sessionId, setSessionId] = useState<string>();
  const [hostId, setHostId] = useState<string>(creatorId ?? '');
  const [title, setTitle] = useState(routeState.title ?? 'Live en cours');
  const [creatorName, setCreatorName] = useState('Créateur en direct');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [activeGift, setActiveGift] = useState<GiftItem | null>(null);
  const coins = useCoins();

  const presence = useLivePresence(sessionId, user?.id, 'viewer');
  const { counters, isCoHost } = presence;
  const agora = useAgoraLive(sessionId, isCoHost ? 'publisher' : 'audience');
  const chat = useLiveChat(sessionId, {
    userId: user?.id,
    hostId,
    canModerate: isCoHost,
  });
  const { stats: hostStats } = useProfileStats(hostId);
  const { isFollowing, isLoading: followLoading, toggle: toggleFollow } = useFollow(
    hostStats.isFollowing,
    hostId,
    user?.id ?? '',
  );

  const { reactions, addReaction } = useReactions();

  useEffect(() => {
    if (!creatorId) return;
    let active = true;
    void (async () => {
      const { data: session, error } = await client
        .from('live_sessions')
        .select('id, host_id, title, status, comments_enabled')
        .eq('host_id', creatorId)
        .eq('status', 'live')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error || !session) {
        toast.error('Ce live n’est plus disponible');
        navigate(-1);
        return;
      }
      setSessionId(session.id);
      setHostId(session.host_id);
      setTitle(session.title);
      setCommentsEnabled(session.comments_enabled !== false);

      const { data: profile } = await client
        .from('profiles')
        .select('username, prenom, nom')
        .eq('user_id', session.host_id)
        .maybeSingle();
      if (active && profile) {
        setCreatorName(
          profile.username || [profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Créateur en direct',
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [creatorId, navigate]);

  // Cadeaux des autres spectateurs : diffuses par Realtime, deja payes en base.
  useEffect(() => {
    if (!sessionId) return;
    const channel = client
      .channel(`live-gifts-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gift_transactions', filter: `live_id=eq.${sessionId}` },
        async (payload: { new: { id: string; sender_id: string; gift_id: string | null; coins_spent: number } }) => {
          const row = payload.new;
          if (!row) return;
          const gift = coins.gifts.find((entry) => entry.id === row.gift_id);
          const { data: sender } = await client
            .from('profiles')
            .select('username')
            .eq('user_id', row.sender_id)
            .maybeSingle();
          setActiveGift({
            id: row.id,
            name: gift?.name ?? 'Cadeau',
            emoji: gift?.emoji ?? '🎁',
            coins: Number(row.coins_spent) || 0,
            fromUser: sender?.username ?? 'Un spectateur',
          });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [sessionId, coins.gifts]);

  const handleSend = useCallback((text: string) => {
    void chat.sendMessage(text).catch((sendError) => {
      console.error('Unable to send live message', sendError);
      toast.error('Impossible d’envoyer le message.');
    });
  }, [chat]);

  const handleDelete = useCallback((id: string) => {
    const action = isCoHost ? chat.hideMessage(id) : chat.deleteMessage(id);
    void action.catch((deleteError) => {
      console.error('Unable to moderate live message', deleteError);
      toast.error('Impossible de modérer ce message.');
    });
  }, [chat, isCoHost]);

  const handleLike = () => {
    if (!sessionId || !user?.id) {
      toast.error('Connecte-toi pour réagir.');
      return;
    }
    addReaction('❤️');
    void client
      .from('live_reactions')
      .insert({ session_id: sessionId, user_id: user.id })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error && !/Trop de reactions/i.test(error.message)) {
          console.warn('Unable to save live reaction', error);
        }
      });
  };

  const handleFollow = async () => {
    if (!user?.id) {
      toast.error('Connecte-toi pour suivre ce créateur.');
      return;
    }
    const next = !isFollowing;
    await toggleFollow();
    toast.success(next ? `Vous suivez ${creatorName}` : 'Abonnement annulé');
  };

  const handleReport = async () => {
    if (!user?.id || !sessionId) {
      toast.error('Connecte-toi pour signaler ce live.');
      return;
    }
    if (!window.confirm('Signaler ce live à la modération ?')) return;
    try {
      const result = await reportContent({
        reporterId: user.id,
        contentType: 'live',
        contentId: sessionId,
        reason: 'Signalement de live',
      });
      toast.success(result?.auto_hidden
        ? 'Signalement envoyé, le live est masqué en attente de modération.'
        : 'Signalement envoyé à la modération.');
    } catch (reportError) {
      console.error('Unable to report live', reportError);
      toast.error('Impossible d’enregistrer le signalement.');
    }
  };

  const handleGift = async (gift: GiftCatalogEntry) => {
    if (!user?.id) {
      toast.error('Connecte-toi pour envoyer un cadeau.');
      return;
    }
    if (!sessionId) {
      toast.error('Ce live n’est plus disponible.');
      return;
    }
    try {
      const result = await sendLiveGift(gift.id, sessionId);
      setShowGiftPanel(false);
      setActiveGift({
        id: gift.id,
        name: result.gift_name,
        emoji: result.gift_emoji || gift.emoji,
        coins: result.coins_spent,
        fromUser: 'Vous',
      });
      toast.success(`${gift.emoji} ${gift.name} envoyé à ${creatorName} !`);
      void coins.refresh();
    } catch (giftError) {
      const message = giftError instanceof Error ? giftError.message : '';
      if (/Solde de coins insuffisant/i.test(message)) {
        toast.error('Solde de Coins insuffisant. Recharge ton solde pour envoyer ce cadeau.');
        navigate('/coins');
        return;
      }
      console.error('Unable to send gift', giftError);
      toast.error('Impossible d’envoyer ce cadeau.');
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/live/view/${creatorId ?? ''}`;
    if (navigator.share) {
      void navigator.share({ title, url });
    } else {
      void navigator.clipboard.writeText(url).then(() => toast.success('Lien copié !'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <div
        ref={agora.videoElementRef}
        data-agora-video="audience"
        className="absolute inset-0 h-full w-full bg-gradient-to-br from-primary/30 via-secondary/20 to-background"
      />
      {agora.error && (
        <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-destructive/90 p-3 text-sm text-white">
          {agora.error}
        </div>
      )}
      {!agora.connected && !agora.error && (
        <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-black/60 p-3 text-sm text-white">
          Connexion au live…
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-9 h-9 rounded-full border-2 border-white/50 bg-primary/70 flex items-center justify-center text-white font-bold">
              {creatorName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">{creatorName}</p>
              {isCoHost && <p className="text-[10px] text-primary">Co-animateur</p>}
            </div>
            {!isCoHost && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={cn(
                  'ml-1 px-3 py-1 rounded-full text-xs font-semibold transition-all disabled:opacity-60',
                  isFollowing
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'gradient-primary text-primary-foreground',
                )}
              >
                {isFollowing ? 'Abonné ✓' : '+ Suivre'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-semibold">{counters.viewersCount}</span>
          </div>
          <div className="flex items-center gap-1 bg-destructive px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-bold">LIVE</span>
          </div>
        </div>

        <div className="mt-2 ml-12">
          <p className="text-white/80 text-sm">{title}</p>
        </div>
      </div>

      <LiveReactions reactions={reactions} />
      <GiftAnimation gift={activeGift} />

      <div className="absolute right-4 bottom-48 z-10 flex flex-col gap-3">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
          <div className="p-3 rounded-full bg-black/40 group-hover:bg-black/60 transition-all">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">{counters.likesCount}</span>
        </button>
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Partager</span>
        </button>
        <button onClick={handleReport} className="flex flex-col items-center gap-1">
          <div className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Signaler</span>
        </button>
        <button
          onClick={() => setChatVisible((value) => !value)}
          className="flex flex-col items-center gap-1"
        >
          <div className="p-3 bg-black/40 backdrop-blur-sm rounded-full hover:bg-black/60 transition-colors">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xs">Chat</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10">
        {chatVisible && (
          <div className="h-52 mx-2 mb-2 bg-black/20 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
            <LiveChat
              messages={chat.messages}
              onSend={handleSend}
              onDelete={handleDelete}
              isCreator={isCoHost}
              commentsEnabled={commentsEnabled}
              currentUserId={user?.id ?? ''}
            />
          </div>
        )}

        <div className="flex items-center justify-between px-4 pb-8 pt-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowGiftPanel((value) => !value)}
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

      {showGiftPanel && (
        <div className="absolute bottom-28 left-4 z-20 bg-card/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 w-72 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">🎁 Envoyer un cadeau</p>
            <span className="text-xs font-semibold text-primary">{coins.wallet.balance} coins</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {coins.gifts.map((gift) => (
              <button
                key={gift.id}
                onClick={() => void handleGift(gift)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all active:scale-95"
              >
                <span className="text-2xl">{gift.emoji}</span>
                <span className="text-xs text-foreground">{gift.name}</span>
                <span className="text-xs font-semibold text-primary">{gift.price_coins} 🪙</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/coins')}
            className="mt-3 w-full rounded-xl bg-primary/10 py-2 text-xs font-semibold text-primary"
          >
            Recharger mes Coins
          </button>
        </div>
      )}
    </div>
  );
}
