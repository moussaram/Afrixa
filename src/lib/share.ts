/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateConversation } from './conversations';

export type ShareChannel =
  | 'internal'
  | 'link'
  | 'native'
  | 'whatsapp'
  | 'facebook'
  | 'messenger'
  | 'twitter'
  | 'telegram'
  | 'other';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getAfrixaUrl = (path: string) => `${window.location.origin}${path}`;

export const getVideoShareUrl = (videoId: string) => getAfrixaUrl(`/video/${videoId}`);

export const shareTargets = (url: string, text: string) => ({
  whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  facebook: `https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
});

export const copyShareLink = async (url: string) => {
  await navigator.clipboard.writeText(url);
};

export const nativeShare = async (title: string, text: string, url: string) => {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return true;
  }
  await copyShareLink(url);
  return false;
};

/**
 * Enregistre un partage. Sans enregistrement serveur, `videos.shares_count`
 * et les statistiques du créateur restent faux.
 */
export const recordVideoShare = async (
  videoId: string,
  channel: ShareChannel,
  recipientId?: string,
): Promise<void> => {
  // Les identifiants de démonstration ne correspondent à aucune ligne en base.
  if (!uuidPattern.test(videoId)) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await (supabase as any).from('video_shares').insert({
    video_id: videoId,
    user_id: user.id,
    channel,
    recipient_id: recipientId ?? null,
  });
  if (error) throw error;
};

/**
 * Partage interne : envoie la vidéo dans la messagerie Afrixa puis enregistre
 * le partage. Retourne l'identifiant de la conversation.
 */
export const shareVideoToAfrixaUser = async (input: {
  videoId: string;
  recipientId: string;
  authorUsername: string;
  description: string;
}): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connexion requise pour partager');

  const conversationId = await getOrCreateConversation(user.id, input.recipientId);
  if (!conversationId) throw new Error('Conversation indisponible');

  const url = getVideoShareUrl(input.videoId);
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    type: 'video',
    content: `Regarde cette vidéo de @${input.authorUsername} sur Afrixa${input.description ? ` : ${input.description.slice(0, 120)}` : ''}`,
    media_url: url,
  });
  if (error) throw error;

  await recordVideoShare(input.videoId, 'internal', input.recipientId);
  return conversationId;
};
