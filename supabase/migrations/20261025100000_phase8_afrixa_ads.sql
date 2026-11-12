-- =============================================================================
-- Phase 8 - Afrixa Ads
--
-- 1. Les campagnes deviennent des objets reels : annonceur, visuel, ciblage,
--    budget, tarif CPC et duree. Elles sont creees par leur annonceur.
-- 2. Le budget est paye par FedaPay ; l activation n a lieu qu apres
--    confirmation du paiement et reste idempotente.
-- 3. La diffusion est servie par le serveur : une campagne active, ciblee,
--    dans son budget et non deja vue recemment. Les impressions et clics sont
--    enregistres en base, le budget est debite au clic.
-- 4. Les compteurs de campagne ne sont plus modifiables par les clients.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Reglages, administrateurs et colonnes de campagne
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ad_pricing (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cpc_fcfa integer NOT NULL DEFAULT 50 CHECK (cpc_fcfa > 0),
  min_budget_fcfa integer NOT NULL DEFAULT 5000 CHECK (min_budget_fcfa > 0),
  impression_cooldown_seconds integer NOT NULL DEFAULT 3600 CHECK (impression_cooldown_seconds >= 60),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ad_pricing (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_pricing_read" ON public.ad_pricing;
CREATE POLICY "ad_pricing_read"
  ON public.ad_pricing FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.ad_pricing TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ad_pricing FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_pricing TO service_role;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins AS admin WHERE admin.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS advertiser_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS objective text NOT NULL DEFAULT 'traffic',
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'feed',
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS fedapay_transaction_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_moderation_status_check;
ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_moderation_status_check CHECK (
  moderation_status IN ('pending', 'approved', 'rejected')
);

ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_duration_check;
ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_duration_check CHECK (
  duration_days BETWEEN 1 AND 90
);

CREATE UNIQUE INDEX IF NOT EXISTS ad_campaigns_transaction_unique_idx
  ON public.ad_campaigns(fedapay_transaction_id)
  WHERE fedapay_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ad_campaigns_advertiser_created_idx
  ON public.ad_campaigns(advertiser_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_campaigns_serving_idx
  ON public.ad_campaigns(status, moderation_status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS ad_impressions_campaign_created_idx
  ON public.ad_impressions(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_impressions_user_campaign_idx
  ON public.ad_impressions(user_id, campaign_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. Protection des ecritures et RLS
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_ad_write_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
    OR coalesce(current_setting('afrixa.ads_writer', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  RAISE EXCEPTION 'Les campagnes publicitaires sont gerees par Afrixa Ads';
END;
$$;

DROP TRIGGER IF EXISTS enforce_ad_write_lock ON public.ad_campaigns;
CREATE TRIGGER enforce_ad_write_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ad_write_lock();

DROP POLICY IF EXISTS "ad_campaigns_public_active_select" ON public.ad_campaigns;
DROP POLICY IF EXISTS "ad_campaigns_visible" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns_visible"
  ON public.ad_campaigns FOR SELECT
  TO authenticated
  USING (
    (status = 'active' AND moderation_status = 'approved')
    OR advertiser_id = auth.uid()
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "ad_impressions_owner_insert" ON public.ad_impressions;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ad_impressions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ad_campaigns FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ad_campaigns, public.ad_impressions TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Creation et paiement d une campagne
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_ad_campaign(
  p_title text,
  p_description text,
  p_media_url text,
  p_cta_text text,
  p_cta_url text,
  p_budget integer,
  p_duration_days integer,
  p_target_interests text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pricing public.ad_pricing%ROWTYPE;
  v_name text;
  v_email text;
  v_campaign_id uuid;
  v_reference text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise pour creer une campagne';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) < 3 OR length(btrim(p_title)) > 100 THEN
    RAISE EXCEPTION 'Le titre de la campagne est invalide';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 300 THEN
    RAISE EXCEPTION 'La description est trop longue';
  END IF;
  IF p_media_url IS NULL OR p_media_url !~ '^https://' THEN
    RAISE EXCEPTION 'Le visuel doit etre une URL https';
  END IF;
  IF p_cta_url IS NULL OR p_cta_url !~ '^https://' THEN
    RAISE EXCEPTION 'Le lien de destination doit etre une URL https';
  END IF;
  IF p_cta_text IS NULL OR length(btrim(p_cta_text)) < 2 OR length(btrim(p_cta_text)) > 30 THEN
    RAISE EXCEPTION 'Le texte du bouton est invalide';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 90 THEN
    RAISE EXCEPTION 'La duree doit etre comprise entre 1 et 90 jours';
  END IF;
  IF p_target_interests IS NOT NULL AND array_length(p_target_interests, 1) > 10 THEN
    RAISE EXCEPTION 'Trop de centres d interet cibles';
  END IF;

  SELECT * INTO v_pricing FROM public.ad_pricing WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarifs publicitaires indisponibles';
  END IF;
  IF p_budget IS NULL OR p_budget < v_pricing.min_budget_fcfa THEN
    RAISE EXCEPTION 'Le budget minimum est de % FCFA', v_pricing.min_budget_fcfa;
  END IF;

  SELECT
    coalesce(nullif(btrim(concat_ws(' ', profile.prenom, profile.nom)), ''), profile.username, 'Annonceur Afrixa'),
    (SELECT email FROM auth.users WHERE id = v_user)
  INTO v_name, v_email
  FROM public.profiles AS profile
  WHERE profile.user_id = v_user;

  v_name := coalesce(v_name, 'Annonceur Afrixa');
  v_email := coalesce(v_email, 'annonceur@afrixa.com');
  v_reference := 'AD-' || replace(gen_random_uuid()::text, '-', '');

  PERFORM set_config('afrixa.ads_writer', 'on', true);

  INSERT INTO public.ad_campaigns (
    advertiser_id, advertiser_name, advertiser_email, title, description,
    media_url, media_type, cta_text, cta_url, budget, spent, cpc,
    target_interests, impressions, clicks, status, moderation_status,
    duration_days, payment_reference
  ) VALUES (
    v_user, v_name, v_email, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    p_media_url, 'image', btrim(p_cta_text), p_cta_url, p_budget, 0, v_pricing.cpc_fcfa,
    coalesce(p_target_interests, '{}'::text[]), 0, 0, 'pending', 'pending',
    p_duration_days, v_reference
  )
  RETURNING id INTO v_campaign_id;

  RETURN jsonb_build_object(
    'campaign_id', v_campaign_id,
    'budget', p_budget,
    'cpc', v_pricing.cpc_fcfa,
    'reference', v_reference,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_ad_campaign(text, text, text, text, text, integer, integer, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ad_campaign(text, text, text, text, text, integer, integer, text[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_ad_campaign_transaction(
  p_campaign_id uuid,
  p_transaction_id text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
  v_transaction text := nullif(btrim(coalesce(p_transaction_id, '')), '');
BEGIN
  IF p_campaign_id IS NULL OR v_transaction IS NULL OR v_transaction !~ '^[0-9]{1,32}$' THEN
    RAISE EXCEPTION 'Transaction publicitaire invalide';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;
  IF v_campaign.fedapay_transaction_id IS NOT NULL
    AND v_campaign.fedapay_transaction_id <> v_transaction THEN
    RAISE EXCEPTION 'Transaction publicitaire deja rattachee';
  END IF;
  IF v_campaign.status <> 'pending' THEN
    RAISE EXCEPTION 'Campagne non payable';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);
  UPDATE public.ad_campaigns
  SET fedapay_transaction_id = v_transaction,
      updated_at = now()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('campaign_id', p_campaign_id, 'transaction_id', v_transaction);
END;
$$;

REVOKE ALL ON FUNCTION public.attach_ad_campaign_transaction(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_ad_campaign_transaction(uuid, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.activate_ad_campaign(
  p_campaign_id uuid,
  p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;
  IF v_campaign.status = 'active' AND v_campaign.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'active');
  END IF;
  IF v_campaign.status <> 'pending' THEN
    RAISE EXCEPTION 'Cette campagne ne peut pas etre activee';
  END IF;
  IF v_campaign.fedapay_transaction_id IS NOT NULL
    AND v_campaign.fedapay_transaction_id IS DISTINCT FROM p_transaction_id THEN
    RAISE EXCEPTION 'Transaction publicitaire incoherente';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);

  UPDATE public.ad_campaigns
  SET status = 'active',
      moderation_status = 'approved',
      paid_at = now(),
      starts_at = now(),
      ends_at = now() + make_interval(days => v_campaign.duration_days),
      fedapay_transaction_id = coalesce(fedapay_transaction_id, p_transaction_id),
      updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object('duplicate', false, 'status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.activate_ad_campaign(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_ad_campaign(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_ad_campaign(p_campaign_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;
  IF v_campaign.status = 'active' THEN
    RAISE EXCEPTION 'Une campagne active ne peut pas echouer';
  END IF;
  IF v_campaign.status = 'rejected' THEN
    RETURN jsonb_build_object('duplicate', true, 'status', 'rejected');
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);
  UPDATE public.ad_campaigns
  SET status = 'rejected',
      moderation_status = 'rejected',
      rejection_reason = left(coalesce(p_reason, 'paiement refuse'), 200),
      updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object('duplicate', false, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.fail_ad_campaign(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_ad_campaign(uuid, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Gestion par l annonceur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pause_ad_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.advertiser_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;
  IF v_campaign.status <> 'active' THEN
    RAISE EXCEPTION 'Seule une campagne active peut etre mise en pause';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);
  UPDATE public.ad_campaigns SET status = 'paused', updated_at = now() WHERE id = v_campaign.id;
  RETURN jsonb_build_object('status', 'paused');
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_ad_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;
  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.advertiser_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;
  IF v_campaign.status <> 'paused' THEN
    RAISE EXCEPTION 'Seule une campagne en pause peut etre reprise';
  END IF;
  IF v_campaign.spent >= v_campaign.budget THEN
    RAISE EXCEPTION 'Le budget de cette campagne est epuise';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);
  UPDATE public.ad_campaigns SET status = 'active', updated_at = now() WHERE id = v_campaign.id;
  RETURN jsonb_build_object('status', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.pause_ad_campaign(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resume_ad_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_ad_campaign(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_ad_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_ad_campaign(
  p_campaign_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF NOT (public.is_platform_admin() OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Reserve a la moderation Afrixa';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision de moderation invalide';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);
  UPDATE public.ad_campaigns
  SET moderation_status = p_decision,
      status = CASE
        WHEN p_decision = 'rejected' THEN 'rejected'
        WHEN v_campaign.paid_at IS NOT NULL AND v_campaign.status IN ('pending', 'paused') THEN 'active'
        ELSE status
      END,
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN left(coalesce(p_reason, 'refusee'), 200) END,
      updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object('moderation_status', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.review_ad_campaign(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_ad_campaign(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Diffusion et mesure
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_feed_ad()
RETURNS TABLE (
  campaign_id uuid,
  advertiser_name text,
  title text,
  description text,
  media_url text,
  cta_text text,
  cta_url text,
  cpc integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    campaign.id,
    campaign.advertiser_name,
    campaign.title,
    campaign.description,
    campaign.media_url,
    coalesce(campaign.cta_text, 'Découvrir'),
    campaign.cta_url,
    campaign.cpc
  FROM public.ad_campaigns AS campaign
  WHERE campaign.status = 'active'
    AND campaign.moderation_status = 'approved'
    AND campaign.advertiser_id IS DISTINCT FROM v_user
    AND campaign.spent < campaign.budget
    AND (campaign.starts_at IS NULL OR campaign.starts_at <= now())
    AND (campaign.ends_at IS NULL OR campaign.ends_at > now())
    AND NOT EXISTS (
      SELECT 1
      FROM public.ad_impressions AS seen
      WHERE seen.campaign_id = campaign.id
        AND seen.user_id = v_user
        AND seen.created_at > now() - make_interval(secs =>
          (SELECT impression_cooldown_seconds FROM public.ad_pricing WHERE id = 1)
        )
    )
    AND (
      coalesce(array_length(campaign.target_interests, 1), 0) = 0
      OR EXISTS (
        SELECT 1
        FROM public.user_interests AS interest
        WHERE interest.user_id = v_user
          AND interest.categories && campaign.target_interests
      )
    )
  ORDER BY random()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_feed_ad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feed_ad() TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ad_impression(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.ad_campaigns%ROWTYPE;
  v_impression_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.status <> 'active' OR v_campaign.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'Campagne inactive';
  END IF;
  IF v_campaign.advertiser_id = v_user THEN
    RAISE EXCEPTION 'Impossible de voir sa propre publicite';
  END IF;
  IF v_campaign.spent >= v_campaign.budget THEN
    RAISE EXCEPTION 'Budget de campagne epuise';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ad_impressions AS seen
    WHERE seen.campaign_id = p_campaign_id
      AND seen.user_id = v_user
      AND seen.created_at > now() - make_interval(secs =>
        (SELECT impression_cooldown_seconds FROM public.ad_pricing WHERE id = 1)
      )
  ) THEN
    RETURN jsonb_build_object('duplicate', true);
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);

  INSERT INTO public.ad_impressions (campaign_id, user_id, clicked)
  VALUES (p_campaign_id, v_user, false)
  RETURNING id INTO v_impression_id;

  UPDATE public.ad_campaigns
  SET impressions = impressions + 1, updated_at = now()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('duplicate', false, 'impression_id', v_impression_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_impression(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ad_impression(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ad_click(p_impression_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_impression public.ad_impressions%ROWTYPE;
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT * INTO v_impression FROM public.ad_impressions WHERE id = p_impression_id FOR UPDATE;
  IF NOT FOUND OR v_impression.user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Impression publicitaire introuvable';
  END IF;
  IF v_impression.clicked THEN
    RAISE EXCEPTION 'Ce clic a deja ete enregistre';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = v_impression.campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.status <> 'active' THEN
    RAISE EXCEPTION 'Campagne inactive';
  END IF;
  IF v_campaign.spent + v_campaign.cpc > v_campaign.budget THEN
    RAISE EXCEPTION 'Budget de campagne epuise';
  END IF;

  PERFORM set_config('afrixa.ads_writer', 'on', true);

  UPDATE public.ad_impressions SET clicked = true WHERE id = v_impression.id;

  UPDATE public.ad_campaigns
  SET clicks = clicks + 1,
      spent = spent + cpc,
      status = CASE WHEN spent + cpc >= budget THEN 'completed' ELSE status END,
      updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object(
    'charged_fcfa', v_campaign.cpc,
    'spent_fcfa', v_campaign.spent + v_campaign.cpc,
    'budget_fcfa', v_campaign.budget,
    'cta_url', v_campaign.cta_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_click(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ad_click(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Tableau de bord annonceur
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_ad_campaigns()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  media_url text,
  cta_text text,
  cta_url text,
  budget integer,
  spent integer,
  cpc integer,
  impressions integer,
  clicks integer,
  status text,
  moderation_status text,
  rejection_reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  RETURN QUERY
  SELECT
    campaign.id,
    campaign.title,
    campaign.description,
    campaign.media_url,
    campaign.cta_text,
    campaign.cta_url,
    campaign.budget,
    campaign.spent,
    campaign.cpc,
    campaign.impressions,
    campaign.clicks,
    campaign.status,
    campaign.moderation_status,
    campaign.rejection_reason,
    campaign.starts_at,
    campaign.ends_at,
    campaign.created_at
  FROM public.ad_campaigns AS campaign
  WHERE campaign.advertiser_id = auth.uid()
  ORDER BY campaign.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ad_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ad_campaigns() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_ad_campaign_stats(
  p_campaign_id uuid,
  p_days integer DEFAULT 14
)
RETURNS TABLE (
  day date,
  impressions bigint,
  clicks bigint,
  spend_fcfa bigint,
  ctr numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.ad_campaigns%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT * INTO v_campaign FROM public.ad_campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR (v_campaign.advertiser_id IS DISTINCT FROM auth.uid() AND NOT public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Campagne introuvable';
  END IF;

  RETURN QUERY
  SELECT
    impression.created_at::date AS day,
    count(*)::bigint AS impressions,
    count(*) FILTER (WHERE impression.clicked)::bigint AS clicks,
    (count(*) FILTER (WHERE impression.clicked) * v_campaign.cpc)::bigint AS spend_fcfa,
    CASE WHEN count(*) = 0 THEN 0
      ELSE round((count(*) FILTER (WHERE impression.clicked))::numeric * 100 / count(*), 2)
    END AS ctr
  FROM public.ad_impressions AS impression
  WHERE impression.campaign_id = p_campaign_id
    AND impression.created_at >= current_date - greatest(coalesce(p_days, 14), 1)
  GROUP BY impression.created_at::date
  ORDER BY day DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_ad_campaign_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ad_campaign_stats(uuid, integer) TO authenticated;

COMMENT ON TABLE public.ad_campaigns IS
  'Campagnes Afrixa Ads : budget paye, ciblage, diffusion et compteurs mesures cote serveur.';
COMMENT ON FUNCTION public.get_feed_ad() IS
  'Selectionne une publicite active, ciblee, dans son budget et non vue recemment par le spectateur.';
COMMENT ON FUNCTION public.record_ad_click(uuid) IS
  'Enregistre un clic unique et debite le CPC du budget de campagne.';
