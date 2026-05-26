import { useState } from 'react';
import { X, ArrowLeft, Phone, Minus, Plus, MapPin, MessageSquare, ShieldCheck, Loader2, Check, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { YangoDeliveryStep, buildYangoDeepLink, type DeliveryMethod } from './YangoDeliveryStep';


interface PaymentProduct {
  name: string;
  price: number;
  currency: string;
  imageUrl: string;
  sellerName: string;
  sellerVerified?: boolean;
  sellerId?: string;
}

interface AfrixaPaySheetProps {
  product: PaymentProduct;
  onClose: () => void;
  customPrice?: number;
  subtitle?: string;
  commissionType?: 'normale' | 'group_buy' | 'booste' | 'live';
}

const paymentMethods = [
  { id: 'orange_money', name: 'Orange Money', color: 'bg-orange-500', emoji: '🟠' },
  { id: 'wave', name: 'Wave', color: 'bg-blue-500', emoji: '🔵' },
  { id: 'mtn', name: 'MTN MoMo', color: 'bg-yellow-500', emoji: '🟡' },
  { id: 'moov', name: 'Moov Money', color: 'bg-blue-600', emoji: '🔵' },
];

const generateOrderNumber = () => {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `#AFR-${num}`;
};

export const AfrixaPaySheet = ({ product, onClose, customPrice, subtitle, commissionType = 'normale' }: AfrixaPaySheetProps) => {
  const [step, setStep] = useState<number>(1);
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('yango');
  const [yangoAddress, setYangoAddress] = useState('');
  const sellerAddress = `Boutique ${product.sellerName}`;

  const unitPrice = customPrice ?? product.price;
  const totalPrice = unitPrice * quantity;
  const selectedPayment = paymentMethods.find(m => m.id === selectedMethod);
  const yangoLink = buildYangoDeepLink(sellerAddress, yangoAddress || address);

  const goBack = () => {
    if (step === 2) setStep(1.5);
    else if (step === 1.5) setStep(1);
    else if (step === 3) setStep(2);
  };

  const openYango = () => {
    window.open(yangoLink, '_blank', 'noopener,noreferrer');
  };


  const handlePay = async () => {
    setStep(4);
    setIsProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      setOrderNumber(generateOrderNumber());
      toast.success('Paiement confirmé !');
      if (deliveryMethod === 'yango') {
        toast(`📨 ${product.sellerName} notifié : "Le client a choisi Yango pour la livraison. Préparez la commande."`, { duration: 4000 });
      }
    }, 3000);
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-[#1A1A2E] rounded-t-[20px] border-t border-border/30 max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {step > 1 && step < 4 && (
              <button onClick={goBack} className="p-1 rounded-full hover:bg-muted">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
            )}
            <h3 className="font-bold text-foreground">
              {step === 1 && 'Résumé commande'}
              {step === 1.5 && 'Mode de livraison'}
              {step === 2 && 'Moyen de paiement'}
              {step === 3 && 'Récapitulatif final'}
              {step === 4 && (isProcessing ? 'Traitement...' : 'Commande confirmée')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Steps indicator */}
        {step < 4 && (
          <div className="flex gap-2 px-4 mb-4">
            {[1, 1.5, 2, 3].map(s => (
              <div key={s} className={cn('h-1 flex-1 rounded-full transition-all', s <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
        )}


        <div className="px-4 pb-8">
          {/* Step 1 - Order summary with quantity & address */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-2xl bg-[#0A0A0F] border border-border/20">
                <img loading="lazy" src={product.imageUrl} alt={product.name} className="w-20 h-20 rounded-xl object-cover" />
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm">{product.name}</h4>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">{product.sellerName}</span>
                    {product.sellerVerified && <span className="text-xs">✓</span>}
                  </div>
                  <p className="text-lg font-bold text-primary mt-2">
                    {unitPrice.toLocaleString()} {product.currency}
                  </p>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0A0A0F] border border-border/20">
                <span className="text-sm text-foreground font-medium">Quantité</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4 text-foreground" />
                  </button>
                  <span className="text-lg font-bold text-foreground w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 text-primary-foreground" />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0A0A0F] border border-border/20">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-primary">{totalPrice.toLocaleString()} {product.currency}</span>
              </div>

              {/* Address */}
              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Adresse de livraison"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm focus:border-primary transition-colors"
                />
              </div>

              {/* Note */}
              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                <textarea
                  placeholder="Note pour le vendeur (optionnel)"
                  value={buyerNote}
                  onChange={e => setBuyerNote(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm min-h-[60px] resize-none focus:border-primary transition-colors"
                />
              </div>

              {subtitle && <p className="text-xs text-muted-foreground text-center">{subtitle}</p>}

              <button
                onClick={() => address.length >= 5 ? setStep(1.5) : toast.error('Veuillez entrer une adresse de livraison')}
                className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
              >
                Continuer →
              </button>
            </div>
          )}

          {/* Step 1.5 - Delivery method */}
          {step === 1.5 && (
            <YangoDeliveryStep
              defaultAddress={address}
              onContinue={(method, addr) => {
                setDeliveryMethod(method);
                if (method === 'yango') setYangoAddress(addr);
                setStep(2);
              }}
            />
          )}



          {/* Step 2 - Payment method */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-2">Choisir votre moyen de paiement</p>
              {paymentMethods.map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    'w-full p-4 rounded-2xl border text-left transition-all',
                    selectedMethod === method.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border/20 bg-[#0A0A0F] hover:border-border/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{method.emoji}</span>
                    <span className="font-semibold text-foreground text-sm">{method.name}</span>
                    {selectedMethod === method.id && (
                      <Check className="w-5 h-5 text-primary ml-auto" />
                    )}
                  </div>
                </button>
              ))}

              {selectedMethod && (
                <div className="pt-2 space-y-3 animate-fade-in">
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="tel"
                      placeholder={`Votre numéro ${selectedPayment?.name || ''}`}
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm focus:border-primary transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => phoneNumber.length >= 8 ? setStep(3) : toast.error('Numéro invalide')}
                    className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
                  >
                    Continuer →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3 - Final recap */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#0A0A0F] border border-border/20 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Produit</span>
                  <span className="text-foreground font-medium">{product.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantité</span>
                  <span className="text-foreground font-medium">{quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adresse</span>
                  <span className="text-foreground font-medium text-right max-w-[60%]">{address}</span>
                </div>
                <div className="border-t border-border/20 pt-3" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="text-foreground font-medium">{totalPrice.toLocaleString()} {product.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frais de livraison</span>
                  <span className="text-foreground font-medium italic">À négocier avec vendeur</span>
                </div>
                <div className="border-t border-border/20 pt-3" />
                <div className="flex justify-between">
                  <span className="text-foreground font-semibold">Total à payer</span>
                  <span className="text-xl font-bold text-primary">{totalPrice.toLocaleString()} {product.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paiement via</span>
                  <span className="text-foreground font-medium">{selectedPayment?.emoji} {selectedPayment?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span className="text-foreground font-medium">{phoneNumber}</span>
                </div>
              </div>

              {/* Escrow info */}
              <div className="p-4 rounded-2xl bg-[#0c1a2e] border border-[#3B82F6]/30">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#3B82F6]">
                    🔒 Votre argent est sécurisé. Il sera versé au vendeur uniquement après confirmation de votre réception.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePay}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors"
              >
                Payer {totalPrice.toLocaleString()} {product.currency}
              </button>
            </div>
          )}

          {/* Step 4 - Processing & Success */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              {isProcessing ? (
                <>
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <div>
                    <h4 className="text-lg font-bold text-foreground">Traitement en cours...</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Validez sur votre téléphone si une confirmation vous est demandée
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center animate-scale-in">
                    <Check className="w-10 h-10 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-foreground">Commande confirmée ! 🎉</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Numéro de commande : <span className="font-bold text-primary">{orderNumber}</span>
                    </p>
                    {deliveryMethod === 'yango' ? (
                      <p className="text-xs text-[#FF6B00] mt-2">
                        🛵 La livraison Yango a été initiée. Suivez votre commande dans l'app Yango.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Le vendeur a été notifié et prépare votre commande
                      </p>
                    )}
                  </div>
                  <div className="w-full space-y-3 pt-4">
                    {deliveryMethod === 'yango' && (
                      <button
                        onClick={openYango}
                        className="w-full py-3.5 rounded-xl bg-[#FF6B00] text-white font-bold text-sm shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:bg-[#ff7a1a] transition-colors"
                      >
                        🛵 Commander la livraison sur Yango
                      </button>
                    )}
                    <button
                      onClick={() => { onClose(); window.location.href = '/orders'; }}
                      className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
                    >
                      📦 Voir ma commande
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full py-3 rounded-xl bg-muted text-foreground font-semibold text-sm"
                    >
                      🏠 Retour à l'accueil
                    </button>
                  </div>

                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
