/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

export type CoinPack = {
  id: string;
  slug: string;
  name: string;
  coins: number;
  price_fcfa: number;
  bonus_percent: number;
  sort_order: number;
};

export type GiftCatalogItem = {
  id: string;
  name: string;
  emoji: string;
  price_coins: number;
  fcfa_value: number;
  sort_order: number;
};

export type CoinPurchase = {
  id: string;
  coins_amount: number;
  fcfa_paid: number;
  operator: string;
  status: string;
  created_at: string;
};

export type CoinTransaction = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export type CoinWallet = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
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
        // Keep the original error when the function response is not JSON.
      }
    }
  }
  return error instanceof Error ? error : new Error('payment_request_failed');
};

export const createCoinCheckout = async (
  packId: string,
  phone: string,
  operator: string,
): Promise<{ checkoutUrl: string; transactionId: string }> => {
  const { data, error } = await supabase.functions.invoke('create-coin-checkout', {
    body: { pack_id: packId, phone, operator },
  });
  if (error) throw await getFunctionError(error);
  if (typeof data?.checkout_url !== 'string' || typeof data?.transaction_id !== 'string') {
    throw new Error('Lien de paiement FedaPay indisponible');
  }
  return { checkoutUrl: data.checkout_url, transactionId: data.transaction_id };
};

export const sendLiveGift = async (giftId: string, liveId: string) => {
  const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data, error } = await (supabase as any).rpc('send_gift', {
    p_gift_id: giftId,
    p_live_id: liveId,
    p_receiver_id: null,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(error.message);
  return data as {
    sender_balance: number;
    receiver_balance: number;
    gift_name: string;
    gift_emoji: string;
    coins_spent: number;
  };
};

export const COIN_OPERATORS = [
  'fedapay',
  'mtn_open',
  'moov',
  'sbin',
  'wave_ci',
  'orange_ci',
  'wave_sn',
  'orange_sn',
] as const;

export const formatCoins = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} coins`;
