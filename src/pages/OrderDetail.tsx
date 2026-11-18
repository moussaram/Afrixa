import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, AlertTriangle, Package, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';
type Order = {
  id: string; buyer_id: string; seller_id: string; product_name: string; product_image: string | null;
  quantity: number; unit_price: number; total_price: number; commission_amount: number; seller_amount: number;
  payment_operator: string | null; payment_reference: string | null; delivery_address: string | null;
  buyer_note: string | null; tracking_number: string | null; status: OrderStatus; escrow_released: boolean;
  created_at: string; shipped_at: string | null; buyer_confirmed_at: string | null; released_at: string | null;
};
type Timeline = { id: string; status: string; message: string | null; created_at: string };
const statusLabels: Record<OrderStatus, string> = {
  en_attente: 'En attente de paiement', payee: 'Paiement confirmé', en_preparation: 'En préparation',
  expediee: 'Expédiée', livree: 'Livrée', terminee: 'Terminée · fonds libérés',
  litige: 'Litige ouvert', annulee: 'Annulée',
};
const formatFCFA = (value: number) => Number(value || 0).toLocaleString('fr-FR') + ' FCFA';

const OrderDetail = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<Timeline[]>([]);
  const [sellerName, setSellerName] = useState('Vendeur Afrixa');
  const [sellerAvatar, setSellerAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Produit non reçu');
  const [disputeDetails, setDisputeDetails] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Connectez-vous pour consulter cette commande.');
      const { data, error } = await supabase.from('orders')
        .select('id, buyer_id, seller_id, product_name, product_image, quantity, unit_price, total_price, commission_amount, seller_amount, payment_operator, payment_reference, delivery_address, buyer_note, tracking_number, status, escrow_released, created_at, shipped_at, buyer_confirmed_at, released_at')
        .eq('id', orderId).eq('buyer_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Commande introuvable.');
      setOrder(data as Order);

      const [timelineRes, profileRes] = await Promise.all([
        supabase.from('order_timeline').select('id, status, message, created_at').eq('order_id', orderId).order('created_at', { ascending: true }),
        supabase.from('profiles').select('username, prenom, nom, avatar_url').eq('user_id', data.seller_id).maybeSingle(),
      ]);
      if (timelineRes.error) throw timelineRes.error;
      if (profileRes.error) throw profileRes.error;
      setTimeline((timelineRes.data ?? []) as Timeline[]);
      const profile = profileRes.data;
      setSellerName([profile?.prenom, profile?.nom].filter(Boolean).join(' ').trim() || (profile?.username ? '@' + profile.username : 'Vendeur Afrixa'));
      setSellerAvatar(profile?.avatar_url ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger la commande');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  const confirmReceived = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-marketplace-order', { body: { order_id: order.id } });
      if (error) throw error;
      if (!data?.success) throw new Error('La confirmation n’a pas abouti.');
      setShowConfirm(false);
      toast.success('Réception confirmée. Le montant net a été crédité au portefeuille du vendeur.');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de confirmer la réception');
    } finally {
      setConfirming(false);
    }
  };

  const openDispute = async () => {
    if (!order) return;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Session utilisateur indisponible');
      const { error } = await supabase.from('disputes').insert({
        order_id: order.id,
        buyer_id: user.id,
        seller_id: order.seller_id,
        reason: [disputeReason, disputeDetails.trim()].filter(Boolean).join(' — '),
        status: 'ouvert',
      });
      if (error) throw error;
      const { error: orderUpdateError } = await supabase.from('orders')
        .update({ status: 'litige' }).eq('id', order.id).eq('buyer_id', user.id);
      if (orderUpdateError) throw orderUpdateError;
      setShowDispute(false);
      toast.success('Litige ouvert. Les fonds restent bloqués pendant son examen.');
      await loadOrder();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’ouvrir le litige');
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] p-6 text-muted-foreground">Chargement de la commande…</div>;
  if (!order) return <div className="min-h-screen bg-[#0A0A0F] p-6 text-center text-foreground"><p>Commande introuvable.</p><button onClick={() => navigate(-1)} className="mt-4 text-primary">Retour</button></div>;

  const statusColor = order.status === 'litige' ? 'text-red-400' : order.escrow_released ? 'text-emerald-400' : 'text-blue-300';

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <div className="flex-1 min-w-0"><h1 className="text-sm font-bold text-foreground">Commande #{order.id.slice(0, 8).toUpperCase()}</h1><p className={cn('text-xs font-semibold', statusColor)}>{statusLabels[order.status]}</p></div>
          <button onClick={() => void loadOrder()} className="p-2" aria-label="Actualiser"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h2 className="text-sm font-semibold text-foreground mb-3">Suivi de commande</h2>
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-primary" /></div>
                <div><p className="text-sm text-foreground">{entry.message || statusLabels[entry.status as OrderStatus] || entry.status}</p><p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString('fr-FR')}</p></div>
              </div>
            ))}
            {timeline.length === 0 && <p className="text-xs text-muted-foreground">Aucun événement enregistré pour le moment.</p>}
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h2 className="text-sm font-semibold text-foreground mb-3">Produit</h2>
          <div className="flex gap-3">
            {order.product_image ? <img loading="lazy" src={order.product_image} alt="" className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><Package /></div>}
            <div><p className="text-sm font-semibold text-foreground">{order.product_name}</p><p className="text-xs text-muted-foreground">Quantité : {order.quantity}</p><p className="text-sm font-bold text-primary mt-1">{formatFCFA(order.total_price)}</p></div>
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h2 className="text-sm font-semibold text-foreground mb-3">Vendeur</h2>
          <div className="flex items-center gap-3">
            {sellerAvatar ? <img loading="lazy" src={sellerAvatar} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Package className="w-4 h-4" /></div>}
            <span className="text-sm font-medium text-foreground">{sellerName}</span>
          </div>
        </section>

        <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 space-y-2">
          <h2 className="text-sm font-semibold text-foreground mb-2">Livraison et paiement</h2>
          {order.delivery_address && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Adresse</span><span className="text-foreground text-right max-w-[65%]">{order.delivery_address}</span></div>}
          {order.tracking_number && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Suivi transporteur</span><span className="text-foreground text-right">{order.tracking_number}</span></div>}
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Paiement</span><span className="text-foreground">{order.payment_operator || 'FedaPay'}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Référence</span><span className="text-foreground font-mono">{order.payment_reference || '—'}</span></div>
          {order.buyer_note && <p className="text-xs text-muted-foreground pt-2">Votre note : {order.buyer_note}</p>}
        </section>

        <section className="p-4 rounded-2xl bg-[#0c1a2e] border border-blue-500/30 space-y-2">
          <h2 className="text-sm font-semibold text-blue-200">🔒 Protection de votre paiement</h2>
          <p className="text-xs text-blue-100/80">{order.escrow_released ? 'La réception a été confirmée et le montant net a été crédité au portefeuille Afrixa du vendeur.' : order.status === 'litige' ? 'Un litige est ouvert. Les fonds restent bloqués pendant son examen.' : 'Le montant reste bloqué. Le vendeur ne reçoit pas son crédit disponible avant votre confirmation explicite de réception.'}</p>
        </section>

        {order.status === 'expediee' && !order.escrow_released && (
          <div className="space-y-3">
            <button onClick={() => setShowConfirm(true)} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm"><Check className="inline w-4 h-4 mr-2" />J’ai reçu ma commande</button>
            <button onClick={() => setShowDispute(true)} className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-semibold text-sm"><AlertTriangle className="inline w-4 h-4 mr-2" />Signaler un problème</button>
          </div>
        )}
        {['payee', 'en_preparation'].includes(order.status) && (
          <p className="text-xs text-muted-foreground text-center">Le vendeur prépare votre commande. Vous pourrez confirmer la réception après son expédition.</p>
        )}
        {order.status === 'terminee' && <p className="text-sm text-emerald-300 text-center"><Check className="inline w-4 h-4 mr-1" />Commande terminée.</p>}
      </div>

      {showConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowConfirm(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#1A1A2E] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground text-center">Confirmer la réception</h3>
            <p className="text-sm text-muted-foreground text-center">Confirmez uniquement si vous avez réellement reçu le produit. Cette action libère le montant net au vendeur et ne peut pas être annulée automatiquement.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold">Annuler</button>
              <button disabled={confirming} onClick={() => void confirmReceived()} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold disabled:opacity-50">{confirming ? 'Confirmation…' : 'Confirmer'}</button>
            </div>
          </div>
        </>
      )}

      {showDispute && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowDispute(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#1A1A2E] rounded-2xl p-5 space-y-3">
            <h3 className="text-lg font-bold text-foreground">Signaler un problème</h3>
            <select value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground text-sm">
              <option>Produit non reçu</option><option>Produit endommagé</option><option>Produit différent de la description</option><option>Commande incomplète</option><option>Autre problème</option>
            </select>
            <textarea value={disputeDetails} onChange={(event) => setDisputeDetails(event.target.value)} placeholder="Décrivez le problème (facultatif)" rows={3} className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground text-sm" />
            <div className="flex gap-3"><button onClick={() => setShowDispute(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold">Annuler</button><button onClick={() => void openDispute()} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold">Ouvrir le litige</button></div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderDetail;
