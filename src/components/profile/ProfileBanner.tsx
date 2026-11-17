import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Image as ImageIcon, Trash2, Loader2, MoveHorizontal, MoveVertical } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX_BANNER_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_POSITION = '50% 50%';

interface ProfileBannerProps {
  imageUrl: string | null;
  position?: string | null;
  onEdit?: () => void;
}

export const ProfileBanner = ({ imageUrl, position, onEdit }: ProfileBannerProps) => (
  <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-[#171044] via-[#312078] to-[#087eaa] sm:h-52">
    {imageUrl ? (
      <img src={imageUrl} alt="Bannière du profil" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position || DEFAULT_POSITION }} />
    ) : (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(115,82,255,0.55),transparent_45%),radial-gradient(ellipse_at_85%_85%,rgba(0,196,255,0.28),transparent_42%)]" />
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute -right-2 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute bottom-4 left-5 text-xs font-semibold tracking-[0.28em] text-white/55">AFRIXA</div>
      </>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
    {onEdit && (
      <Button type="button" size="sm" variant="secondary" className="absolute bottom-3 right-3 gap-2 border border-white/20 bg-black/45 text-white backdrop-blur-md hover:bg-black/65" onClick={onEdit}>
        <ImagePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Modifier la bannière</span>
        <span className="sm:hidden">Bannière</span>
      </Button>
    )}
  </div>
);

interface ProfileBannerEditorProps {
  userId: string;
  imageUrl: string | null;
  imagePath: string | null;
  position?: string | null;
  onSaved: () => Promise<void> | void;
}

export const ProfileBannerEditor = ({ userId, imageUrl, imagePath, position, onSaved }: ProfileBannerEditorProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const match = (position || DEFAULT_POSITION).match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    setHorizontal(match ? Number(match[1]) : 50);
    setVertical(match ? Number(match[2]) : 50);
    setFile(null);
    setPreviewUrl(null);
  }, [open, position]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = async (selected: File | undefined) => {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error('Format non accepté. Choisis une image JPG, PNG ou WebP.');
      return;
    }
    if (selected.size > MAX_BANNER_SIZE) {
      toast.error('La bannière ne doit pas dépasser 5 Mo.');
      return;
    }
    const objectUrl = URL.createObjectURL(selected);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Image illisible'));
        image.src = objectUrl;
      });
      if (dimensions.width < 600 || dimensions.height < 180) {
        URL.revokeObjectURL(objectUrl);
        toast.error('Choisis une image d’au moins 600 × 180 pixels.');
        return;
      }
      setFile(selected);
      setPreviewUrl(objectUrl);
    } catch {
      URL.revokeObjectURL(objectUrl);
      toast.error('Impossible de lire cette image.');
    }
  };

  const removePreviousFile = async (path: string | null) => {
    if (!path || !path.startsWith(`${userId}/`)) return;
    const { error } = await supabase.storage.from('profile-banners').remove([path]);
    if (error) console.warn('Ancienne bannière non supprimée du stockage', error);
  };

  const save = async () => {
    if (!file || !userId) return;
    setSaving(true);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const newPath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('profile-banners').upload(newPath, file, {
        cacheControl: '3600', contentType: file.type, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('profile-banners').getPublicUrl(newPath);
      const { error: updateError } = await supabase.from('profiles').update({
        banner_url: publicData.publicUrl,
        banner_path: newPath,
        banner_position: `${horizontal}% ${vertical}%`,
      }).eq('user_id', userId);
      if (updateError) {
        await supabase.storage.from('profile-banners').remove([newPath]);
        throw updateError;
      }
      await removePreviousFile(imagePath);
      await onSaved();
      toast.success('Bannière du profil mise à jour.');
      setOpen(false);
    } catch (error) {
      console.error('Unable to save profile banner', error);
      toast.error('Impossible d’enregistrer la bannière. Réessaie.');
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async () => {
    if (!imageUrl && !imagePath) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        banner_url: null, banner_path: null, banner_position: DEFAULT_POSITION,
      }).eq('user_id', userId);
      if (error) throw error;
      await removePreviousFile(imagePath);
      await onSaved();
      toast.success('Bannière supprimée.');
      setOpen(false);
    } catch (error) {
      console.error('Unable to remove profile banner', error);
      toast.error('Impossible de supprimer la bannière.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ProfileBanner imageUrl={imageUrl} position={position} onEdit={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Personnaliser ma bannière</DialogTitle>
            <DialogDescription>Choisis une image, ajuste son cadrage puis enregistre. JPG, PNG ou WebP, 5 Mo maximum.</DialogDescription>
          </DialogHeader>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
            void chooseFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }} />
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
            {previewUrl ? (
              <img src={previewUrl} alt="Aperçu de la nouvelle bannière" className="h-36 w-full object-cover sm:h-48" style={{ objectPosition: `${horizontal}% ${vertical}%` }} />
            ) : imageUrl ? (
              <img src={imageUrl} alt="Bannière actuelle" className="h-36 w-full object-cover sm:h-48" style={{ objectPosition: `${horizontal}% ${vertical}%` }} />
            ) : (
              <div className="flex h-36 items-center justify-center bg-gradient-to-br from-[#171044] via-[#312078] to-[#087eaa] text-sm text-white/75 sm:h-48">
                <ImageIcon className="mr-2 h-5 w-5" /> Aperçu de la bannière Afrixa
              </div>
            )}
          </div>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {file ? 'Choisir une autre image' : imageUrl ? 'Remplacer la bannière' : 'Choisir dans la galerie'}
          </Button>
          {(file || imageUrl) && (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <p className="text-sm font-medium">Ajuster le cadrage</p>
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                <MoveHorizontal className="h-4 w-4 shrink-0" /><span className="w-16 shrink-0">Horizontal</span>
                <input aria-label="Position horizontale de la bannière" type="range" min="0" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} className="min-w-0 flex-1 accent-primary" />
              </label>
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                <MoveVertical className="h-4 w-4 shrink-0" /><span className="w-16 shrink-0">Vertical</span>
                <input aria-label="Position verticale de la bannière" type="range" min="0" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} className="min-w-0 flex-1 accent-primary" />
              </label>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {imageUrl && <Button type="button" variant="destructive" onClick={removeBanner} disabled={saving} className="mr-auto gap-2"><Trash2 className="h-4 w-4" /> Supprimer</Button>}
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuler</Button>
            <Button type="button" variant="gradient" onClick={save} disabled={!file || saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
