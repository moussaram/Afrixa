-- Support operations hardening: private evidence uploads and links to the existing marketplace dispute workflow.
-- This migration does not create, settle, refund, or release escrow funds.

ALTER TABLE public.help_messages
  ADD COLUMN IF NOT EXISTS related_dispute_id uuid
    REFERENCES public.disputes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS help_messages_related_dispute_idx
  ON public.help_messages(related_dispute_id)
  WHERE related_dispute_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_message_id uuid NOT NULL REFERENCES public.help_messages(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 180),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx
  ON public.support_attachments(help_message_id, created_at);

ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_attachments FROM anon;
GRANT SELECT, INSERT ON public.support_attachments TO authenticated;

DROP POLICY IF EXISTS "Support attachments visible to owner and admins" ON public.support_attachments;
CREATE POLICY "Support attachments visible to owner and admins"
  ON public.support_attachments FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.help_messages t
      WHERE t.id = support_attachments.help_message_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Support users attach evidence to own tickets" ON public.support_attachments;
CREATE POLICY "Support users attach evidence to own tickets"
  ON public.support_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND object_path LIKE 'support/' || (select auth.uid())::text || '/' || help_message_id::text || '/%'
    AND EXISTS (
      SELECT 1 FROM public.help_messages t
      WHERE t.id = support_attachments.help_message_id
        AND t.user_id = (select auth.uid())
    )
  );

-- Enforce the five-attachment limit atomically for registered evidence metadata.
CREATE OR REPLACE FUNCTION public.enforce_support_attachment_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.help_message_id::text, 0));
  IF (
    SELECT count(*)
    FROM public.support_attachments a
    WHERE a.help_message_id = NEW.help_message_id
  ) >= 5 THEN
    RAISE EXCEPTION 'A ticket may contain at most five attachments.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.enforce_support_attachment_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_support_attachment_limit ON public.support_attachments;
CREATE TRIGGER enforce_support_attachment_limit
  BEFORE INSERT ON public.support_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_support_attachment_limit();

-- Private bucket: only common image formats and PDF, maximum 10 MiB per object.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Support users upload evidence to own tickets" ON storage.objects;
CREATE POLICY "Support users upload evidence to own tickets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = 'support'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.help_messages t
      WHERE t.id::text = (storage.foldername(name))[3]
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Support owners and admins read evidence" ON storage.objects;
CREATE POLICY "Support owners and admins read evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (
      public.is_platform_admin()
      OR (
        (storage.foldername(name))[1] = 'support'
        AND (storage.foldername(name))[2] = (select auth.uid())::text
        AND EXISTS (
          SELECT 1 FROM public.help_messages t
          WHERE t.id::text = (storage.foldername(name))[3]
            AND t.user_id = (select auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Support owners delete own evidence" ON storage.objects;
CREATE POLICY "Support owners delete own evidence"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = 'support'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.help_messages t
      WHERE t.id::text = (storage.foldername(name))[3]
        AND t.user_id = (select auth.uid())
    )
  );

-- A ticket can only reference a dispute in which its author participates.
-- When an order is also linked, it must be the same order as the dispute.
CREATE OR REPLACE FUNCTION public.validate_support_dispute_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.related_dispute_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.disputes d
    WHERE d.id = NEW.related_dispute_id
      AND ((d.buyer_id = NEW.user_id) OR (d.seller_id = NEW.user_id))
      AND (NEW.related_order_id IS NULL OR d.order_id = NEW.related_order_id)
  ) THEN
    RAISE EXCEPTION 'Le litige lié doit appartenir au demandeur et correspondre à la commande.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_support_dispute_link() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validate_support_dispute_link ON public.help_messages;
CREATE TRIGGER validate_support_dispute_link
  BEFORE INSERT OR UPDATE OF related_dispute_id, related_order_id, user_id
  ON public.help_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_dispute_link();

COMMENT ON TABLE public.support_attachments IS
  'Métadonnées des preuves du support. Les fichiers sont conservés dans le bucket privé support-attachments.';
COMMENT ON COLUMN public.help_messages.related_dispute_id IS
  'Lien facultatif vers un litige marketplace existant; ne déclenche aucune décision financière.';
