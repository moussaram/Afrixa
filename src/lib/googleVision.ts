import { supabase } from '@/integrations/supabase/client';

export type ImageModerationResult = {
  status: 'approved' | 'review' | 'blocked';
  categories: Record<'adult' | 'violence' | 'racy' | 'medical', string>;
};

export async function moderateImage(file: File): Promise<ImageModerationResult> {
  if (!file.type.startsWith('image/')) throw new Error('Sélectionnez un fichier image');
  if (file.size > 5 * 1024 * 1024) throw new Error('L’image doit faire 5 Mo maximum pour la vérification');

  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture de l’image impossible'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const separator = dataUrl.indexOf(',');
      if (separator < 0) reject(new Error('Format d’image illisible'));
      else resolve(dataUrl.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });

  const { data, error } = await supabase.functions.invoke('moderate-image', { body: { imageBase64 } });
  if (error) throw new Error('Vérification de l’image indisponible. Réessayez plus tard.');
  if (!data || !['approved', 'review', 'blocked'].includes(data.status)) {
    throw new Error('La vérification de l’image a échoué');
  }
  return data as ImageModerationResult;
}
