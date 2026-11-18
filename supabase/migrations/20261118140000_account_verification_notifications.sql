-- Create in-app notifications when a verification request is submitted.
CREATE OR REPLACE FUNCTION public.notify_account_verification_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.user_id,
    'Demande de vérification reçue',
    CASE WHEN NEW.request_type = 'identity'
      THEN 'Votre demande de vérification d’identité a été transmise à l’équipe Afrixa.'
      ELSE 'Votre demande de vérification d’entreprise ou de boutique a été transmise à l’équipe Afrixa.'
    END,
    'verification'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_account_verification_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_account_verification_submission ON public.account_verification_requests;
CREATE TRIGGER notify_account_verification_submission
  AFTER INSERT ON public.account_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_account_verification_submission();
