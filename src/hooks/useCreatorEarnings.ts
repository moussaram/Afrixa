/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

const client = supabase as any;

export type CreatorWalletData = {
  balance: number;
  pending: number;
  total_earned: number;
  withdrawal_operator?: string | null;
  withdrawal_phone?: string | null;
};

export type CreatorWithdrawal = {
  id: string;
  amount: number;
  operator: string | null;
  phone_masked: string;
  status: string;
  payout_reference: string | null;
  created_at: string;
};

export type MonetizationSettings = {
  tip_min_coins: number;
  tip_fcfa_per_coin: number;
  view_bonus_fcfa_per_1000: number;
  min_withdrawal_fcfa: number;
  withdrawal_daily_limit: number;
};

const WITHDRAWAL_MESSAGES: Record<string, string> = {
  insufficient_balance: 'Solde disponible insuffisant.',
  withdrawal_pending: 'Un retrait est déjà en cours de traitement.',
  withdrawal_daily_limit: 'Limite quotidienne de retraits atteinte.',
  complete_payout_profile: 'Complète ton prénom et ton nom avant de retirer.',
  payout_unavailable: 'Les retraits sont momentanément indisponibles.',
  payout_processing_failed: 'Le versement a échoué, le montant a été restitué.',
};

const readFunctionError = async (error: unknown): Promise<string> => {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as Record<string, unknown>).context;
    if (context instanceof Response) {
      try {
        const body: unknown = await context.clone().json();
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          return body.error;
        }
      } catch {
        // Keep the generic message when the response is not JSON.
      }
    }
  }
  return error instanceof Error ? error.message : 'withdrawal_failed';
};

export const useCreatorEarnings = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<CreatorWalletData | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<CreatorWithdrawal[]>([]);
  const [settings, setSettings] = useState<MonetizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const [walletResult, earningsResult, withdrawalsResult, settingsResult] = await Promise.all([
        client.from('creator_wallet').select('*').eq('user_id', user.id).maybeSingle(),
        client.from('creator_earnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        client.rpc('get_my_withdrawals', { p_limit: 20 }),
        client.rpc('get_monetization_settings'),
      ]);
      if (walletResult.error) throw walletResult.error;
      if (earningsResult.error) throw earningsResult.error;
      if (withdrawalsResult.error) throw withdrawalsResult.error;
      if (settingsResult.error) throw settingsResult.error;
      setWallet(walletResult.data || { balance: 0, pending: 0, total_earned: 0 });
      setEarnings(earningsResult.data || []);
      setWithdrawals(withdrawalsResult.data || []);
      setSettings((settingsResult.data || [])[0] ?? null);
    } catch (loadError) {
      console.error('Unable to load creator earnings', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les revenus.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestWithdrawal = useCallback(async (amount: number, operator: string, phone: string) => {
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `withdrawal:${crypto.randomUUID()}`
      : `withdrawal:${Date.now()}`;
    const { data, error: functionError } = await supabase.functions.invoke('request-creator-withdrawal', {
      body: { amount, operator, phone, idempotency_key: idempotencyKey },
    });
    if (functionError) {
      const code = await readFunctionError(functionError);
      throw new Error(WITHDRAWAL_MESSAGES[code] ?? 'Le retrait n’a pas pu être enregistré.');
    }
    await load();
    return data as { success: boolean; pending: boolean; status: string; amount: number; message?: string };
  }, [load]);

  return { wallet, earnings, withdrawals, settings, loading, error, retry: load, requestWithdrawal };
};
