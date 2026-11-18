-- Atomic, server-only review action for account verification.
CREATE OR REPLACE FUNCTION public.review_account_verification_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_note text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL,
  p_waive_fee boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.account_verification_requests%ROWTYPE;
  v_now timestamptz := now();
  v_profile_rows integer := 0;
BEGIN
  IF p_reviewer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = p_reviewer_id
  ) THEN
    RAISE EXCEPTION 'Accès administrateur requis';
  END IF;

  IF p_decision NOT IN ('in_review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Décision de vérification invalide';
  END IF;

  SELECT * INTO v_request
  FROM public.account_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demande de vérification introuvable';
  END IF;
  IF v_request.status NOT IN ('pending', 'in_review') THEN
    RAISE EXCEPTION 'Cette demande a déjà été clôturée';
  END IF;

  IF p_decision = 'approved'
     AND v_request.payment_status NOT IN ('paid', 'waived')
     AND NOT p_waive_fee THEN
    RAISE EXCEPTION 'Le paiement doit être confirmé avant approbation';
  END IF;

  IF p_decision = 'rejected'
     AND length(btrim(coalesce(p_rejection_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Un motif de refus détaillé est obligatoire';
  END IF;

  UPDATE public.account_verification_requests
  SET status = p_decision,
      payment_status = CASE
        WHEN p_decision = 'approved' AND p_waive_fee THEN 'waived'
        ELSE payment_status
      END,
      reviewer_id = p_reviewer_id,
      reviewer_note = nullif(btrim(coalesce(p_note, '')), ''),
      rejection_reason = CASE
        WHEN p_decision = 'rejected' THEN btrim(p_rejection_reason)
        ELSE NULL
      END,
      reviewed_at = CASE WHEN p_decision IN ('approved', 'rejected') THEN v_now ELSE NULL END,
      updated_at = v_now
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'approved' THEN
    IF v_request.request_type = 'identity' THEN
      UPDATE public.profiles
      SET identity_verified = true, verified_at = v_now
      WHERE user_id = v_request.user_id;
    ELSE
      UPDATE public.profiles
      SET business_verified = true, verified_at = v_now
      WHERE user_id = v_request.user_id;
    END IF;
    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;
    IF v_profile_rows = 0 THEN
      RAISE EXCEPTION 'Profil utilisateur introuvable : badge non attribué';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_request.user_id,
    CASE p_decision
      WHEN 'in_review' THEN 'Votre demande est en cours d’examen'
      WHEN 'approved' THEN 'Votre vérification Afrixa est approuvée'
      ELSE 'Votre demande de vérification a été refusée'
    END,
    CASE p_decision
      WHEN 'in_review' THEN 'L’équipe Afrixa examine vos justificatifs.'
      WHEN 'approved' THEN CASE WHEN v_request.request_type = 'identity'
        THEN 'Votre identité est vérifiée. Votre badge bleu est maintenant actif.'
        ELSE 'Votre entreprise ou boutique est vérifiée. Votre badge est maintenant actif.'
      END
      ELSE coalesce(nullif(btrim(p_rejection_reason), ''), 'Consultez votre demande pour plus de détails.')
    END,
    'verification'
  );

  RETURN jsonb_build_object(
    'id', v_request.id,
    'user_id', v_request.user_id,
    'request_type', v_request.request_type,
    'status', v_request.status,
    'payment_status', v_request.payment_status,
    'reviewed_at', v_request.reviewed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_account_verification_request(uuid, uuid, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_account_verification_request(uuid, uuid, text, text, text, boolean)
  TO service_role;
