-- Afrixa identity verification (level 2)
-- Dedicated paid 12-month review subscription. This migration is intentionally
-- committed to Git only; apply it to the confirmed Afrixa Supabase project
-- after staging validation and reviewer provisioning.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_until timestamptz;

CREATE OR REPLACE FUNCTION public.guard_identity_verified_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.identity_verified := false;
      NEW.identity_verified_until := NULL;
    ELSIF NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
      OR NEW.identity_verified_until IS DISTINCT FROM OLD.identity_verified_until THEN
      RAISE EXCEPTION 'Le statut d’identité vérifiée est géré exclusivement par Afrixa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_identity_verified_profile_fields ON public.profiles;
CREATE TRIGGER guard_identity_verified_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_identity_verified_profile_fields();

CREATE TABLE IF NOT EXISTS public.identity_verification_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  amount_xof integer NOT NULL CHECK (amount_xof > 0),
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 730),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.identity_verification_plans (id, name, amount_xof, duration_days, active)
VALUES ('identity-annual', 'Identité vérifiée - 12 mois', 2000, 365, true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    amount_xof = EXCLUDED.amount_xof,
    duration_days = EXCLUDED.duration_days,
    active = EXCLUDED.active,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.identity_verification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.identity_verification_plans(id),
  amount_xof integer NOT NULL CHECK (amount_xof > 0),
  currency text NOT NULL DEFAULT 'XOF' CHECK (currency = 'XOF'),
  status text NOT NULL DEFAULT 'payment_pending'
    CHECK (status IN ('payment_pending', 'active', 'expired', 'cancelled', 'refunded')),
  fedapay_transaction_id text UNIQUE,
  fedapay_reference text UNIQUE,
  starts_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'active' AND starts_at IS NOT NULL AND expires_at IS NOT NULL AND paid_at IS NOT NULL)
    OR status <> 'active'
  )
);

CREATE INDEX IF NOT EXISTS identity_verification_subscriptions_user_idx
  ON public.identity_verification_subscriptions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS identity_verification_one_pending_subscription_per_user
  ON public.identity_verification_subscriptions(user_id)
  WHERE status = 'payment_pending';
CREATE INDEX IF NOT EXISTS identity_verification_subscriptions_expiry_idx
  ON public.identity_verification_subscriptions(expires_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.identity_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.identity_verification_subscriptions(id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'needs_information', 'approved', 'rejected', 'revoked')),
  legal_name text NOT NULL CHECK (char_length(btrim(legal_name)) BETWEEN 3 AND 160),
  document_type text NOT NULL
    CHECK (document_type IN ('national_id', 'passport', 'residence_permit')),
  issuing_country text NOT NULL CHECK (issuing_country ~ '^[A-Z]{2}$'),
  document_path text NOT NULL,
  document_paths text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(document_paths) <= 3),
  applicant_note text CHECK (applicant_note IS NULL OR char_length(applicant_note) <= 1000),
  decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) <= 1000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS identity_verification_requests_queue_idx
  ON public.identity_verification_requests(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS identity_verification_requests_user_idx
  ON public.identity_verification_requests(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS identity_verification_one_open_request_per_user
  ON public.identity_verification_requests(user_id)
  WHERE status IN ('submitted', 'under_review', 'needs_information');

CREATE TABLE IF NOT EXISTS public.identity_verification_reviewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer', 'supervisor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.identity_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.identity_verification_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('assigned', 'needs_information', 'approved', 'rejected', 'revoked', 'document_viewed')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  internal_note text CHECK (internal_note IS NULL OR char_length(internal_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_verification_reviews_request_idx
  ON public.identity_verification_reviews(request_id, created_at DESC);

ALTER TABLE public.identity_verification_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_plans_public_read ON public.identity_verification_plans;
CREATE POLICY identity_plans_public_read ON public.identity_verification_plans
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS identity_subscriptions_owner_read ON public.identity_verification_subscriptions;
CREATE POLICY identity_subscriptions_owner_read ON public.identity_verification_subscriptions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS identity_requests_owner_read ON public.identity_verification_requests;
CREATE POLICY identity_requests_owner_read ON public.identity_verification_requests
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS identity_reviewers_self_read ON public.identity_verification_reviewers;
CREATE POLICY identity_reviewers_self_read ON public.identity_verification_reviewers
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id AND active = true);

GRANT SELECT ON public.identity_verification_plans TO anon, authenticated;
GRANT SELECT ON public.identity_verification_subscriptions TO authenticated;
GRANT SELECT ON public.identity_verification_requests TO authenticated;
GRANT SELECT ON public.identity_verification_reviewers TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.identity_verification_plans,
  public.identity_verification_subscriptions,
  public.identity_verification_requests,
  public.identity_verification_reviewers,
  public.identity_verification_reviews
FROM PUBLIC, anon, authenticated;
GRANT ALL ON
  public.identity_verification_plans,
  public.identity_verification_subscriptions,
  public.identity_verification_requests,
  public.identity_verification_reviewers,
  public.identity_verification_reviews
TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-verification-documents',
  'identity-verification-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

DROP POLICY IF EXISTS identity_documents_owner_upload ON storage.objects;
CREATE POLICY identity_documents_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'identity-verification-documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS identity_documents_owner_read ON storage.objects;
CREATE POLICY identity_documents_owner_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'identity-verification-documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS identity_documents_owner_delete ON storage.objects;
CREATE POLICY identity_documents_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'identity-verification-documents'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

COMMENT ON TABLE public.identity_verification_requests IS
  'Demandes volontaires de vérification d’identité niveau 2. Les justificatifs résident dans un bucket privé.';
COMMENT ON TABLE public.identity_verification_reviewers IS
  'Liste blanche des agents Afrixa habilités à examiner les justificatifs d’identité.';
COMMENT ON COLUMN public.profiles.identity_verified IS
  'Statut attribué exclusivement par le serveur après approbation et abonnement actif.';

-- Atomic reviewer decision: request state, badge, audit entry and notification
-- commit together. Only the trusted Edge Function service role may execute it.
CREATE OR REPLACE FUNCTION public.apply_identity_verification_decision(
  p_request_id uuid,
  p_decision text,
  p_reason text,
  p_internal_note text,
  p_reviewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.identity_verification_requests%ROWTYPE;
  v_reviewer public.identity_verification_reviewers%ROWTYPE;
  v_expiry timestamptz;
BEGIN
  SELECT * INTO v_reviewer
  FROM public.identity_verification_reviewers
  WHERE user_id = p_reviewer_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Examinateur non habilité';
  END IF;
  IF p_decision NOT IN ('under_review', 'needs_information', 'approved', 'rejected', 'revoked') THEN
    RAISE EXCEPTION 'Décision invalide';
  END IF;
  IF p_decision = 'revoked' AND v_reviewer.role <> 'supervisor' THEN
    RAISE EXCEPTION 'Révocation réservée au superviseur';
  END IF;
  IF p_decision IN ('needs_information', 'rejected', 'revoked')
    AND length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Motif obligatoire';
  END IF;

  SELECT * INTO v_request
  FROM public.identity_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_request.status IN ('approved', 'rejected', 'revoked')
    AND NOT (p_decision = 'revoked' AND v_request.status = 'approved') THEN
    RAISE EXCEPTION 'Demande déjà clôturée';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT expires_at INTO v_expiry
    FROM public.identity_verification_subscriptions
    WHERE id = v_request.subscription_id
      AND user_id = v_request.user_id
      AND status = 'active'
      AND expires_at > now();
    IF v_expiry IS NULL THEN RAISE EXCEPTION 'Abonnement expiré'; END IF;
  END IF;

  UPDATE public.identity_verification_requests
  SET status = p_decision,
      decision_reason = nullif(left(btrim(coalesce(p_reason, '')), 1000), ''),
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      updated_at = now()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    UPDATE public.profiles
    SET identity_verified = true,
        identity_verified_until = v_expiry,
        updated_at = now()
    WHERE user_id = v_request.user_id;
  ELSIF p_decision IN ('rejected', 'revoked') THEN
    UPDATE public.profiles
    SET identity_verified = false,
        identity_verified_until = NULL,
        updated_at = now()
    WHERE user_id = v_request.user_id;
  END IF;

  INSERT INTO public.identity_verification_reviews (
    request_id, reviewer_id, action, reason, internal_note
  ) VALUES (
    p_request_id, p_reviewer_id, p_decision,
    nullif(left(btrim(coalesce(p_reason, '')), 1000), ''),
    nullif(left(btrim(coalesce(p_internal_note, '')), 2000), '')
  );

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_request.user_id,
    'Vérification d’identité Afrixa',
    CASE p_decision
      WHEN 'approved' THEN 'Ton identité a été vérifiée. Le badge bleu est maintenant actif sur ton profil.'
      WHEN 'needs_information' THEN 'Des informations complémentaires sont nécessaires pour terminer ta vérification.'
      WHEN 'rejected' THEN 'Ta demande de vérification d’identité n’a pas été approuvée.'
      WHEN 'revoked' THEN 'La vérification de ton identité a été retirée.'
      ELSE 'Ton dossier de vérification est pris en charge par l’équipe Afrixa.'
    END,
    'verification'
  );

  RETURN jsonb_build_object('request_id', p_request_id, 'status', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_identity_verification_decision(uuid, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_identity_verification_decision(uuid, text, text, text, uuid)
  TO service_role;
