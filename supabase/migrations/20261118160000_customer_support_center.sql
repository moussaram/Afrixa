-- Afrixa customer support: structured tickets, protected admin queue and audit trail.
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq;

ALTER TABLE public.help_messages
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS contact_email text;

UPDATE public.help_messages
SET status = CASE
  WHEN status IN ('non_lu', 'lu', 'unread', 'read') THEN 'new'
  WHEN status IN ('en_cours', 'in_progress') THEN 'in_progress'
  WHEN status IN ('resolu', 'resolved') THEN 'resolved'
  ELSE 'new'
END
WHERE status NOT IN ('new', 'in_progress', 'waiting_customer', 'resolved', 'closed');

UPDATE public.help_messages
SET subject = COALESCE(NULLIF(subject, ''), 'Demande de support'),
    topic = COALESCE(NULLIF(topic, ''), category),
    ticket_number = COALESCE(
      ticket_number,
      'AFR-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
      lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')
    );

ALTER TABLE public.help_messages
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN topic SET NOT NULL,
  ALTER COLUMN ticket_number SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE public.help_messages DROP CONSTRAINT IF EXISTS help_messages_status_check;
ALTER TABLE public.help_messages ADD CONSTRAINT help_messages_status_check
  CHECK (status IN ('new', 'in_progress', 'waiting_customer', 'resolved', 'closed'));

ALTER TABLE public.help_messages DROP CONSTRAINT IF EXISTS help_messages_priority_check;
ALTER TABLE public.help_messages ADD CONSTRAINT help_messages_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE public.help_messages DROP CONSTRAINT IF EXISTS help_messages_subject_length_check;
ALTER TABLE public.help_messages ADD CONSTRAINT help_messages_subject_length_check
  CHECK (char_length(btrim(subject)) BETWEEN 5 AND 160);

ALTER TABLE public.help_messages DROP CONSTRAINT IF EXISTS help_messages_message_length_check;
ALTER TABLE public.help_messages ADD CONSTRAINT help_messages_message_length_check
  CHECK (char_length(btrim(message)) BETWEEN 20 AND 10000);

CREATE UNIQUE INDEX IF NOT EXISTS help_messages_ticket_number_uidx
  ON public.help_messages(ticket_number);
CREATE INDEX IF NOT EXISTS help_messages_queue_idx
  ON public.help_messages(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS help_messages_user_created_idx
  ON public.help_messages(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.assign_support_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'AFR-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
      lpad(nextval('public.support_ticket_number_seq')::text, 6, '0');
  END IF;
  IF NEW.status IS NULL OR NEW.status = '' THEN NEW.status := 'new'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_support_ticket_number ON public.help_messages;
CREATE TRIGGER assign_support_ticket_number
  BEFORE INSERT ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.assign_support_ticket_number();

CREATE TABLE IF NOT EXISTS public.support_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_message_id uuid NOT NULL REFERENCES public.help_messages(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('created', 'status_changed', 'admin_replied')),
  old_status text,
  new_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_message_events_ticket_idx
  ON public.support_message_events(help_message_id, created_at DESC);

ALTER TABLE public.support_message_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Support events visible to ticket owner and admins" ON public.support_message_events;
CREATE POLICY "Support events visible to ticket owner and admins"
  ON public.support_message_events FOR SELECT
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.help_messages AS ticket
      WHERE ticket.id = support_message_events.help_message_id
        AND ticket.user_id = (select auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.log_support_message_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_message_events(help_message_id, actor_id, event_type, new_status)
    VALUES (NEW.id, v_actor, 'created', NEW.status);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.support_message_events(help_message_id, actor_id, event_type, old_status, new_status)
    VALUES (NEW.id, v_actor, 'status_changed', OLD.status, NEW.status);
  END IF;

  IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     AND NULLIF(btrim(COALESCE(NEW.admin_reply, '')), '') IS NOT NULL THEN
    INSERT INTO public.support_message_events(help_message_id, actor_id, event_type, old_status, new_status)
    VALUES (NEW.id, v_actor, 'admin_replied', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_support_message_event() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS log_support_message_event ON public.help_messages;
CREATE TRIGGER log_support_message_event
  AFTER INSERT OR UPDATE ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_support_message_event();

CREATE OR REPLACE FUNCTION public.notify_support_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     AND NULLIF(btrim(COALESCE(NEW.admin_reply, '')), '') IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_id)
    VALUES (
      NEW.user_id,
      'Réponse du support Afrixa',
      'Notre équipe a répondu à votre demande ' || NEW.ticket_number || '. Consultez votre centre de support.',
      'support',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_support_ticket_reply() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_support_ticket_reply ON public.help_messages;
CREATE TRIGGER notify_support_ticket_reply
  AFTER UPDATE OF admin_reply ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_reply();

-- Only the ticket owner can create and read their tickets. Only platform admins can read/update the queue.
DROP POLICY IF EXISTS "Utilisateur envoie ses messages d'aide" ON public.help_messages;
DROP POLICY IF EXISTS "Utilisateur voit ses messages d'aide" ON public.help_messages;
DROP POLICY IF EXISTS "Support admins read all tickets" ON public.help_messages;
DROP POLICY IF EXISTS "Support admins update tickets" ON public.help_messages;

CREATE POLICY "Support users create own tickets"
  ON public.help_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'new'
    AND admin_reply IS NULL
  );

CREATE POLICY "Support users read own tickets"
  ON public.help_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Support admins read all tickets"
  ON public.help_messages FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Support admins update tickets"
  ON public.help_messages FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

COMMENT ON TABLE public.support_message_events IS
  'Journal technique des changements de statut et réponses des tickets Afrixa; ne stocke pas le contenu des pièces justificatives.';
