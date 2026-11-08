import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type PendingProduct = {
  id: string; name: string; description: string | null; images: string[] | null;
  category: string; price: number; product_type: string; seller_id: string; created_at: string;
};
type PendingStory = { id: string; text_content: string | null; background_color: string | null; type: string; user_id: string; created_at: string };
type PendingVideo = {
  id: string; title: string | null; description: string | null; thumbnail_url: string | null;
  cloudflare_status: string; user_id: string; created_at: string;
};

const AdminModeration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
  const isAdmin = user?.app_metadata?.role === 'admin' || roles.includes('admin');
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [videos, setVideos] = useState<PendingVideo[]>([]);
  const [stories, setStories] = useState<PendingStory[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!isAdmin) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [productResult, videoResult, storyResult] = await Promise.all([
        supabase.from('products')
          .select('id,name,description,images,category,price,product_type,seller_id,created_at')
          .eq('moderation_status', 'pending').order('created_at', { ascending: true }).limit(100),
        supabase.from('videos')
          .select('id,title,description,thumbnail_url,cloudflare_status,user_id,created_at')
          .eq('moderation_status', 'pending').order('created_at', { ascending: true }).limit(100),
        supabase.from('stories')
          .select('id,text_content,background_color,type,user_id,created_at')
          .eq('moderation_status', 'pending').order('created_at', { ascending: true }).limit(100),
      ]);
      if (productResult.error) throw productResult.error;
      if (videoResult.error) throw videoResult.error;
      if (storyResult.error) throw storyResult.error;
      setProducts((productResult.data || []) as PendingProduct[]);
      setVideos((videoResult.data || []) as PendingVideo[]);
      setStories((storyResult.data || []) as PendingStory[]);
    } catch (loadError) {
      console.error('Moderation queue load failed', loadError);
      setError('Impossible de charger la file de modération.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const decide = async (contentType: 'product' | 'video', contentId: string, decision: 'approved' | 'rejected') => {
    const key = `${contentType}:${contentId}`;
    const reason = reasons[key]?.trim() || '';
    if (decision === 'rejected' && reason.length < 3) {
      toast.error('Ajoutez une raison avant de refuser ce contenu.');
      return;
    }
    setWorkingId(key);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('moderate-marketplace-content', {
        body: { content_type: contentType, content_id: contentId, decision, reason },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      toast.success(decision === 'approved' ? 'Contenu approuvé et publié.' : 'Contenu refusé.');
      await loadQueue();
    } catch (moderationError) {
      console.error('Moderation decision failed', moderationError);
      toast.error(moderationError instanceof Error ? moderationError.message : 'Décision impossible.');
    } finally {
      setWorkingId(null);
    }
  };

  if (!isAdmin) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
      <div><ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-lg font-bold text-foreground">Accès réservé</h1>
        <p className="text-sm text-muted-foreground mt-1">Cette page est réservée aux comptes administrateurs autorisés.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm text-primary">Retour à Afrixa</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} aria-label="Retour"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1"><h1 className="font-bold text-foreground">Modération Afrixa</h1><p className="text-xs text-muted-foreground">Validation des produits et vidéos</p></div>
          <button onClick={() => void loadQueue()} disabled={loading} aria-label="Actualiser"><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button>
        </div>
      </header>
      <main className="px-4 py-4 space-y-6">
        {loading && <p className="py-10 text-center text-sm text-muted-foreground">Chargement de la file…</p>}
        {!loading && error && <p className="py-8 text-center text-sm text-destructive">{error}</p>}
        {!loading && !error && products.length + videos.length + stories.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun contenu en attente de validation.</p>
        )}
        {!loading && products.length > 0 && <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Produits en attente ({products.length})</h2>
          {products.map(product => {
            const key = `product:${product.id}`;
            return <article key={key} className="rounded-2xl border border-border/30 bg-card/40 p-3 space-y-3">
              <div className="flex gap-3">
                <img src={product.images?.[0] || '/placeholder.svg'} alt={product.name} className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">{product.category} · {product.product_type === 'digital' ? 'Numérique' : 'Physique'}</p>
                  <p className="text-sm font-semibold text-primary">{product.price.toLocaleString()} XOF</p>
                  <p className="text-xs text-muted-foreground">Vendeur : {product.seller_id.slice(0, 8)}</p>
                </div>
              </div>
              {product.description && <p className="text-xs text-muted-foreground line-clamp-3">{product.description}</p>}
              <textarea value={reasons[key] || ''} onChange={e => setReasons(p => ({ ...p, [key]: e.target.value }))} placeholder="Raison du refus (obligatoire seulement en cas de refus)" rows={2} className="w-full rounded-xl bg-background border border-border/30 px-3 py-2 text-xs text-foreground" />
              <div className="grid grid-cols-2 gap-2">
                <button disabled={workingId === key} onClick={() => void decide('product', product.id, 'approved')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Approuver</button>
                <button disabled={workingId === key} onClick={() => void decide('product', product.id, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="w-4 h-4" />Refuser</button>
              </div>
            </article>;
          })}
        </section>}
        {!loading && stories.length > 0 && <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Stories en attente ({stories.length})</h2>
          {stories.map(story => {
            const key = `story:${story.id}`;
            return <article key={key} className="rounded-2xl border border-border/30 bg-card/40 p-3 space-y-3">
              <div className="rounded-xl p-6 text-center text-lg font-bold text-white" style={{ backgroundColor: story.background_color || '#7C3AED' }}>
                {story.text_content || 'Story sans texte'}
              </div>
              <p className="text-xs text-muted-foreground">Créateur : {story.user_id.slice(0, 8)} · {story.type}</p>
              <textarea value={reasons[key] || ''} onChange={e => setReasons(p => ({ ...p, [key]: e.target.value }))} placeholder="Raison du refus (obligatoire seulement en cas de refus)" rows={2} className="w-full rounded-xl bg-background border border-border/30 px-3 py-2 text-xs text-foreground" />
              <div className="grid grid-cols-2 gap-2">
                <button disabled={workingId === key} onClick={() => void decide('story', story.id, 'approved')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Approuver</button>
                <button disabled={workingId === key} onClick={() => void decide('story', story.id, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="w-4 h-4" />Refuser</button>
              </div>
            </article>;
          })}
        </section>}
        {!loading && videos.length > 0 && <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Vidéos en attente ({videos.length})</h2>
          {videos.map(video => {
            const key = `video:${video.id}`;
            return <article key={key} className="rounded-2xl border border-border/30 bg-card/40 p-3 space-y-3">
              <div className="flex gap-3">
                <img src={video.thumbnail_url || '/placeholder.svg'} alt={video.title || 'Vidéo'} className="w-20 h-28 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground">{video.title || 'Vidéo sans titre'}</h3>
                  <p className="text-xs text-muted-foreground">Traitement média : {video.cloudflare_status}</p>
                  <p className="text-xs text-muted-foreground">Créateur : {video.user_id.slice(0, 8)}</p>
                </div>
              </div>
              {video.description && <p className="text-xs text-muted-foreground line-clamp-3">{video.description}</p>}
              <textarea value={reasons[key] || ''} onChange={e => setReasons(p => ({ ...p, [key]: e.target.value }))} placeholder="Raison du refus (obligatoire seulement en cas de refus)" rows={2} className="w-full rounded-xl bg-background border border-border/30 px-3 py-2 text-xs text-foreground" />
              <div className="grid grid-cols-2 gap-2">
                <button disabled={workingId === key || video.cloudflare_status !== 'ready'} onClick={() => void decide('video', video.id, 'approved')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Approuver</button>
                <button disabled={workingId === key} onClick={() => void decide('video', video.id, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><XCircle className="w-4 h-4" />Refuser</button>
              </div>
            </article>;
          })}
        </section>}
      </main>
    </div>
  );
};

export default AdminModeration;
