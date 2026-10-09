import { useEffect, useState } from 'react';
import { X, ArrowLeft, Phone, Minus, Plus, MapPin, MessageSquare, ShieldCheck, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  calculateSplit,
  generateOrderRef,
  createFedaPayCheckout,
  maskPhone,
  type CommissionType,
} from '@/lib/fedapay';

interface PaymentProduct {
  id?: string;
  name: string;
  price: number;
  currency?: string;
  imageUrl: string;
  sellerName: string;
  sellerId?: string;
}

interface AfrixaPaymentProps {
  product: PaymentProduct;
  onClose: () => void;
  customPrice?: number;
  commissionType?: CommissionType;
}

const operators = [
  { id: 'orange_money', name: 'Orange Money', emoji: '🟠', bg: 'bg-orange-500/10', border: 'border-orange-500' },
  { id: 'wave', name: 'Wave', emoji: '🔵', bg: 'bg-blue-500/10', border: 'border-blue-500' },
  { id: 'mtn', name: 'MTN MoMo', emoji: '🟡', bg: 'bg-yellow-500/10', border: 'border-yellow-500' },
  { id: 'moov', name: 'Moov Money', emoji: '🔵', bg: 'bg-blue-700/10', border: 'border-blue-700' },
];

export const AfrixaPayment = ({ product, onClose, customPrice, commissionType = 'normale' }: AfrixaPaymentProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [operator, setOperator] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderRef, setOrderRef] = useState(() => generateOrderRef());
  const [buyerEmail, setBuyerEmail] = useState('');

  const unit = customPrice ?? product.price;
  const total = unit * quantity;
  const currency = product.currency ?? 'XOF';
  const { commissionAmount, sellerAmount, rate } = calculateSplit(total, commissionType);
  const selectedOp = operators.find(o => o.id === operator);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data.user) throw new Error('Session utilisateur indisponible');
        setBuyerEmail(data.user.email ?? '');
      })
      .catch(() => {
        if (active) toast.error('Connectez-vous pour poursuivre le paiement');
      });
    return () => { active = false; };
  }, []);

  const startPayment = async () => {
    if (!operator || !phone.trim()) {
      toast.error('Choisissez un opérateur et saisissez votre numéro');
      return;
    }
    setProcessing(true);
    setStep(4);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Connectez-vous pour effectuer le paiement');
      if (!product.id || !product.sellerId) {
        throw new Error('Les informations du produit ou du vendeur sont indisponibles');
      }
      if (user.email && buyerEmail && user.email !== buyerEmail) {
        throw new Error('La session utilisateur a changé. Fermez puis rouvrez le paiement.');
      }

      // 1. Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: product.sellerId,
          product_id: product.id,
          product_name: product.name,
          product_image: product.imageUrl,
          quantity,
          unit_price: unit,
          total_price: total,
          commission_rate: rate,
          commission_amount: commissionAmount,
          seller_amount: sellerAmount,
          payment_operator: operator,
          buyer_phone: phone,
          delivery_address: address,
          buyer_note: buyerNote,
          status: 'en_attente',
          payment_reference: orderRef,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;
      setOrderId(order.id);

      // 2. Create payment_transactions row
      const { error: transactionError } = await supabase.from('payment_transactions').insert({
        order_id: order.id,
        fedapay_ref: orderRef,
        amount: total,
        commission_amount: commissionAmount,
        seller_amount: sellerAmount,
        currency,
        operator,
        buyer_phone: phone,
        status: 'initiated',
        escrow_status: 'held',
      });
      if (transactionError) throw transactionError;

      const checkout = await createFedaPayCheckout(order.id);
      window.location.assign(checkout.checkoutUrl);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erreur lors du paiement');
      setProcessing(false);
      setStep(3);
    }
  };

  const goBack = () => { if (step > 1 && !processing) setStep((step - 1) as 1 | 2 | 3); };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={!processing ? onClose : undefined} />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-[#1A1A2E] rounded-t-[20px] border-t border-border/30 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {step > 1 && step < 4 && (
              <button onClick={goBack} className="p-1 rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
            )}
            <h3 className="font-bold text-foreground">
              {step === 1 && 'Résumé commande'}
              {step === 2 && 'Moyen de paiement'}
              {step === 3 && 'Récapitulatif final'}
              {step === 4 && 'Redirection vers FedaPay…'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {step < 4 && (
          <div className="flex gap-2 px-4 mb-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('h-1 flex-1 rounded-full transition-all', s <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        )}

        <div className="px-4 pb-8">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-[#0A0A0F] border border-border/20">
                <img loading="lazy" src={product.imageUrl} alt={product.name} className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm">{product.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{product.sellerName}</p>
                  <p className="text-lg font-bold text-primary mt-2">{unit.toLocaleString()} {currency}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0A0A0F] border border-border/20">
                <span className="text-sm font-medium text-foreground">Quantité</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Minus className="w-4 h-4 text-foreground" />
                  </button>
                  <span className="text-lg font-bold w-8 text-center text-foreground">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0A0A0F] border border-border/20 space-y-1.5">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total</span><span className="text-xl font-bold text-primary">{total.toLocaleString()} {currency}</span></div>
                <div className="flex justify-between text-[11px] text-muted-foreground/70"><span>Commission Afrixa ({(rate * 100).toFixed(0)}%)</span><span>{commissionAmount.toLocaleString()} {currency}</span></div>
                <div className="flex justify-between text-[11px] text-muted-foreground/70"><span>Vendeur reçoit</span><span>{sellerAmount.toLocaleString()} {currency}</span></div>
              </div>

              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Adresse de livraison" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm focus:border-primary" />
              </div>

              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                <textarea placeholder="Note pour le vendeur (optionnel)" value={buyerNote} onChange={e => setBuyerNote(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm min-h-[60px] resize-none focus:border-primary" />
              </div>

              <button onClick={() => address.length >= 5 ? setStep(2) : toast.error('Adresse requise')}
                className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
                Continuer →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-2">Choisir votre opérateur Mobile Money</p>
              {operators.map(op => (
                <button key={op.id} onClick={() => setOperator(op.id)}
                  className={cn('w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3',
                    operator === op.id ? `${op.border} ${op.bg}` : 'border-border/20 bg-[#0A0A0F]')}>
                  <span className="text-2xl">{op.emoji}</span>
                  <span className="font-semibold text-foreground text-sm flex-1">{op.name}</span>
                  {operator === op.id && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}

              {operator && (
                <div className="pt-2 space-y-3 animate-fade-in">
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="tel" placeholder={`Votre numéro ${selectedOp?.name}`} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm focus:border-primary" />
                  </div>
                  <button onClick={() => phone.length >= 8 ? setStep(3) : toast.error('Numéro invalide (min 8 chiffres)')}
                    className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
                    Continuer →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#0A0A0F] border border-border/20 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Produit</span><span className="text-foreground font-medium">{product.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quantité</span><span className="text-foreground font-medium">{quantity}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Adresse</span><span className="text-foreground font-medium text-right max-w-[60%]">{address}</span></div>
                <div className="border-t border-border/20" />
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span className="text-foreground font-medium">{total.toLocaleString()} {currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission service (incluse)</span><span className="text-muted-foreground/80">{commissionAmount.toLocaleString()} {currency}</span></div>
                <div className="border-t border-border/20" />
                <div className="flex justify-between"><span className="font-semibold text-foreground">Total</span><span className="text-xl font-bold text-primary">{total.toLocaleString()} {currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paiement</span><span className="text-foreground font-medium">{selectedOp?.emoji} {selectedOp?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Numéro</span><span className="text-foreground font-medium">{maskPhone(phone)}</span></div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0c1a2e] border border-[#3B82F6]/30">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#3B82F6]">Paiement sécurisé via FedaPay. Vous serez redirigé vers sa page pour finaliser la transaction.</p>
                </div>
              </div>

              <button onClick={startPayment} disabled={processing}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50">
                {processing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Payer ${total.toLocaleString()} ${currency}`}
              </button>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <div>
                <h4 className="text-lg font-bold text-foreground">Ouverture de la page de paiement sécurisée…</h4>
                <p className="text-sm text-muted-foreground mt-1">Vous reviendrez sur Afrixa après le paiement.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
