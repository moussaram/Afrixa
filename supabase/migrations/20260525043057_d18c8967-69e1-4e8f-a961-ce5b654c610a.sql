
-- Conversations
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_sender_id UUID REFERENCES auth.users(id),
  unread_count_1 INTEGER NOT NULL DEFAULT 0,
  unread_count_2 INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir ses conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Créer une conversation" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Modifier sa conversation" ON public.conversations
  FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  product_id UUID REFERENCES public.products(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir messages de sa conversation" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );
CREATE POLICY "Envoyer un message" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );
CREATE POLICY "Modifier son message" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);

-- Typing indicators
CREATE TABLE public.typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir indicateur frappe" ON public.typing_indicators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

-- User presence
CREATE TABLE public.user_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Présence visible par tous" ON public.user_presence
  FOR SELECT USING (true);
CREATE POLICY "Modifier sa présence" ON public.user_presence
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message = NEW.content,
    last_message_at = NEW.created_at,
    last_sender_id = NEW.sender_id,
    unread_count_1 = CASE WHEN participant_1 != NEW.sender_id THEN unread_count_1 + 1 ELSE unread_count_1 END,
    unread_count_2 = CASE WHEN participant_2 != NEW.sender_id THEN unread_count_2 + 1 ELSE unread_count_2 END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Enable realtime
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
