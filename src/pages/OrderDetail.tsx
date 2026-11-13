import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Package, AlertTriangle, Star, Loader2, MessageCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';
type OrderRecord = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  payment_operator: string | null;
  buyer_phone: string | null;
  delivery_address: string | null;
  buyer_note: string | null;
  payment_reference: string | null;
  status: OrderStatus;
  created_at: string;
};
type TimelineEntry = { id: string; status: string; message: string | null; created_at: string };
type DisputeRecord = { id: string; status: string; reason: string; buyer_evidence: string | null; seller_evidence: string | null };
type DisputeEvent = { id: string; event_type: string; message: string | null; evidence_url: string | null; created_at: string };

const statusConfig: Record<OrderStatus, { label: string; color: string; emoji: string }> = {
  en_attente: { label: 'En attente de paiement', color: 'text-amber-400', emoji: '🟡' },
  payee: { label: 'Payée', color: 'text-blue-400', emoji: '🔵' },
  en_preparation: { label: 'En préparation', color: 'text-blue-400', emoji: '🔵' },
  expediee: { label: 'Expédiée', color: 'text-violet-400', emoji: '🟣' },
  livree: { label: 'Livrée', color: 'text-emerald-400', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-emerald-400', emoji: '✅' },
  litige: { label: 'Litige ouvert', color: 'text-red-400', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-muted-foreground', emoji: '⚫' },
};
const progressStatuses: OrderStatus[] = ['en_attente', 'payee', 'en_preparation', 'expediee', 'livree', 'terminee'];

const OrderDetail = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [disputeEvents, setDisputeEvents] = useState<DisputeEvent[]>([]);
  const [sellerName, setSellerName] = useState('Vendeur Afrixa');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [sellerResponse, setSellerResponse] = useState('');
  const [sellerEvidence, setSellerEvidence] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orderData, error: orderError } = await (supabase as any).from('orders')
        .select('id, buyer_id, seller_id, product_name, product_image, quantity, unit_price, total_price, payment_operator, buyer_phone, delivery_address, buyer_note, payment_reference, status, created_at')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!orderData || (orderData.buyer_id !== user.id && orderData.seller_id !== user.id)) {
        throw new Error('Commande introuvable ou accès refusé.');
      }
      setOrder(orderData as OrderRecord);

      const [{ data: timelineRows, error: timelineError }, { data: disputeRows, error: disputeError }, { data: sellerProfile, error: sellerError }] = await Promise.all([
        supabase.from('order_timeline').select('id, status, message, created_at').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('disputes').select('id, status, reason, buyer_evidence, seller_evidence').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1),
        supabase.from('public_profiles').select('user_id, username, prenom, nom').eq('user_id', orderData.seller_id).maybeSingle(),
      ]);
      if (timelineError) throw timelineError;
      if (disputeError) throw disputeError;
      if (sellerError) throw sellerError;
      setTimeline((timelineRows ?? []) as TimelineEntry[]);
      const currentDispute = (disputeRows?.[0] ?? null) as DisputeRecord | null;
      setDispute(currentDispute);
      if (currentDispute) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: events, error: eventsError } = await (supabase as any).from('dispute_events')
          .select('id, event_type, message, evidence_url, created_at')
          .eq('dispute_id', currentDispute.id)
          .order('created_at', { ascending: true });
        if (eventsError) throw eventsError;
        setDisputeEvents((events ?? []) as DisputeEvent[]);
      } else {
        setDisputeEvents([]);
      }
      setSellerName(sellerProfile?.username || [sellerProfile?.prenom, sellerProfile?.nom].filter(Boolean).join(' ') || 'Vendeur Afrixa');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger cette commande.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user?.id]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  const confirmReceived = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: actionError } = await (supabase as any).rpc('confirm_order_received', { p_order_id: orderId });
      if (actionError) throw actionError;
      toast.success('Réception enregistrée. Le séquestre reste protégé jusqu’au règlement autorisé.');
      await loadOrder();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Confirmation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const updateSellerStatus = async (nextStatus: 'en_preparation' | 'expediee') => {
    if (!orderId || !user?.id) return;
    setBusy(true);
    try {
      const { error: actionError } = await supabase.from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .eq('seller_id', user.id);
      if (actionError) throw actionError;
      toast.success(nextStatus === 'en_preparation' ? 'Commande mise en préparation.' : 'Commande marquée comme expédiée.');
      await loadOrder();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  };

  const openDispute = async () => {
    if (!orderId || !disputeReason) return toast.error('Choisis le motif du litige.');
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: actionError } = await (supabase as any).rpc('open_order_dispute', {
        p_order_id: orderId,
        p_reason: disputeReason,
        p_description: disputeDescription,
        p_evidence_url: disputeEvidence || null,
      });
      if (actionError) throw actionError;
      toast.success('Litige enregistré. Les échanges seront conservés dans son historique.');
      setDisputeDescription('');
      setDisputeEvidence('');
      await loadOrder();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Impossible d’ouvrir le litige.');
    } finally {
      setBusy(false);
    }
  };

  const respondToDispute = async () => {
    if (!dispute || !sellerResponse.trim()) return toast.error('Ajoute une réponse.');
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: actionError } = await (supabase as any).rpc('add_order_dispute_response', {
        p_dispute_id: dispute.id,
        p_message: sellerResponse,
        p_evidence_url: sellerEvidence || null,
      });
      if (actionError) throw actionError;
      toast.success('Réponse du vendeur enregistrée.');
      setSellerResponse('');
      setSellerEvidence('');
      await loadOrder();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Réponse impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!order || rating < 1) return toast.error('Sélectionne une note.');
    setBusy(true);
    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        order_id: order.id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        rating,
        comment: reviewComment.trim() || null,
      });
      if (reviewError) throw reviewError;
      toast.success('Avis publié.');
      setReviewComment('');
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : 'Avis impossible à publier.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  if (error || !order) return (
    <div className="min-h-screen bg-background p-6">
      <button onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="w-6 h-6" /></button>
      <p className="text-sm text-destructive">{error ?? 'Commande introuvable.'}</p>
    </div>
  );

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const currentStep = progressStatuses.indexOf(order.status);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground">Commande {order.id.slice(0, 8).toUpperCase()}</h1>
            <p className={cn('text-xs font-semibold', statusConfig[order.status].color)}>{statusConfig[order.status].emoji} {statusConfig[order.status].label}</p>
          </div>
          <button onClick={() => void loadOrder()} className="text-xs text-primary">Actualiser</button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <section className="p-4 rounded-2xl bg-card border border-border/20">
          <h3 className="text-sm font-semibold text-foreground mb-4">Suivi de commande</h3>
          <div className="space-y-3">
            {progressStatuses.map((step, index) => {
              const reached = currentStep >= 0 && index <= currentStep;
              return (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', reached ? 'bg-primary' : 'border border-muted')}>
                      {reached && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    {index < progressStatuses.length - 1 && <div className={cn('w-0.5 h-5', reached ? 'bg-primary' : 'bg-muted')} />}
                  </div>
                  <div className="pb-2">
                    <p className={cn('text-sm', reached ? 'text-foreground' : 'text-muted-foreground')}>{statusConfig[step].label}</p>
                    {timeline.filter(item => item.status === step).map(item => (
                      <p key={item.id} className="text-xs text-muted-foreground">{item.message} · {new Date(item.created_at).toLocaleString('fr-FR')}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {order.status === 'litige' && <p className="mt-2 text-sm text-red-400">Cette commande est en litige.</p>}
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/20">
          <h3 className="text-sm font-semibold text-foreground mb-3">Produit</h3>
          <div className="flex gap-3">
            {order.product_image ? <img src={order.product_image} alt={order.product_name} className="w-20 h-20 rounded-xl object-cover" /> : <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center"><Package /></div>}
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{order.product_name}</p>
              <p className="text-xs text-muted-foreground">Quantité : {order.quantity}</p>
              <p className="text-sm font-bold text-primary mt-2">{order.total_price.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-card border border-border/20 space-y-2">
          <h3 className="text-sm font-semibold text-foreground mb-2">Détails</h3>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{isBuyer ? 'Vendeur' : 'Acheteur'}</span><span className="text-foreground">{isBuyer ? sellerName : 'Client Afrixa'}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Paiement</span><span className="text-foreground">{order.payment_operator ?? 'Non renseigné'}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Référence</span><span className="text-foreground font-mono">{order.payment_reference ?? '—'}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Adresse</span><span className="text-foreground text-right max-w-[65%]">{order.delivery_address ?? 'Non renseignée'}</span></div>
          {order.buyer_note && <p className="text-xs text-muted-foreground">Note : {order.buyer_note}</p>}
        </section>

        {isSeller && order.status === 'payee' && (
          <button disabled={busy} onClick={() => void updateSellerStatus('en_preparation')} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Démarrer la préparation</button>
        )}
        {isSeller && order.status === 'en_preparation' && (
          <button disabled={busy} onClick={() => void updateSellerStatus('expediee')} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Marquer comme expédiée</button>
        )}
        {isBuyer && order.status === 'expediee' && (
          <div className="space-y-2">
            <button disabled={busy} onClick={() => void confirmReceived()} className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">J’ai reçu ma commande</button>
            <p className="text-xs text-muted-foreground">La confirmation est enregistrée côté serveur. Le séquestre n’est pas libéré automatiquement sans validation du versement.</p>
          </div>
        )}
        {isBuyer && ['payee', 'en_preparation', 'expediee', 'livree'].includes(order.status) && !dispute && (
          <section className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-3">
            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /><h3 className="text-sm font-semibold text-foreground">Signaler un problème</h3></div>
            <select value={disputeReason} onChange={event => setDisputeReason(event.target.value)} className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground">
              <option value="">Choisir un motif</option>
              <option value="Colis non reçu">Colis non reçu</option>
              <option value="Produit endommagé">Produit endommagé</option>
              <option value="Produit différent">Produit différent de la commande</option>
              <option value="Autre">Autre</option>
            </select>
            <textarea value={disputeDescription} onChange={event => setDisputeDescription(event.target.value)} placeholder="Décris le problème..." className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground min-h-20" />
            <input value={disputeEvidence} onChange={event => setDisputeEvidence(event.target.value)} placeholder="Lien vers une preuve (facultatif)" className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground" />
            <button disabled={busy} onClick={() => void openDispute()} className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">Ouvrir un litige</button>
          </section>
        )}

        {dispute && (
          <section className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Litige · {dispute.status}</h3>
            <p className="text-xs text-muted-foreground">Motif : {dispute.reason}</p>
            {dispute.buyer_evidence && <p className="text-xs text-muted-foreground">Éléments acheteur : {dispute.buyer_evidence}</p>}
            {dispute.seller_evidence && <p className="text-xs text-muted-foreground">Réponse vendeur : {dispute.seller_evidence}</p>}
            {disputeEvents.length > 0 && (
              <div className="border-t border-border/30 pt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Historique du litige</p>
                {disputeEvents.map(event => (
                  <div key={event.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{event.event_type === 'opened' ? 'Ouverture' : event.event_type === 'seller_response' ? 'Réponse vendeur' : event.event_type}</span>
                    <span> · {new Date(event.created_at).toLocaleString('fr-FR')}</span>
                    {event.message && <p className="mt-1">{event.message}</p>}
                    {event.evidence_url && <a href={event.evidence_url} target="_blank" rel="noreferrer" className="text-primary underline">Voir la preuve</a>}
                  </div>
                ))}
              </div>
            )}
            {isSeller && !['resolu', 'rejete', 'ferme'].includes(dispute.status) && (
              <>
                <textarea value={sellerResponse} onChange={event => setSellerResponse(event.target.value)} placeholder="Répondre au litige..." className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground min-h-20" />
                <input value={sellerEvidence} onChange={event => setSellerEvidence(event.target.value)} placeholder="Lien vers une preuve (facultatif)" className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground" />
                <button disabled={busy} onClick={() => void respondToDispute()} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Envoyer la réponse</button>
              </>
            )}
          </section>
        )}

        {isBuyer && ['livree', 'terminee'].includes(order.status) && (
          <section className="p-4 rounded-2xl bg-card border border-border/20 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Évaluer le vendeur</h3>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(value => (
                <button key={value} onClick={() => setRating(value)} aria-label={`Note ${value}`}>
                  <Star className={cn('w-7 h-7', value <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted')} />
                </button>
              ))}
            </div>
            <textarea value={reviewComment} onChange={event => setReviewComment(event.target.value)} placeholder="Ton avis (facultatif)..." className="w-full rounded-xl bg-background border border-border p-3 text-sm text-foreground min-h-20" />
            <button disabled={busy || rating === 0} onClick={() => void submitReview()} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">Publier mon avis</button>
          </section>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;
