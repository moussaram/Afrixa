/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

const client = supabase as any;

export type FeedAd = {
  campaign_id: string;
  advertiser_name: string;
  title: string;
  description: string | null;
  media_url: string;
  cta_text: string;
  cta_url: string;
  cpc: number;
};

export type AdCampaign = {
  id: string;
  title: string;
  description: string | null;
  media_url: string;
  cta_text: string | null;
  cta_url: string | null;
  budget: number;
  spent: number;
  cpc: number;
  impressions: number;
  clicks: number;
  status: string;
  moderation_status: string;
  rejection_reason: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type AdCampaignInput = {
  title: string;
  description: string;
  mediaUrl: string;
  ctaText: string;
  ctaUrl: string;
  budget: number;
  durationDays: number;
  interests: string[];
};

export const fetchFeedAd = async (): Promise<FeedAd | null> => {
  const { data, error } = await client.rpc('get_feed_ad');
  if (error) {
    console.error('Unable to load feed ad', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
};

export const recordAdImpression = async (campaignId: string): Promise<string | null> => {
  const { data, error } = await client.rpc('record_ad_impression', { p_campaign_id: campaignId });
  if (error) {
    console.warn('Unable to record ad impression', error);
    return null;
  }
  return typeof data?.impression_id === 'string' ? data.impression_id : null;
};

export const recordAdClick = async (impressionId: string) => {
  const { data, error } = await client.rpc('record_ad_click', { p_impression_id: impressionId });
  if (error) throw new Error(error.message);
  return data as { charged_fcfa: number; spent_fcfa: number; cta_url: string };
};

export const createAdCampaign = async (input: AdCampaignInput): Promise<{ campaignId: string; budget: number }> => {
  const { data, error } = await client.rpc('create_ad_campaign', {
    p_title: input.title,
    p_description: input.description,
    p_media_url: input.mediaUrl,
    p_cta_text: input.ctaText,
    p_cta_url: input.ctaUrl,
    p_budget: input.budget,
    p_duration_days: input.durationDays,
    p_target_interests: input.interests,
  });
  if (error) throw new Error(error.message);
  return { campaignId: data.campaign_id, budget: Number(data.budget) };
};

export const createAdCheckout = async (campaignId: string, phone: string) => {
  const { data, error } = await client.functions.invoke('create-ad-checkout', {
    body: { campaign_id: campaignId, phone },
  });
  if (error) {
    let code = '';
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const body: unknown = await context.clone().json();
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          code = body.error;
        }
      } catch {
        // Ignore non-JSON errors.
      }
    }
    throw new Error(code || 'ad_checkout_failed');
  }
  if (typeof data?.checkout_url !== 'string') throw new Error('checkout_link_unavailable');
  return data.checkout_url as string;
};

export const setAdCampaignPaused = async (campaignId: string, paused: boolean) => {
  const { error } = await client.rpc(paused ? 'pause_ad_campaign' : 'resume_ad_campaign', {
    p_campaign_id: campaignId,
  });
  if (error) throw new Error(error.message);
};
