-- Tables publicitaires telles qu en production avant la Phase 8.
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL,
  advertiser_email text NOT NULL,
  title text NOT NULL,
  description text,
  media_url text NOT NULL,
  media_type text CHECK (media_type IN ('image', 'video')),
  cta_text text,
  cta_url text,
  budget integer NOT NULL,
  spent integer DEFAULT 0,
  cpc integer DEFAULT 50,
  target_countries text[] DEFAULT '{CI,SN,ML,BF,GN}',
  target_age_min integer DEFAULT 16,
  target_age_max integer DEFAULT 45,
  target_interests text[],
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_campaigns_public_active_select"
  ON public.ad_campaigns FOR SELECT USING (status = 'active');

CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clicked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_impressions_owner_insert"
  ON public.ad_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE TABLE IF NOT EXISTS public.user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  categories text[] DEFAULT '{}',
  not_interested text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_interests_owner_all"
  ON public.user_interests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns, public.ad_impressions, public.user_interests TO authenticated;
GRANT ALL ON public.ad_campaigns, public.ad_impressions, public.user_interests TO service_role;
