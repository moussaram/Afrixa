import { supabase } from '@/integrations/supabase/client';

export interface ReleaseEscrowResult {
  success: boolean;
  duplicate?: boolean;
  order_id?: string;
  seller_amount?: number;
  currency?: string;
  error?: string;
}

/**
 * Confirme la réception côté serveur et crédite le portefeuille Afrixa du vendeur.
 * Le serveur vérifie l'acheteur, le paiement, l'expédition et l'absence de litige.
 */
export const releaseEscrow = async (orderId: string): Promise<ReleaseEscrowResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('confirm-marketplace-order', {
      body: { order_id: orderId },
    });
    if (error) return { success: false, error: error.message };
    return {
      success: !!data?.success,
      duplicate: !!data?.duplicate,
      order_id: data?.order_id,
      seller_amount: data?.seller_amount,
      currency: data?.currency,
      error: data?.error,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
};
