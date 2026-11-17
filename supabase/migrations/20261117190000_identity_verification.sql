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
  IF (NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
      OR NEW.identity_verified_until IS DISTINCT FROM OLD.identity_verified_until)
     AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Le statut d’identité vérifiée est géré exclusivement par Afrixa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_identity_verified_profile_fields ON public.profiles;
CREATE TRIGGER guard_identity_verified_profile_fields
  BEFORE UPDATE ON public.profiles
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
