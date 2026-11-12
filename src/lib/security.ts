import { supabase } from '@/integrations/supabase/client';
import { sanitizeText } from './validation';

export type RateLimitedAction =
  | 'comment'
  | 'message'
  | 'video_upload'
  | 'product_create'
  | 'follow'
  | 'report'
  | 'tip';

export type ContentType =
  | 'video'
  | 'comment'
  | 'product'
  | 'message'
  | 'profile'
  | 'user'
  | 'live'
  | 'story'
  | 'ad';

export const RATE_LIMITS: Record<RateLimitedAction, { limit: number; windowMs: number }> = {
  comment: { limit: 30, windowMs: 60 * 60 * 1000 },
  message: { limit: 100, windowMs: 60 * 60 * 1000 },
  video_upload: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
  product_create: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
  follow: { limit: 200, windowMs: 24 * 60 * 60 * 1000 },
  report: { limit: 30, windowMs: 24 * 60 * 60 * 1000 },
  tip: { limit: 60, windowMs: 60 * 60 * 1000 },
};

export const checkRateLimit = async (_userId: string, action: RateLimitedAction) => {
  const { data, error } = await supabase.functions.invoke('check-rate-limit', {
    body: { action },
  });

  if (error) throw error;
  if (typeof data?.allowed !== 'boolean' || typeof data?.remaining !== 'number') {
    throw new Error('Réponse invalide du service de limitation');
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining,
    limit: typeof data.limit === 'number' ? data.limit : RATE_LIMITS[action].limit,
  };
};

export const findBannedWords = async (text: string) => {
  const cleanText = sanitizeText(text).toLowerCase();
  if (!cleanText) return [];

  const { data, error } = await supabase
    .from('banned_words')
    .select('word,severity,language');

  if (error) throw error;

  return (data ?? []).filter(item => {
    const escaped = item.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(cleanText);
  });
};

export const reportContent = async (payload: {
  reporterId?: string;
  contentType: ContentType;
  contentId: string;
  reason: string;
  description?: string;
}) => {
  // La fonction serveur verifie le contenu, identifie l auteur, bloque les
  // doublons et declenche l auto-masquage ; le client n ecrit plus la table.
  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: { report_id?: string; status?: string; auto_hidden?: boolean } | null;
      error: { message: string } | null;
    }>;
  }).rpc('submit_report', {
    p_content_type: payload.contentType,
    p_content_id: payload.contentId,
    p_reason: sanitizeText(payload.reason),
    p_description: payload.description ? sanitizeText(payload.description) : null,
  });

  if (error) throw error;
  return data;
};

export const blockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });

  if (error) throw error;
};

export const unblockUser = async (blockerId: string, blockedId: string) => {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) throw error;
};

export const hasActiveRestriction = async (userId: string) => {
  const { data, error } = await supabase
    .from('moderation_actions')
    .select('action_type,reason,expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};
