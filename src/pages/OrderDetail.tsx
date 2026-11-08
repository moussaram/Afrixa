import { useEffect, useState } from 'react';
import { ArrowLeft, Package, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';

interface OrderRecord {
  id: string;
  product_name: string;
  product_image: string | null;
  buyer_id: string;
  seller_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  commission_amount: number;
  seller_amount: number;
  payment_operator: string | null;
  payment_reference: string | null;
  buyer_phone: string | null;
  delivery_address: string | null;
  buyer_note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product_type: string;
  delivery_method: string | null;
  buyer_confirmed_at: string | null;
}

interface TimelineRecord {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]' },
  payee: { label: 'Payée', color: 'text-[#3B82F6]' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]' },
  livree: { label: 'Livrée', color: 'text-[#34D399]' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]' },
  litige: { label: 'Litige', color: 'text-[#EF4444]' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]' },
};

const OrderDetail = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);

  const loadOrder = async () => {
    if (!user || !orderId) {
      setOrder(null);
      setLoading(false);
      setError('Connectez-vous pour consulter cette commande.');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('id, product_name, product_image, buyer_id, seller_id, quantity, unit_price, total_price, commission_amount, seller_amount, payment_operator, payment_reference, buyer_phone, delivery_address, buyer_note, status, created_at, updated_at, product_type, delivery_method, buyer_confirmed_at')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .maybeSingle();
    if (orderError || !data) {
      setOrder(null);
      setTimeline([]);
      setError(orderError ? 'Impossible de charger cette commande.' : 'Commande introuvable ou accès non autorisé.');
      setLoading(false);
      return;
    }
    setOrder(data as OrderRecord);
    const { data: timelineData, error: timelineError } = await supabase
      .from('order_timeline')
      .select('id, status, message, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setTimeline(timelineError ? [] : (timelineData ?? []) as TimelineRecord[]);
    setLoading(false);
  };

  const confirmDelivery = async () => {
    if (!order) return;
    setConfirmingDelivery(true);
    try {
      const { data: confirmation, error: confirmationError } = await supabase.functions.invoke('confirm-order-delivery', {
        body: { order_id: order.id },
      });
      if (confirmationError) throw confirmationError;
      if (confirmation?.error) throw new Error(String(confirmation.error));
      toast.success('Réception confirmée. Le versement vendeur peut maintenant être traité.');
      const { data: payout, error: payoutError } = await supabase.functions.invoke('release-escrow', {
        body: { order_id: order.id },
      });
      if (payoutError || payout?.error) {
        toast.message('Votre confirmation est enregistrée. Le versement vendeur reste en attente de configuration ou de vérification.');
      } else if (payout?.pending) {
        toast.success('Demande de versement transmise au prestataire.');
      }
      await loadOrder();
    } catch (confirmError) {
      console.error('Delivery confirmation failed', confirmError);
      toast.error(confirmError instanceof Error ? confirmError.message : 'Impossible de confirmer la réception.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  useEffect(() => { void loadOrder(); }, [user?.id, orderId]);

  const status = order ? statusConfig[order.status] ?? { label: order.status, color: 'text-muted-foreground' } : null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-foreground">Détail de commande</h1>
            {status && <p className={cn('text-xs font-semibold', status.color)}>{status.label}</p>}
          </div>
          <button onClick={() => void loadOrder()} disabled={loading} className="p-2" aria-label="Actualiser">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {loading && <p className="py-20 text-center text-sm text-muted-foreground">Chargement de la commande…</p>}
      {!loading && error && <div className="px-4 py-20 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={() => void loadOrder()} className="text-sm text-primary font-semibold">Réessayer</button>
      </div>}
      {!loading && order && (
        <div className="px-4 py-4 space-y-4">
          <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
            <div className="flex gap-3">
              {order.product_image
                ? <img src={order.product_image} alt={order.product_name} className="w-20 h-20 rounded-xl object-cover" />
                : <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center"><Package className="w-7 h-7" /></div>}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground">{order.product_name}</h2>
                <p className="text-xs text-muted-foreground mt-1">Quantité : {order.quantity}</p>
                <p className="text-xs text-muted-foreground">Commande #{order.id.slice(0, 8).toUpperCase()}</p>
                <p className={cn('text-sm font-semibold mt-2', status?.color)}>{status?.label}</p>
              </div>
            </div>
          </section>

          <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
            <h3 className="text-sm font-semibold text-foreground mb-3">Suivi réel de la commande</h3>
            {timeline.length > 0 ? <div className="space-y-4">
              {timeline.map((entry, index) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2.5 h-2.5 mt-1 rounded-full bg-primary" />
                    {index < timeline.length - 1 && <span className="w-px flex-1 min-h-7 bg-border" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="text-sm font-medium text-foreground">{statusConfig[entry.status]?.label ?? entry.status}</p>
                    {entry.message && <p className="text-xs text-muted-foreground mt-0.5">{entry.message}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{new Date(entry.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
              ))}
            </div> : <p className="text-xs text-muted-foreground">Aucun événement de suivi enregistré pour le moment.</p>}
          </section>

          {order.status === 'livree' && !order.buyer_confirmed_at && (
            <button onClick={() => void confirmDelivery()} disabled={confirmingDelivery}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />{confirmingDelivery ? 'Confirmation…' : 'Confirmer la réception'}
            </button>
          )}
          {order.buyer_confirmed_at && (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
              Réception confirmée le {new Date(order.buyer_confirmed_at).toLocaleString('fr-FR')}. Le versement vendeur suit le traitement du prestataire.
            </p>
          )}

          <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 space-y-2">
            <h3 className="text-sm font-semibold text-foreground mb-2">Paiement et livraison</h3>
            <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Moyen de paiement</span><span className="text-foreground">{order.payment_operator || 'Non renseigné'}</span></div>
            <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Référence</span><span className="text-foreground break-all">{order.payment_reference || 'En attente'}</span></div>
            {order.buyer_phone && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Téléphone</span><span className="text-foreground">{order.buyer_phone}</span></div>}
            {order.delivery_address && <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Adresse</span><span className="text-foreground text-right">{order.delivery_address}</span></div>}
            {order.buyer_note && <p className="text-xs text-muted-foreground pt-2">Note : {order.buyer_note}</p>}
          </section>

          <section className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 space-y-2">
            <h3 className="text-sm font-semibold text-foreground mb-2">Récapitulatif</h3>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prix unitaire</span><span>{Number(order.unit_price).toLocaleString('fr-FR')} FCFA</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Quantité</span><span>{order.quantity}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>Total</span><span className="text-primary">{Number(order.total_price).toLocaleString('fr-FR')} FCFA</span></div>
          </section>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">La confirmation de réception, les litiges et les remboursements doivent être traités par les opérations serveur sécurisées. Aucun changement de statut local n'est simulé ici.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
