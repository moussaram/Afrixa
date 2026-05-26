import { useState } from 'react';
import { ArrowLeft, MessageCircle, Check, X, Star, AlertTriangle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type OrderStatus = 'en_attente' | 'payee' | 'en_preparation' | 'expediee' | 'livree' | 'terminee' | 'litige' | 'annulee';

const statusConfig: Record<OrderStatus, { label: string; color: string; emoji: string }> = {
  en_attente: { label: 'En attente', color: 'text-[#F59E0B]', emoji: '🟡' },
  payee: { label: 'Payée', color: 'text-[#3B82F6]', emoji: '🔵' },
  en_preparation: { label: 'En préparation', color: 'text-[#3B82F6]', emoji: '🔵' },
  expediee: { label: 'Expédiée', color: 'text-[#7C3AED]', emoji: '🟣' },
  livree: { label: 'Livrée', color: 'text-[#34D399]', emoji: '🟢' },
  terminee: { label: 'Terminée', color: 'text-[#10B981]', emoji: '✅' },
  litige: { label: 'Litige', color: 'text-[#EF4444]', emoji: '🔴' },
  annulee: { label: 'Annulée', color: 'text-[#6B7280]', emoji: '⚫' },
};

const allSteps: OrderStatus[] = ['en_attente', 'payee', 'en_preparation', 'expediee', 'livree', 'terminee'];

const mockOrder = {
  id: '1',
  orderNumber: '#AFR-847291',
  productName: 'Robe Wax Ankara Premium',
  productImage: 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=500&fit=crop',
  sellerName: '@afrifashion',
  sellerAvatar: 'https://i.pravatar.cc/100?img=1',
  quantity: 1,
  unitPrice: 15000,
  totalPrice: 15000,
  currency: 'FCFA',
  paymentOperator: 'Orange Money',
  paymentReference: 'TXN-OM-20240115-8472',
  buyerPhone: '07XXXXXXXX',
  deliveryAddress: 'Cocody, Abidjan, Côte d\'Ivoire',
  deliveryMethod: 'yango' as 'yango' | 'pickup',
  sellerAddress: 'Boutique AfriFashion, Plateau, Abidjan',
  buyerNote: 'Taille M s\'il vous plaît',
  status: 'expediee' as OrderStatus,
  createdAt: '2024-01-15T10:30:00Z',
  timeline: [
    { status: 'en_attente', message: 'Commande créée', date: '15 Jan 2024 · 10:30' },
    { status: 'payee', message: 'Paiement confirmé', date: '15 Jan 2024 · 10:31' },
    { status: 'en_preparation', message: 'Le vendeur prépare votre commande', date: '15 Jan 2024 · 14:00' },
    { status: 'expediee', message: 'Commande expédiée', date: '16 Jan 2024 · 09:00' },
  ],
};

const OrderDetail = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(mockOrder);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const currentStepIdx = allSteps.indexOf(order.status);

  const handleConfirmReceived = () => {
    setOrder(prev => ({ ...prev, status: 'livree' }));
    setShowConfirmModal(false);
    toast.success('Réception confirmée ! Merci 🎉');
    setTimeout(() => setShowReviewModal(true), 500);
  };

  const handleDispute = () => {
    if (!disputeReason) return toast.error('Choisissez une raison');
    setOrder(prev => ({ ...prev, status: 'litige' }));
    setShowDisputeModal(false);
    toast.success('Litige ouvert. Notre équipe vous contactera sous 24h.');
  };

  const handleReview = () => {
    if (rating === 0) return toast.error('Sélectionnez une note');
    setShowReviewModal(false);
    toast.success('Merci pour votre avis ! ⭐');
  };

  const sc = statusConfig[order.status];

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-foreground">{order.orderNumber}</h1>
            <p className={cn('text-xs font-semibold', sc.color)}>{sc.emoji} {sc.label}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Timeline */}
        <div className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h3 className="text-sm font-semibold text-foreground mb-4">Suivi de commande</h3>
          <div className="space-y-0">
            {allSteps.map((step, i) => {
              const isPast = i <= currentStepIdx;
              const isCurrent = i === currentStepIdx;
              const timelineEntry = order.timeline.find(t => t.status === step);
              const stepLabel = statusConfig[step];
              return (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all',
                      isPast ? 'bg-[#7C3AED]' : 'border-2 border-muted bg-transparent'
                    )}>
                      {isPast && <Check className="w-3 h-3 text-white" />}
                    </div>
                    {i < allSteps.length - 1 && (
                      <div className={cn('w-0.5 h-8', isPast ? 'bg-[#7C3AED]' : 'bg-muted')} />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className={cn('text-sm font-medium', isPast ? 'text-foreground' : 'text-muted-foreground')}>
                      {stepLabel.label}
                    </p>
                    {timelineEntry && (
                      <p className="text-xs text-muted-foreground">{timelineEntry.date}</p>
                    )}
                    {isCurrent && !isPast && (
                      <p className="text-xs text-muted-foreground italic">En attente</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product */}
        <div className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h3 className="text-sm font-semibold text-foreground mb-3">Produit</h3>
          <div className="flex gap-3">
            <img loading="lazy" src={order.productImage} alt={order.productName} className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-semibold text-foreground">{order.productName}</p>
              <p className="text-xs text-muted-foreground">Qté: {order.quantity}</p>
              <p className="text-sm font-bold text-primary mt-1">{order.totalPrice.toLocaleString()} {order.currency}</p>
            </div>
          </div>
        </div>

        {/* Seller */}
        <div className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
          <h3 className="text-sm font-semibold text-foreground mb-3">Vendeur</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img loading="lazy" src={order.sellerAvatar} alt="" className="w-10 h-10 rounded-full" />
              <span className="text-sm font-medium text-foreground">{order.sellerName}</span>
            </div>
            <button className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> Contacter
            </button>
          </div>
        </div>

        {/* Delivery & Payment */}
        <div className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Détails</h3>
            {order.deliveryMethod === 'yango' && (
              <span className="px-2 py-0.5 rounded-full bg-[#FF6B00] text-[10px] font-bold text-white">
                🛵 Yango
              </span>
            )}
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Livraison</span>
            <span className="text-foreground">
              {order.deliveryMethod === 'yango' ? '🛵 Yango Livraison' : '🤝 Retrait en main propre'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Adresse</span>
            <span className="text-foreground text-right max-w-[60%]">{order.deliveryAddress}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Paiement</span>
            <span className="text-foreground">{order.paymentOperator}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Référence</span>
            <span className="text-foreground font-mono">{order.paymentReference}</span>
          </div>
          {order.deliveryMethod === 'yango' && (
            <a
              href={`https://ya.cc/maps/?rtext=${encodeURIComponent(order.sellerAddress)}~${encodeURIComponent(order.deliveryAddress)}&rtt=auto`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full py-2.5 rounded-xl bg-[#FF6B00] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#ff7a1a] transition-colors"
            >
              🛵 Ouvrir Yango
            </a>
          )}
        </div>

        {/* Escrow info */}
        {['payee', 'en_preparation', 'expediee'].includes(order.status) && (
          <div className="p-4 rounded-2xl bg-[#0c1a2e] border border-[#3B82F6]/30">
            <p className="text-xs text-[#3B82F6]">
              🔒 Votre argent est sécurisé. Il sera versé au vendeur après votre confirmation de réception.
            </p>
          </div>
        )}

        {/* Action buttons */}
        {order.status === 'expediee' && (
          <div className="space-y-3">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm"
            >
              ✅ J'ai reçu ma commande
            </button>
            <button
              onClick={() => setShowDisputeModal(true)}
              className="w-full py-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444] font-semibold text-sm border border-[#EF4444]/20"
            >
              ❌ Je n'ai pas reçu
            </button>
          </div>
        )}

        {order.status === 'livree' && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
          >
            ⭐ Laisser un avis
          </button>
        )}
      </div>

      {/* Confirm received modal */}
      {showConfirmModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#1A1A2E] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground text-center">Confirmer la réception</h3>
            <p className="text-sm text-muted-foreground text-center">
              Confirmez-vous avoir reçu votre commande en bon état ?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm">
                Annuler
              </button>
              <button onClick={handleConfirmReceived} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm">
                Oui, confirmer
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dispute modal */}
      {showDisputeModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowDisputeModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#1A1A2E] rounded-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              <h3 className="text-lg font-bold text-foreground">Ouvrir un litige</h3>
            </div>
            <div className="space-y-2">
              {['Colis non reçu', 'Produit endommagé', 'Produit différent', 'Autre'].map(r => (
                <button
                  key={r}
                  onClick={() => setDisputeReason(r)}
                  className={cn(
                    'w-full p-3 rounded-xl border text-left text-sm transition-all',
                    disputeReason === r ? 'border-[#EF4444] bg-[#EF4444]/5 text-foreground' : 'border-border/20 text-muted-foreground'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Décrivez le problème..."
              value={disputeDesc}
              onChange={e => setDisputeDesc(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm min-h-[80px] resize-none"
            />
            <button
              onClick={handleDispute}
              className="w-full py-3 rounded-xl bg-[#EF4444] text-white font-semibold text-sm"
            >
              Ouvrir un litige
            </button>
          </div>
        </>
      )}

      {/* Review modal */}
      {showReviewModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowReviewModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#1A1A2E] rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground text-center">Comment s'est passée votre commande ?</h3>
            <div className="flex gap-3 p-3 rounded-xl bg-[#0A0A0F]">
              <img loading="lazy" src={order.productImage} alt="" className="w-12 h-12 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-semibold text-foreground">{order.productName}</p>
                <p className="text-xs text-muted-foreground">{order.sellerName}</p>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)}>
                  <Star className={cn('w-8 h-8 transition-all', s <= rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-muted')} />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Partagez votre expérience..."
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm min-h-[80px] resize-none"
            />
            <button onClick={handleReview} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
              Publier l'avis
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderDetail;
