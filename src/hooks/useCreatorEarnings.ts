/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

export type CreatorWalletData = {
  balance: number;
  pending: number;
  total_earned: number;
  withdrawal_operator?: string | null;
  withdrawal_phone?: string | null;
};

export const useCreatorEarnings = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<CreatorWalletData | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const [{ data: walletData, error: walletError }, { data: earningsData, error: earningsError }] = await Promise.all([
        (supabase as any).from('creator_wallet').select('*').eq('user_id', user.id).maybeSingle(),
        (supabase as any).from('creator_earnings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (walletError) throw walletError;
      if (earningsError) throw earningsError;
      setWallet(walletData || { balance: 0, pending: 0, total_earned: 0 });
      setEarnings(earningsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les revenus.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { wallet, earnings, loading, error, retry: load };
};
