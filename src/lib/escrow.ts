import { supabase } from '@/integrations/supabase/client';

export const getOperatorCode = (operator: string): string => {
  const codes: Record<string, string> = {
    orange_money: 'ORANGE',
    wave: 'WAVE',
    mtn: 'MTN',
    moov: 'MOOV',
  };
  return codes[operator] || 'ORANGE';
};

export interface ReleaseEscrowResult {
  success: boolean;
  reference?: string;
  error?: string;
}

/**
 * Libère le paiement escrow vers le vendeur via l'edge function sécurisée.
 * Appelée quand l'acheteur confirme la réception de la commande.
 */
export const releaseEscrow = async (orderId: string): Promise<ReleaseEscrowResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('release-escrow', {
      body: { order_id: orderId },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return {
      success: !!data?.success,
      reference: data?.reference,
      error: data?.error,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
};
