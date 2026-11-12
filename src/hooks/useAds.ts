/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import {
  createAdCampaign,
  createAdCheckout,
  setAdCampaignPaused,
  type AdCampaign,
  type AdCampaignInput,
} from '@/lib/ads';

const client = supabase as any;

type AdPricing = {
  cpc_fcfa: number;
  min_budget_fcfa: number;
  impression_cooldown_seconds: number;
};

export const useAds = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [pricing, setPricing] = useState<AdPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const pricingResult = await client
        .from('ad_pricing')
        .select('cpc_fcfa, min_budget_fcfa, impression_cooldown_seconds')
        .eq('id', 1)
        .maybeSingle();
      if (pricingResult.error) throw pricingResult.error;
      setPricing(pricingResult.data ?? null);

      if (!user?.id) {
        setCampaigns([]);
        return;
      }
      const { data, error: campaignError } = await client.rpc('get_my_ad_campaigns');
      if (campaignError) throw campaignError;
      setCampaigns(data ?? []);
    } catch (loadError) {
      console.error('Unable to load ad campaigns', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les campagnes.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (input: AdCampaignInput) => {
    const result = await createAdCampaign(input);
    await load();
    return result;
  }, [load]);

  const pay = useCallback(async (campaignId: string, phone: string) => {
    const checkoutUrl = await createAdCheckout(campaignId, phone);
    window.location.assign(checkoutUrl);
  }, []);

  const togglePause = useCallback(async (campaign: AdCampaign) => {
    await setAdCampaignPaused(campaign.id, campaign.status === 'active');
    await load();
  }, [load]);

  return { campaigns, pricing, loading, error, refresh: load, create, pay, togglePause };
};
