import { useMemo, useState } from 'react';
import { Check, Film, Image, Loader2, Music, PackagePlus, Shield, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { compressVideo, getVideoMetadata } from '@/lib/videoCompressor';
import { sanitizeText } from '@/lib/validation';
import { cn } from '@/lib/utils';

type UploadStep = 'select' | 'edit' | 'publish' | 'upload';

const steps: UploadStep[] = ['select', 'edit', 'publish', 'upload'];

export const AdvancedVideoUpload = () => {
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [options, setOptions] = useState({ duet: true, stitch: true, download: true, exclusive: false });
  const [metadata, setMetadata] = useState<{ duration: number; resolution: string } | null>(null);

  const stepIndex = steps.indexOf(step);
  const canContinue = useMemo(() => {
    if (step === 'select') return Boolean(file);
    if (step === 'publish') return sanitizeText(title).length > 0;
    return true;
  }, [file, step, title]);

  const chooseFile = async (selected?: File) => {
    if (!selected) return;
    if (!['video/mp4', 'video/quicktime'].includes(selected.type)) {
      toast.error('Formats acceptes: MP4 ou MOV');
      return;
    }
    if (selected.size > 500 * 1024 * 1024) {
      toast.error('Taille maximale: 500MB');
      return;
    }
    const info = await getVideoMetadata(selected);
    if (info.duration < 15 || info.duration > 600) {
      toast.error('Duree acceptee: 15 secondes a 10 minutes');
      return;
    }
    setFile(selected);
    setMetadata(info);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const next = async () => {
    if (!canContinue) {
      toast.error(step === 'publish' ? 'Ajoute un titre' : 'Selectionne une video');
      return;
    }
    if (step === 'upload') {
      if (!file) return;
      const compressed = await compressVideo(file, setProgress);
      console.info('Video prete pour Supabase Storage', {
        title: sanitizeText(title),
        description: sanitizeText(description),
        privacy,
        options,
        metadata,
        compressedSize: compressed.size,
      });
      toast.success('Video compressee et prete a publier');
      return;
    }
    setStep(steps[stepIndex + 1]);
  };

  return (
    <section className="min-h-screen bg-background px-4 pb-8 pt-6 text-foreground">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black">Upload video</h1>
          <span className="text-xs font-bold text-muted-foreground">{stepIndex + 1}/4</span>
        </div>
        <Progress value={((stepIndex + 1) / 4) * 100} className="mb-6 h-2" />

        {step === 'select' && (
          <label className="flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-primary/40 bg-card p-6 text-center">
            <Upload className="mb-5 h-12 w-12 text-primary" />
            <span className="text-lg font-black">Importer depuis la galerie</span>
            <span className="mt-2 text-sm text-muted-foreground">MP4/MOV, 15 sec a 10 min, max 500MB</span>
            <input className="hidden" type="file" accept="video/mp4,video/quicktime" onChange={e => chooseFile(e.target.files?.[0])} />
            {file && <span className="mt-4 text-sm font-bold text-primary">{file.name}</span>}
          </label>
        )}

        {step === 'edit' && (
          <div className="space-y-4">
            {previewUrl && <video src={previewUrl} controls className="aspect-[9/16] w-full rounded-3xl bg-black object-cover" />}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2"><Film className="h-4 w-4" /> Rogner</Button>
              <Button variant="outline" className="gap-2"><Image className="h-4 w-4" /> Miniature</Button>
              <Button variant="outline" className="gap-2"><Music className="h-4 w-4" /> Son</Button>
              <Button variant="outline" className="gap-2"><PackagePlus className="h-4 w-4" /> Produits</Button>
            </div>
            {metadata && <p className="text-xs text-muted-foreground">{Math.round(metadata.duration)}s | {metadata.resolution}</p>}
          </div>
        )}

        {step === 'publish' && (
          <div className="space-y-4">
            <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Titre de la video" />
            <Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2200} placeholder="Description, hashtags, contexte..." />
            <div className="grid grid-cols-3 gap-2">
              {(['public', 'followers', 'private'] as const).map(item => (
                <button key={item} onClick={() => setPrivacy(item)} className={cn('rounded-2xl border p-3 text-xs font-bold', privacy === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card')}>
                  {item === 'public' ? 'Tous' : item === 'followers' ? 'Abonnes' : 'Prive'}
                </button>
              ))}
            </div>
            {Object.entries({ duet: 'Duet', stitch: 'Stitch', download: 'Download', exclusive: 'Fan Club' }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl bg-card p-4">
                <span className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4" /> {label}</span>
                <Switch checked={options[key as keyof typeof options]} onCheckedChange={checked => setOptions(current => ({ ...current, [key]: checked }))} />
              </div>
            ))}
          </div>
        )}

        {step === 'upload' && (
          <div className="rounded-3xl bg-card p-6 text-center">
            {progress < 100 ? <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" /> : <Check className="mx-auto mb-4 h-10 w-10 text-primary" />}
            <h2 className="text-lg font-black">Compression et upload</h2>
            <Progress value={progress} className="mt-5 h-3" />
            <p className="mt-3 text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        <Button onClick={next} className="mt-6 h-14 w-full rounded-2xl text-base font-black">
          {step === 'upload' ? 'Publier' : 'Continuer'}
        </Button>
      </div>
    </section>
  );
};
