-- Phase 1 / Privacy: enforce who_can_message and block settings at the database boundary.
-- UI checks are not security controls: both conversation creation and every
-- message send must be validated against the recipient's current preferences.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_message_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.user_id = target_user_id
      AND auth.uid() IS NOT NULL
      AND target_user_id <> auth.uid()
      AND NOT public.are_users_blocked(auth.uid(), target_user_id)
      AND (
        COALESCE(profile.who_can_message, 'everyone') = 'everyone'
        OR (
          COALESCE(profile.who_can_message, 'everyone') = 'followers'
          AND EXISTS (
            SELECT 1
            FROM public.follows AS follow_relation
            WHERE follow_relation.follower_id = auth.uid()
              AND follow_relation.following_id = target_user_id
          )
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_message_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "Créer une conversation" ON public.conversations;
CREATE POLICY "Créer une conversation"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    participant_1 <> participant_2
    AND (
      (auth.uid() = participant_1 AND public.can_message_user(participant_2))
      OR
      (auth.uid() = participant_2 AND public.can_message_user(participant_1))
    )
  );

DROP POLICY IF EXISTS "Envoyer un message" ON public.messages;
CREATE POLICY "Envoyer un message"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      WHERE conversation.id = conversation_id
        AND (
          (conversation.participant_1 = auth.uid()
            AND public.can_message_user(conversation.participant_2))
          OR
          (conversation.participant_2 = auth.uid()
            AND public.can_message_user(conversation.participant_1))
        )
    )
  );

-- Keep conversation participants immutable. Clients may only clear their own
-- unread counter; message-triggered metadata updates run as the table owner.
CREATE OR REPLACE FUNCTION public.protect_conversation_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.participant_1 IS DISTINCT FROM OLD.participant_1
    OR NEW.participant_2 IS DISTINCT FROM OLD.participant_2
    OR NEW.last_message IS DISTINCT FROM OLD.last_message
    OR NEW.last_message_at IS DISTINCT FROM OLD.last_message_at
    OR NEW.last_sender_id IS DISTINCT FROM OLD.last_sender_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Conversation identity and message metadata are server-managed';
  END IF;

  IF auth.uid() = OLD.participant_1 THEN
    IF NEW.unread_count_1 <> 0
      OR NEW.unread_count_2 IS DISTINCT FROM OLD.unread_count_2 THEN
      RAISE EXCEPTION 'A participant may only clear their own unread counter';
    END IF;
  ELSIF auth.uid() = OLD.participant_2 THEN
    IF NEW.unread_count_2 <> 0
      OR NEW.unread_count_1 IS DISTINCT FROM OLD.unread_count_1 THEN
      RAISE EXCEPTION 'A participant may only clear their own unread counter';
    END IF;
  ELSE
    RAISE EXCEPTION 'Conversation participant required';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_conversation_client_updates ON public.conversations;
CREATE TRIGGER protect_conversation_client_updates
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_client_updates();

DROP POLICY IF EXISTS "Modifier sa conversation" ON public.conversations;
CREATE POLICY "Modifier sa conversation"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2)
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- A sender may edit/delete only their own message and cannot move it to a
-- different conversation or impersonate another sender.
CREATE OR REPLACE FUNCTION public.protect_message_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message identity and conversation are immutable';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_message_identity ON public.messages;
CREATE TRIGGER protect_message_identity
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.protect_message_identity();

DROP POLICY IF EXISTS "Modifier son message" ON public.messages;
CREATE POLICY "Modifier son message"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations AS conversation
      WHERE conversation.id = messages.conversation_id
        AND (conversation.participant_1 = auth.uid() OR conversation.participant_2 = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations AS conversation
      WHERE conversation.id = messages.conversation_id
        AND (conversation.participant_1 = auth.uid() OR conversation.participant_2 = auth.uid())
    )
  );

-- Blocked users must not see one another's live presence or typing state.
DROP POLICY IF EXISTS "Présence visible par tous" ON public.user_presence;
CREATE POLICY "Présence visible hors blocage"
  ON public.user_presence
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR NOT public.are_users_blocked(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "Voir indicateur frappe" ON public.typing_indicators;
CREATE POLICY "Voir indicateur frappe"
  ON public.typing_indicators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      WHERE conversation.id = typing_indicators.conversation_id
        AND (conversation.participant_1 = auth.uid() OR conversation.participant_2 = auth.uid())
        AND NOT public.are_users_blocked(
          auth.uid(),
          CASE
            WHEN conversation.participant_1 = auth.uid() THEN conversation.participant_2
            ELSE conversation.participant_1
          END
        )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      WHERE conversation.id = typing_indicators.conversation_id
        AND (conversation.participant_1 = auth.uid() OR conversation.participant_2 = auth.uid())
        AND NOT public.are_users_blocked(
          auth.uid(),
          CASE
            WHEN conversation.participant_1 = auth.uid() THEN conversation.participant_2
            ELSE conversation.participant_1
          END
        )
    )
  );

COMMIT;
