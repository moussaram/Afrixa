import { useCallback, useEffect, useState } from 'react';
import { Heart, MessageCircle, Eye, UserPlus, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type ActivityTab = 'watch' | 'likes' | 'comments' | 'interactions';
type ActivityVideo = { id: string; description: string | null; thumbnail_url: string | null; views_count: number | null; user_id: string };
type LikeRow = { video_id: string; created_at: string };
type CommentRow = { id: string; video_id: string; content: string; created_at: string };
type NotificationRow = { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; order_id: string | null };

const tabs = [
  { id: 'watch' as ActivityTab, label: 'Vus', icon: Eye },
  { id: 'likes' as ActivityTab, label: "J'aime", icon: Heart },
  { id: 'comments' as ActivityTab, label: 'Commentaires', icon: MessageCircle },
  { id: 'interactions' as ActivityTab, label: 'Activité', icon: UserPlus },
];

export const ActivityCenter = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActivityTab>('watch');
  const userId = user?.id;
  const [likes, setLikes] = useState<Array<LikeRow & { video: ActivityVideo }>>([]);
  const [comments, setComments] = useState<Array<CommentRow & { video: ActivityVideo }>>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!userId) {
      setLikes([]);
      setComments([]);
      setNotifications([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [likeResult, commentResult, notificationResult] = await Promise.all([
        supabase.from('video_likes').select('video_id,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('video_comments').select('id,video_id,content,created_at').eq('user_id', userId).eq('is_deleted', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('notifications').select('id,title,message,type,is_read,created_at,order_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      ]);
      if (likeResult.error) throw likeResult.error;
      if (commentResult.error) throw commentResult.error;
      if (notificationResult.error) throw notificationResult.error;

      const likeRows = (likeResult.data || []) as LikeRow[];
      const commentRows = (commentResult.data || []) as CommentRow[];
      const videoIds = Array.from(new Set([...likeRows.map(row => row.video_id), ...commentRows.map(row => row.video_id)]));
      const { data: videoData, error: videoError } = videoIds.length
        ? await supabase.from('videos').select('id,description,thumbnail_url,views_count,user_id').in('id', videoIds)
        : { data: [], error: null };
      if (videoError) throw videoError;
      const videoMap = new Map(((videoData || []) as ActivityVideo[]).map(video => [video.id, video]));
      setLikes(likeRows.flatMap(row => { const video = videoMap.get(row.video_id); return video ? [{ ...row, video }] : []; }));
      setComments(commentRows.flatMap(row => { const video = videoMap.get(row.video_id); return video ? [{ ...row, video }] : []; }));
      setNotifications((notificationResult.data || []) as NotificationRow[]);
    } catch (loadError) {
      console.error('Activity center load failed', loadError);
      setError("Impossible de charger l'activité de ce compte.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const formatTime = (iso: string) => {
    const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
    return `il y a ${Math.floor(diff / 86400)} j`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border/30 px-2 pt-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all',
            activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
          )}><Icon className="w-4 h-4" />{tab.label}</button>;
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
        <span className="text-xs text-muted-foreground">Données réelles du compte</span>
        <button onClick={() => void loadActivity()} disabled={loading} aria-label="Actualiser"><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="py-10 text-center text-xs text-muted-foreground">Chargement…</p>}
        {!loading && error && <p className="px-4 py-8 text-center text-xs text-destructive">{error}</p>}
        {!loading && !error && activeTab === 'watch' && (
          <div className="px-6 py-12 text-center">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">Historique de visionnage non disponible</p>
            <p className="text-xs text-muted-foreground mt-1">Afrixa n'enregistre pas encore les vues individuelles dans l'historique de ce compte.</p>
          </div>
        )}
        {!loading && !error && activeTab === 'likes' && (
          likes.length ? <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {likes.map(item => <div key={item.video_id} className="relative aspect-[9/16] bg-muted">
              {item.video.thumbnail_url && <img loading="lazy" src={item.video.thumbnail_url} alt="" className="w-full h-full object-cover" />}
              <div className="absolute bottom-1 left-1 flex items-center gap-0.5"><Heart className="w-3 h-3 text-destructive fill-destructive" /><span className="text-white text-xs font-bold drop-shadow">{formatTime(item.created_at)}</span></div>
            </div>)}
          </div> : <p className="py-12 text-center text-xs text-muted-foreground">Vous n'avez encore aimé aucune vidéo.</p>
        )}
        {!loading && !error && activeTab === 'comments' && (
          comments.length ? <div className="divide-y divide-border/20">
            {comments.map(item => <div key={item.id} className="flex gap-3 px-4 py-3">
              {item.video.thumbnail_url ? <img loading="lazy" src={item.video.thumbnail_url} alt="" className="w-12 h-16 object-cover rounded-lg shrink-0" /> : <div className="w-12 h-16 rounded-lg bg-muted shrink-0" />}
              <div className="flex-1 min-w-0"><p className="text-sm text-foreground">{item.content}</p><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.video.description}</p><p className="text-xs text-muted-foreground mt-1">{formatTime(item.created_at)}</p></div>
            </div>)}
          </div> : <p className="py-12 text-center text-xs text-muted-foreground">Vous n'avez encore publié aucun commentaire.</p>
        )}
        {!loading && !error && activeTab === 'interactions' && (
          notifications.length ? <div className="divide-y divide-border/20">
            {notifications.map(item => <div key={item.id} className="flex items-start gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><UserPlus className="w-4 h-4 text-primary" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{item.title}</p><p className="text-xs text-muted-foreground mt-0.5">{item.message}</p><p className="text-xs text-muted-foreground mt-1">{formatTime(item.created_at)}</p></div>
              {!item.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-2" />}
            </div>)}
          </div> : <p className="py-12 text-center text-xs text-muted-foreground">Aucune notification pour le moment.</p>
        )}
      </div>
    </div>
  );
};
