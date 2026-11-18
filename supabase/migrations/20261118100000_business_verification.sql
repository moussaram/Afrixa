-- Afrixa business / shop verification (level 3).
-- Apply on confirmed staging only. Never run against production before schema review.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_verified_until timestamptz,
  ADD COLUMN IF NOT EXISTS business_verification_type text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_business_verification_type_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_business_verification_type_check
      CHECK (business_verification_type IS NULL OR business_verification_type IN ('company', 'shop'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_business_verified_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.business_verified := false;
      NEW.business_verified_until := NULL;
      NEW.business_verification_type := NULL;
    ELSIF NEW.business_verified IS DISTINCT FROM OLD.business_verified
      OR NEW.business_verified_until IS DISTINCT FROM OLD.business_verified_until
      OR NEW.business_verification_type IS DISTINCT FROM OLD.business_verification_type THEN
      RAISE EXCEPTION 'Le statut entreprise/boutique vérifiée est géré exclusivement par Afrixa';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_business_verified_profile_fields ON public.profiles;
CREATE TRIGGER guard_business_verified_profile_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_verified_profile_fields();

CREATE TABLE IF NOT EXISTS public.business_verification_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  amount_xof integer NOT NULL CHECK (amount_xof > 0),
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 730),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.business_verification_plans(id,name,amount_xof,duration_days,active)
VALUES ('business-annual','Entreprise / boutique vérifiée · 12 mois',5000,365,true)
ON CONFLICT (id) DO UPDATE SET name=excluded.name,amount_xof=excluded.amount_xof,duration_days=excluded.duration_days,active=excluded.active;

CREATE TABLE IF NOT EXISTS public.business_verification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.business_verification_plans(id),
  amount_xof integer NOT NULL CHECK (amount_xof > 0),
  currency text NOT NULL DEFAULT 'XOF' CHECK(currency='XOF'),
  status text NOT NULL DEFAULT 'payment_pending'
    CHECK(status IN ('payment_pending','active','expired','cancelled','refunded')),
  fedapay_transaction_id text UNIQUE,
  fedapay_reference text UNIQUE,
  starts_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_verification_subscriptions_user_idx
  ON public.business_verification_subscriptions(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS business_verification_one_pending_idx
  ON public.business_verification_subscriptions(user_id) WHERE status='payment_pending';
CREATE UNIQUE INDEX IF NOT EXISTS business_verification_one_active_idx
  ON public.business_verification_subscriptions(user_id) WHERE status='active';

CREATE TABLE IF NOT EXISTS public.business_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.business_verification_subscriptions(id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK(status IN ('submitted','under_review','needs_information','approved','rejected','revoked')),
  entity_type text NOT NULL CHECK(entity_type IN ('company','shop')),
  legal_name text NOT NULL CHECK(char_length(btrim(legal_name)) BETWEEN 2 AND 180),
  public_name text NOT NULL CHECK(char_length(btrim(public_name)) BETWEEN 2 AND 100),
  registration_country text NOT NULL CHECK(registration_country ~ '^[A-Z]{2}$'),
  registration_number text CHECK(registration_number IS NULL OR char_length(registration_number)<=100),
  tax_number text CHECK(tax_number IS NULL OR char_length(tax_number)<=100),
  business_address text NOT NULL CHECK(char_length(btrim(business_address)) BETWEEN 5 AND 300),
  contact_phone text NOT NULL CHECK(char_length(btrim(contact_phone)) BETWEEN 6 AND 30),
  website_url text CHECK(website_url IS NULL OR char_length(website_url)<=300),
  document_paths text[] NOT NULL CHECK(cardinality(document_paths) BETWEEN 1 AND 4),
  applicant_note text CHECK(applicant_note IS NULL OR char_length(applicant_note)<=1000),
  consented_at timestamptz NOT NULL DEFAULT now(),
  consent_version text NOT NULL DEFAULT 'business-verification-v1',
  decision_reason text CHECK(decision_reason IS NULL OR char_length(decision_reason)<=1000),
  documents_delete_after timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_verification_queue_idx
  ON public.business_verification_requests(status,submitted_at);
CREATE INDEX IF NOT EXISTS business_verification_user_idx
  ON public.business_verification_requests(user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS business_verification_one_open_request_idx
  ON public.business_verification_requests(user_id)
  WHERE status IN ('submitted','under_review','needs_information');

CREATE TABLE IF NOT EXISTS public.business_verification_reviewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'reviewer' CHECK(role IN ('reviewer','supervisor')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.business_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.business_verification_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK(action IN ('document_viewed','under_review','needs_information','approved','rejected','revoked')),
  reason text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_verification_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_verification_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_plans_public_read ON public.business_verification_plans;
CREATE POLICY business_plans_public_read ON public.business_verification_plans
  FOR SELECT TO anon,authenticated USING(active=true);
DROP POLICY IF EXISTS business_subscriptions_owner_read ON public.business_verification_subscriptions;
CREATE POLICY business_subscriptions_owner_read ON public.business_verification_subscriptions
  FOR SELECT TO authenticated USING((select auth.uid())=user_id);
DROP POLICY IF EXISTS business_requests_owner_read ON public.business_verification_requests;
CREATE POLICY business_requests_owner_read ON public.business_verification_requests
  FOR SELECT TO authenticated USING((select auth.uid())=user_id);
DROP POLICY IF EXISTS business_reviewers_self_read ON public.business_verification_reviewers;
CREATE POLICY business_reviewers_self_read ON public.business_verification_reviewers
  FOR SELECT TO authenticated USING((select auth.uid())=user_id AND active=true);
GRANT SELECT ON public.business_verification_plans TO anon,authenticated;
GRANT SELECT ON public.business_verification_subscriptions,public.business_verification_requests,public.business_verification_reviewers TO authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.business_verification_plans,public.business_verification_subscriptions,
  public.business_verification_requests,public.business_verification_reviewers,public.business_verification_reviews FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.business_verification_plans,public.business_verification_subscriptions,
  public.business_verification_requests,public.business_verification_reviewers,public.business_verification_reviews TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('business-verification-documents','business-verification-documents',false,10485760,
  ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
  allowed_mime_types=ARRAY['image/jpeg','image/png','application/pdf'];
DROP POLICY IF EXISTS business_documents_owner_upload ON storage.objects;
CREATE POLICY business_documents_owner_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='business-verification-documents' AND (storage.foldername(name))[1]=(select auth.uid())::text);
DROP POLICY IF EXISTS business_documents_owner_read ON storage.objects;
CREATE POLICY business_documents_owner_read ON storage.objects FOR SELECT TO authenticated
USING(
  bucket_id='business-verification-documents'
  AND (storage.foldername(name))[1]=(select auth.uid())::text
  AND NOT EXISTS (
    SELECT 1 FROM public.business_verification_requests r
    WHERE r.user_id=(select auth.uid())
      AND r.document_paths @> ARRAY[storage.objects.name]
      AND r.documents_delete_after <= now()
  )
);

CREATE OR REPLACE FUNCTION public.apply_business_verification_decision(
  p_request_id uuid,p_decision text,p_reason text,p_internal_note text,p_reviewer_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.business_verification_requests%ROWTYPE; v public.business_verification_reviewers%ROWTYPE; expiry timestamptz;
BEGIN
  SELECT * INTO v FROM public.business_verification_reviewers WHERE user_id=p_reviewer_id AND active=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Examinateur non habilité'; END IF;
  IF p_decision NOT IN ('under_review','needs_information','approved','rejected','revoked') THEN RAISE EXCEPTION 'Décision invalide'; END IF;
  IF p_decision='revoked' AND v.role<>'supervisor' THEN RAISE EXCEPTION 'Superviseur requis'; END IF;
  IF p_decision IN ('needs_information','rejected','revoked') AND length(btrim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
  SELECT * INTO r FROM public.business_verification_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF r.status IN ('approved','rejected','revoked') AND NOT(p_decision='revoked' AND r.status='approved') THEN RAISE EXCEPTION 'Demande clôturée'; END IF;
  IF p_decision='approved' THEN
    SELECT expires_at INTO expiry FROM public.business_verification_subscriptions
    WHERE id=r.subscription_id AND user_id=r.user_id AND status='active' AND expires_at>now();
    IF expiry IS NULL THEN RAISE EXCEPTION 'Abonnement expiré'; END IF;
  END IF;
  UPDATE public.business_verification_requests SET status=p_decision,
    decision_reason=nullif(left(btrim(coalesce(p_reason,'')),1000),''),
    reviewed_at=now(),reviewed_by=p_reviewer_id,
    documents_delete_after=CASE WHEN p_decision IN ('approved','rejected','revoked') THEN now()+interval '90 days' ELSE NULL END,
    updated_at=now() WHERE id=p_request_id;
  IF p_decision='approved' THEN
    UPDATE public.profiles SET business_verified=true,business_verified_until=expiry,
      business_verification_type=r.entity_type,updated_at=now() WHERE user_id=r.user_id;
  ELSIF p_decision IN ('rejected','revoked') THEN
    UPDATE public.profiles SET business_verified=false,business_verified_until=NULL,
      business_verification_type=NULL,updated_at=now() WHERE user_id=r.user_id;
  END IF;
  INSERT INTO public.business_verification_reviews(request_id,reviewer_id,action,reason,internal_note)
  VALUES(p_request_id,p_reviewer_id,p_decision,nullif(left(btrim(coalesce(p_reason,'')),1000),''),
    nullif(left(btrim(coalesce(p_internal_note,'')),2000),''));
  INSERT INTO public.notifications(user_id,title,message,type) VALUES(r.user_id,'Vérification entreprise Afrixa',
    CASE p_decision WHEN 'approved' THEN 'Ton entreprise ou ta boutique a été vérifiée. Le badge est actif.'
      WHEN 'needs_information' THEN 'Des informations complémentaires sont nécessaires pour ta vérification commerciale.'
      WHEN 'rejected' THEN 'Ta demande de vérification commerciale n’a pas été approuvée.'
      WHEN 'revoked' THEN 'La vérification de ton entreprise ou boutique a été retirée.'
      ELSE 'Ton dossier commercial est pris en charge par l’équipe Afrixa.' END,'verification');
  RETURN jsonb_build_object('request_id',p_request_id,'status',p_decision);
END $$;
REVOKE ALL ON FUNCTION public.apply_business_verification_decision(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_business_verification_decision(uuid,text,text,text,uuid) TO service_role;
