-- Afrixa account verification: identity and business/store applications.
-- Sensitive documents stay in a private Storage bucket. Only the applicant can
-- read their own files; review and badge changes are server-side (service_role).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_profile_verification_badges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user <> 'service_role'
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND (
       (TG_OP = 'INSERT' AND (
         NEW.identity_verified IS DISTINCT FROM false
         OR NEW.business_verified IS DISTINCT FROM false
         OR NEW.verified_at IS NOT NULL
       ))
       OR
       (TG_OP = 'UPDATE' AND (
         NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
         OR NEW.business_verified IS DISTINCT FROM OLD.business_verified
         OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       ))
     ) THEN
    RAISE EXCEPTION 'Les badges de vérification sont attribués uniquement par Afrixa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_verification_badges ON public.profiles;
CREATE TRIGGER protect_profile_verification_badges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_verification_badges();

CREATE TABLE IF NOT EXISTS public.account_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('identity', 'business')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'cancelled')),
  applicant_name text NOT NULL,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  document_paths jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(document_paths) = 'array' AND jsonb_array_length(document_paths) BETWEEN 1 AND 6),
  business_name text,
  business_registration_number text,
  business_description text,
  website_url text,
  fee_amount_fcfa integer NOT NULL CHECK (fee_amount_fcfa >= 0),
  fee_currency text NOT NULL DEFAULT 'XOF' CHECK (fee_currency = 'XOF'),
  payment_status text NOT NULL DEFAULT 'not_configured'
    CHECK (payment_status IN ('not_configured', 'pending', 'paid', 'refunded', 'waived')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_business_fields_required CHECK (
    request_type <> 'business'
    OR (business_name IS NOT NULL AND length(btrim(business_name)) BETWEEN 2 AND 160)
  ),
  CONSTRAINT verification_review_consistency CHECK (
    (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)
    OR status NOT IN ('approved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS account_verification_user_created_idx
  ON public.account_verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS account_verification_review_queue_idx
  ON public.account_verification_requests(status, submitted_at ASC)
  WHERE status IN ('pending', 'in_review');

CREATE UNIQUE INDEX IF NOT EXISTS account_verification_one_active_request_idx
  ON public.account_verification_requests(user_id, request_type)
  WHERE status IN ('pending', 'in_review');

CREATE OR REPLACE FUNCTION public.validate_account_verification_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $
BEGIN
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.document_paths) AS item
    WHERE coalesce(item ->> 'path', '') NOT LIKE NEW.user_id::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Chaque justificatif doit appartenir au dossier privé du demandeur';
  END IF;
  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.validate_account_verification_documents() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_account_verification_documents ON public.account_verification_requests;
CREATE TRIGGER validate_account_verification_documents
  BEFORE INSERT ON public.account_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_verification_documents();

ALTER TABLE public.account_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicants can read their verification requests"
  ON public.account_verification_requests;
CREATE POLICY "Applicants can read their verification requests"
  ON public.account_verification_requests
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Applicants can submit their own verification requests"
  ON public.account_verification_requests;
CREATE POLICY "Applicants can submit their own verification requests"
  ON public.account_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND status = 'pending'
    AND reviewer_id IS NULL
    AND reviewed_at IS NULL
    AND reviewer_note IS NULL
    AND rejection_reason IS NULL
    AND payment_status = 'not_configured'
    AND fee_amount_fcfa = CASE request_type
      WHEN 'identity' THEN 1500
      WHEN 'business' THEN 5000
      ELSE -1
    END
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.user_id = (select auth.uid())
        AND (
          (request_type = 'identity' AND profile.identity_verified = true)
          OR (request_type = 'business' AND profile.business_verified = true)
        )
    )
  );

REVOKE ALL ON public.account_verification_requests FROM PUBLIC, anon;
REVOKE UPDATE, DELETE ON public.account_verification_requests FROM authenticated;
GRANT SELECT, INSERT ON public.account_verification_requests TO authenticated;
GRANT ALL ON public.account_verification_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.account_verification_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.account_verification_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status text,
  new_status text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.account_verification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_verification_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_verification_events TO service_role;

CREATE OR REPLACE FUNCTION public.audit_account_verification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
BEGIN
  BEGIN
    v_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor := NULL;
  END;

  INSERT INTO public.account_verification_events (
    request_id, actor_id, old_status, new_status, note
  ) VALUES (
    NEW.id, v_actor,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
    NEW.status,
    CASE WHEN TG_OP = 'INSERT' THEN 'Demande soumise' ELSE NEW.reviewer_note END
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_account_verification_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_account_verification_request ON public.account_verification_requests;
CREATE TRIGGER audit_account_verification_request
  AFTER INSERT OR UPDATE OF status, reviewer_note, rejection_reason
  ON public.account_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_account_verification_request();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-verification-private',
  'account-verification-private',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "Applicants upload their own verification documents"
  ON storage.objects;
CREATE POLICY "Applicants upload their own verification documents"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'account-verification-private'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Applicants read their own verification documents"
  ON storage.objects;
CREATE POLICY "Applicants read their own verification documents"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'account-verification-private'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Applicants delete their own unsubmitted verification documents"
  ON storage.objects;
CREATE POLICY "Applicants delete their own verification documents"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'account-verification-private'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_verification_requests AS request
      WHERE request.user_id = (select auth.uid())
        AND request.id::text = split_part(name, '/', 2)
    )
  );

-- No public bucket and no client UPDATE policy: a submitted application and its
-- documents cannot be silently replaced after review starts. Admin operations
-- must run through trusted Edge Functions using service_role.
