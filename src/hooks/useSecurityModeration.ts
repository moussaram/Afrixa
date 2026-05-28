import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  blockUser,
  checkRateLimit,
  findBannedWords,
  hasActiveRestriction,
  reportContent,
  unblockUser,
  type ContentType,
  type RateLimitedAction,
} from '@/lib/security';
import { sanitizeText } from '@/lib/validation';

export const useSecurityModeration = (userId?: string) => {
  const [loading, setLoading] = useState(false);

  const guardAction = useCallback(
    async (action: RateLimitedAction, textToModerate?: string) => {
      if (!userId) return { allowed: false, content: sanitizeText(textToModerate ?? '') };

      setLoading(true);
      try {
        const restriction = await hasActiveRestriction(userId);
        if (restriction?.action_type === 'ban_permanent' || restriction?.action_type === 'ban_7days') {
          toast.error(restriction.reason || 'Compte temporairement restreint');
          return { allowed: false, content: sanitizeText(textToModerate ?? '') };
        }

        const limit = await checkRateLimit(userId, action);
        if (!limit.allowed) {
          toast.error('Trop d’actions en peu de temps. Reessayez plus tard.');
          return { allowed: false, content: sanitizeText(textToModerate ?? '') };
        }

        const content = sanitizeText(textToModerate ?? '');
        if (content) {
          const bannedWords = await findBannedWords(content);
          const highRisk = bannedWords.some(word => word.severity === 'high');
          if (highRisk) {
            toast.error('Ce contenu contient des termes interdits.');
            return { allowed: false, content };
          }
        }

        return { allowed: true, content };
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const submitReport = useCallback(
    async (contentType: ContentType, contentId: string, reason: string, description?: string) => {
      if (!userId) return false;

      setLoading(true);
      try {
        const limit = await checkRateLimit(userId, 'report');
        if (!limit.allowed) {
          toast.error('Limite de signalements atteinte.');
          return false;
        }

        await reportContent({ reporterId: userId, contentType, contentId, reason, description });
        toast.success('Signalement envoye');
        return true;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const block = useCallback(
    async (blockedId: string) => {
      if (!userId) return false;
      await blockUser(userId, blockedId);
      toast.success('Utilisateur bloque');
      return true;
    },
    [userId]
  );

  const unblock = useCallback(
    async (blockedId: string) => {
      if (!userId) return false;
      await unblockUser(userId, blockedId);
      toast.success('Utilisateur debloque');
      return true;
    },
    [userId]
  );

  return {
    loading,
    guardAction,
    submitReport,
    block,
    unblock,
  };
};
