-- Phase 1 / Security: prevent public exposure of campaign finances and forged ad metrics.

BEGIN;

DROP POLICY IF EXISTS "ad_campaigns_public_active_select" ON public.ad_campaigns;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ad_campaigns
  FROM PUBLIC, anon, authenticated;

-- The public ad-serving surface exposes creative fields only. Advertiser email,
-- budgets, spend, CPC and accounting counters remain server-side.
CREATE OR REPLACE VIEW public.active_ad_creatives
WITH (security_barrier = true)
AS
SELECT
  id,
  advertiser_name,
  title,
  description,
  media_url,
  media_type,
  cta_text,
  cta_url,
  target_countries,
  target_age_min,
  target_age_max,
  target_interests,
  starts_at,
  ends_at
FROM public.ad_campaigns
WHERE status = 'active'
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now());

REVOKE ALL ON TABLE public.active_ad_creatives FROM PUBLIC;
GRANT SELECT ON TABLE public.active_ad_creatives TO anon, authenticated;

-- Client-generated impressions/clicks are forgeable. Until a signed server-side
-- ad-serving endpoint exists, only trusted service_role workflows may write them.
DROP POLICY IF EXISTS "ad_impressions_owner_insert" ON public.ad_impressions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ad_impressions
  FROM PUBLIC, anon, authenticated;

COMMIT;
