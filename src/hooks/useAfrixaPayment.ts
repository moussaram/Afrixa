import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CommissionType, verifyFedaPayPayment } from '@/lib/fedapay';
import { getFriendlyTransactionError } from '@/lib/transactionErrors';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export interface InitPaymentData {
  productId?: string;
  variantId?: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  sellerId: string;
  deliveryAddress: string;
  buyerNote?: string;
  commissionType?: CommissionType;
}

/**
 * Centralise toute la logique de paiement Afrixa (FedaPay + escrow Supabase).
 */
export const useAfrixaPayment = () => {
  const [paymentStep, setPaymentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [orderId, setOrderId] = useState<string>('');
  const [orderRef, setOrderRef] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID());

  const initPayment = async (data: InitPaymentData) => {
    setIsLoading(true);
    setPaymentStatus('processing');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const buyerId = userData?.user?.id;
      if (!buyerId) throw new Error('Vous devez être connecté');

      if (!data.productId) throw new Error('Produit indisponible pour le paiement');

      // Le serveur utilise le prix et le vendeur du produit en base.
      // La commande et sa transaction sont créées atomiquement et de façon idempotente.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: checkout, error: checkoutError } = await (supabase as any).rpc(
        'create_order_payment_atomic',
        {
          p_product_id: data.productId,
          p_quantity: data.quantity,
          p_variant_id: data.variantId ?? null,
          p_operator: selectedOperator,
          p_phone: buyerPhone,
          p_delivery_address: data.deliveryAddress,
          p_buyer_note: data.buyerNote ?? null,
          p_delivery_lat: null,
          p_delivery_lng: null,
          p_idempotency_key: checkoutKey,
        },
      );
      if (checkoutError) throw checkoutError;
      if (typeof checkout?.order_id !== 'string' || typeof checkout?.order_ref !== 'string') {
        throw new Error('Création de commande échouée');
      }

      const createdOrderId = checkout.order_id as string;
      const createdOrderRef = checkout.order_ref as string;
      const totalPrice = Number(checkout.total_price);
      setOrderId(createdOrderId);
      setOrderRef(createdOrderRef);
      return { orderId: createdOrderId, orderRef: createdOrderRef, totalPrice };
    } catch (e) {
      setPaymentStatus('failed');
      toast.error(getFriendlyTransactionError(e));
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = async (fedaPayTransactionId: string | number) => {
    try {
      const result = await verifyFedaPayPayment(fedaPayTransactionId, orderRef);
      if (!result.verified) {
        setPaymentStatus('failed');
        toast.error('Paiement non vérifié. Contactez le support.');
        return false;
      }
      setPaymentStatus('success');
      toast.success('Paiement confirmé ✅');
      return true;
    } catch (error) {
      setPaymentStatus('failed');
      toast.error(getFriendlyTransactionError(error));
      return false;
    }
  };

  const handleFailure = (error?: unknown) => {
    setPaymentStatus('failed');
    toast.error(getFriendlyTransactionError(error));
  };

  const reset = () => {
    setPaymentStep(1);
    setPaymentStatus('idle');
    setOrderId('');
    setOrderRef('');
    setSelectedOperator('');
    setBuyerPhone('');
    setCheckoutKey(crypto.randomUUID());
  };

  return {
    paymentStep,
    setPaymentStep,
    isLoading,
    paymentStatus,
    orderId,
    orderRef,
    selectedOperator,
    setSelectedOperator,
    buyerPhone,
    setBuyerPhone,
    initPayment,
    handleSuccess,
    handleFailure,
    reset,
  };
};
