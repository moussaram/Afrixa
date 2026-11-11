import { supabase } from '@/integrations/supabase/client';

/**
 * Retourne l'identifiant de la conversation 1:1 avec `otherUserId`,
 * en la créant si nécessaire. Les participants sont stockés dans un ordre
 * stable pour éviter les doublons.
 */
export const getOrCreateConversation = async (
  userId: string,
  otherUserId: string,
): Promise<string | null> => {
  if (!userId || !otherUserId || userId === otherUserId) return null;

  const [first, second] = [userId, otherUserId].sort();

  const { data: existing, error: readError } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(participant_1.eq.${first},participant_2.eq.${second}),and(participant_1.eq.${second},participant_2.eq.${first})`,
    )
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ participant_1: first, participant_2: second })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return created.id;
};
