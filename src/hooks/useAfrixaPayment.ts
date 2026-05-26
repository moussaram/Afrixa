import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateSplit, CommissionType, generateOrderRef } from '@/lib/flutterwave';

export type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export interface InitPaymentData {
  productId?: string;
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
 * Centralise toute la logique de paiement Afrixa (Flutterwave + escrow Supabase).
 */
export const useAfrixaPayment = () => {
  const [paymentStep, setPaymentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [orderId, setOrderId] = useState<string>('');
  const [orderRef, setOrderRef] = useState<string>('');
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');

  const initPayment = async (data: InitPaymentData) => {
    setIsLoading(true);
    setPaymentStatus('processing');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const buyerId = userData?.user?.id;
      if (!buyerId) throw new Error('Vous devez être connecté');

      const totalPrice = data.unitPrice * data.quantity;
      const { commissionAmount, sellerAmount, rate } = calculateSplit(
        totalPrice,
        data.commissionType ?? 'normale',
      );
      const ref = generateOrderRef();

      // 1. Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          buyer_id: buyerId,
          seller_id: data.sellerId,
          product_id: data.productId ?? null,
          product_name: data.productName,
          product_image: data.productImage ?? null,
          quantity: data.quantity,
          unit_price: data.unitPrice,
          total_price: totalPrice,
          commission_rate: rate,
          commission_amount: commissionAmount,
          seller_amount: sellerAmount,
          payment_operator: selectedOperator,
          buyer_phone: buyerPhone,
          delivery_address: data.deliveryAddress,
          buyer_note: data.buyerNote ?? null,
          status: 'en_attente',
          payment_reference: ref,
        })
        .select()
        .single();
      if (orderErr || !order) throw orderErr ?? new Error('Création commande échouée');

      // 2. Create payment transaction
      const { data: tx, error: txErr } = await supabase
        .from('payment_transactions')
        .insert({
          order_id: order.id,
          flutterwave_ref: ref,
          amount: totalPrice,
          commission_amount: commissionAmount,
          seller_amount: sellerAmount,
          currency: 'XOF',
          operator: selectedOperator,
          buyer_phone: buyerPhone,
          status: 'initiated',
          escrow_status: 'held',
        })
        .select()
        .single();
      if (txErr || !tx) throw txErr ?? new Error('Transaction non créée');

      // 3. Commission split record
      await supabase.from('commission_splits').insert({
        transaction_id: tx.id,
        split_type: data.commissionType ?? 'normale',
        split_rate: rate,
        afrixa_amount: commissionAmount,
        seller_amount: sellerAmount,
        status: 'pending',
      });

      setOrderId(order.id);
      setOrderRef(ref);
      return { orderId: order.id, orderRef: ref, totalPrice };
    } catch (e) {
      setPaymentStatus('failed');
      toast.error(e instanceof Error ? e.message : 'Erreur initialisation paiement');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = async (flutterwaveTxId: string | number) => {
    try {
      const { data, error } = await supabase.functions.invoke('flutterwave-verify', {
        body: { transaction_id: flutterwaveTxId, tx_ref: orderRef },
      });
      if (error || !data?.verified) {
        setPaymentStatus('failed');
        toast.error('Paiement non vérifié. Contactez le support.');
        return false;
      }
      setPaymentStatus('success');
      toast.success('Paiement confirmé ✅');
      return true;
    } catch {
      setPaymentStatus('failed');
      toast.error('Erreur de vérification');
      return false;
    }
  };

  const handleFailure = async () => {
    setPaymentStatus('failed');
    if (orderId) {
      await supabase.from('orders').update({ status: 'annulee' }).eq('id', orderId);
    }
    toast.error('Paiement échoué. Vérifiez votre solde et réessayez.');
  };

  const reset = () => {
    setPaymentStep(1);
    setPaymentStatus('idle');
    setOrderId('');
    setOrderRef('');
    setSelectedOperator('');
    setBuyerPhone('');
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
