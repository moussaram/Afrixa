import { supabase } from '@/integrations/supabase/client';

export type CommissionType = 'normale' | 'group_buy' | 'booste' | 'live';

export const COMMISSION_RATES: Record<CommissionType, number> = {
  normale: 0.05,
  group_buy: 0.03,
  booste: 0.07,
  live: 0.08,
};

const getFunctionError = async (error: unknown): Promise<Error> => {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as Record<string, unknown>).context;
    if (context instanceof Response) {
      try {
        const body: unknown = await context.clone().json();
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          return new Error(body.error);
        }
      } catch {
        // Keep the original Supabase error when the function response is not JSON.
      }
    }
  }
  return error instanceof Error ? error : new Error('payment_request_failed');
};

export const calculateSplit = (amount: number, type: CommissionType = 'normale') => {
  const rate = COMMISSION_RATES[type];
  const commissionAmount = Math.round(amount * rate);
  return { commissionAmount, sellerAmount: amount - commissionAmount, rate };
};

export const generateOrderRef = () => {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('Référence sécurisée indisponible');
  }
  return `AFR-${crypto.randomUUID().replaceAll('-', '')}`;
};

export const createFedaPayCheckout = async (orderId: string): Promise<{ checkoutUrl: string; transactionId: string }> => {
  const { data, error } = await supabase.functions.invoke('create-fedapay-payment', {
    body: { order_id: orderId },
  });
  if (error) throw await getFunctionError(error);
  if (typeof data?.checkout_url !== 'string' || typeof data?.transaction_id !== 'string') {
    throw new Error('Lien de paiement FedaPay indisponible');
  }
  return { checkoutUrl: data.checkout_url, transactionId: data.transaction_id };
};

export const verifyFedaPayPayment = async (transactionId: string | number, txRef: string) => {
  const { data, error } = await supabase.functions.invoke('verify-fedapay-payment', {
    body: { transaction_id: transactionId, tx_ref: txRef },
  });
  if (error) throw await getFunctionError(error);
  return data as { verified: boolean; status?: string; order_id?: string };
};

export const maskPhone = (phone: string) => phone.length < 4
  ? phone
  : `${phone.slice(0, 2)}***${phone.slice(-2)}`;
