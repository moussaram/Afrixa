/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import type { CoinPack, CoinPurchase, CoinTransaction, CoinWallet, GiftCatalogItem } from '@/lib/coins';

const client = supabase as any;

const EMPTY_WALLET: CoinWallet = { balance: 0, lifetime_earned: 0, lifetime_spent: 0 };

export const useCoins = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<CoinWallet>(EMPTY_WALLET);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [gifts, setGifts] = useState<GiftCatalogItem[]>([]);
  const [purchases, setPurchases] = useState<CoinPurchase[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [packsResult, giftsResult] = await Promise.all([
        client.from('coin_packs')
          .select('id, slug, name, coins, price_fcfa, bonus_percent, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
        client.from('virtual_gifts')
          .select('id, name, emoji, price_coins, fcfa_value, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ]);
      if (packsResult.error) throw packsResult.error;
      if (giftsResult.error) throw giftsResult.error;
      setPacks(packsResult.data ?? []);
      setGifts(giftsResult.data ?? []);

      if (!user?.id) {
        setWallet(EMPTY_WALLET);
        setPurchases([]);
        setTransactions([]);
        return;
      }

      const [walletResult, purchasesResult, transactionsResult] = await Promise.all([
        client.from('coin_balances')
          .select('balance, lifetime_earned, lifetime_spent')
          .eq('user_id', user.id)
          .maybeSingle(),
        client.from('coin_purchases')
          .select('id, coins_amount, fcfa_paid, operator, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        client.from('coin_transactions')
          .select('id, type, amount, description, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      if (walletResult.error) throw walletResult.error;
      if (purchasesResult.error) throw purchasesResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      setWallet(walletResult.data ?? EMPTY_WALLET);
      setPurchases(purchasesResult.data ?? []);
      setTransactions(transactionsResult.data ?? []);
    } catch (loadError) {
      console.error('Unable to load coin data', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les Coins.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Le solde change apres un cadeau recu ou un paiement confirme.
  useEffect(() => {
    if (!user?.id) return;
    const channel = client
      .channel(`coin-balance-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coin_balances', filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, load]);

  return { wallet, packs, gifts, purchases, transactions, loading, error, refresh: load };
};
