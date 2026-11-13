import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CommissionType, verifyFedaPayPayment } from '@/lib/fedapay';
import { getFriendlyTransactionError } from '@/lib/transactionErrors';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export interface InitPaymentData {
  productId: string;
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
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() => crypto.randomUUID());

  const initPayment = async (data: InitPaymentData) => {
    setIsLoading(true);
    setPaymentStatus('processing');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const buyerId = userData?.user?.id;
      if (!buyerId) throw new Error('Vous devez être connecté');

      if (!data.productId) throw new Error('Produit indisponible pour le paiement');

      const { data: checkout, error: checkoutError } = await supabase.rpc('create_my_order_payment', {
        p_product_id: data.productId,
        p_quantity: data.quantity,
        p_operator: selectedOperator,
        p_phone: buyerPhone,
        p_delivery_address: data.deliveryAddress,
        p_buyer_note: data.buyerNote ?? null,
        p_idempotency_key: checkoutIdempotencyKey,
      });
      if (checkoutError) throw checkoutError;

      const payload = checkout as { order_id?: unknown; order_reference?: unknown; amount?: unknown } | null;
      const createdOrderId = typeof payload?.order_id === 'string' ? payload.order_id : '';
      const createdOrderRef = typeof payload?.order_reference === 'string' ? payload.order_reference : '';
      const totalPrice = Number(payload?.amount);
      if (!createdOrderId || !createdOrderRef || !Number.isSafeInteger(totalPrice) || totalPrice <= 0) {
        throw new Error('Réponse de création de commande invalide');
      }

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
    setCheckoutIdempotencyKey(crypto.randomUUID());
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
