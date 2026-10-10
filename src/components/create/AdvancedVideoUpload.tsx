import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { getVideoMetadata } from '@/lib/videoCompressor';
import { sanitizeText } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { createCloudflareUpload, refreshCloudflareVideoStatus, removeFailedCloudflareUpload, uploadVideoWithTus } from '@/lib/cloudflare/streamUpload';

type UploadStep = 'select' | 'edit' | 'publish' | 'upload';

const steps: UploadStep[] = ['select', 'edit', 'publish', 'upload'];

export const AdvancedVideoUpload = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [metadata, setMetadata] = useState<{ duration: number; resolution: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
      if (uploaded) { navigate('/'); return; }
      if (!file) return;
      setUploading(true);
      let session: Awaited<ReturnType<typeof createCloudflareUpload>> | null = null;
      let transferComplete = false;
      try {
        session = await createCloudflareUpload({
          file,
          duration: metadata?.duration ?? 0,
          title: sanitizeText(title),
          description: sanitizeText(description),
          privacy,
        });
        setStatusMessage('Envoi de la vidéo vers Cloudflare Stream…');
        await uploadVideoWithTus(file, session.uploadUrl, setProgress);
        transferComplete = true;
        setProgress(100);
        setUploaded(true);
        setStatusMessage('Vidéo reçue. Traitement et modération en cours…');

        let streamStatus: 'processing' | 'ready' | 'error' = 'processing';
        for (let attempt = 0; attempt < 20 && streamStatus === 'processing'; attempt += 1) {
          streamStatus = await refreshCloudflareVideoStatus(session.videoId);
          if (streamStatus === 'processing') {
            await new Promise(resolve => window.setTimeout(resolve, 3000));
          }
        }
        if (streamStatus === 'ready') {
          setStatusMessage('Vidéo traitée et en attente de modération avant publication.');
          toast.success('Vidéo envoyée à Cloudflare Stream.');
        } else if (streamStatus === 'error') {
          setStatusMessage('Cloudflare a signalé une erreur de traitement. La vidéo reste privée.');
          toast.error('Cloudflare n’a pas pu traiter cette vidéo.');
        } else {
          setStatusMessage('La vidéo est reçue et continue son traitement. Elle restera privée jusqu’à la modération.');
          toast.success('Vidéo reçue, traitement en cours.');
        }
      } catch (error) {
        console.error('Cloudflare Stream video upload failed', error);
        if (session && !transferComplete) {
          try { await removeFailedCloudflareUpload(session.videoId); }
          catch (cleanupError) { console.error('Could not remove the failed Cloudflare upload', cleanupError); }
        }
        if (transferComplete) {
          setUploaded(true);
          setProgress(100);
          setStatusMessage('Transfert reçu, mais le statut Cloudflare n’a pas pu être confirmé. La vidéo reste privée.');
        } else {
          toast.error(error instanceof Error ? error.message : 'Échec de l’upload vidéo. Réessayez.');
          setStatusMessage('Échec de l’upload. Vous pouvez réessayer.');
        }
      } finally {
        setUploading(false);
      }
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
            {metadata && <p className="text-xs text-muted-foreground">{Math.round(metadata.duration)}s | {metadata.resolution}</p>}
            <p className="text-xs text-muted-foreground">Cloudflare Stream optimisera la vidéo pour sa diffusion après l’envoi.</p>
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
            <p className="text-xs text-muted-foreground">La vidéo sera conservée en privé jusqu’à la fin du traitement et de la modération.</p>
          </div>
        )}

        {step === 'upload' && (
          <div className="rounded-3xl bg-card p-6 text-center">
            {uploaded ? <Check className="mx-auto mb-4 h-10 w-10 text-primary" /> : <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />}
            <h2 className="text-lg font-black">{uploaded ? 'Vidéo envoyée' : 'Upload Cloudflare Stream'}</h2>
            <Progress value={progress} className="mt-5 h-3" />
            <p className="mt-3 text-sm text-muted-foreground">{progress}%</p>
            {statusMessage && <p className="mt-3 text-sm text-muted-foreground">{statusMessage}</p>}
          </div>
        )}

        <Button onClick={next} disabled={uploading} className="mt-6 h-14 w-full rounded-2xl text-base font-black">
          {step === 'upload' ? uploading ? 'Envoi en cours…' : uploaded ? 'Terminer' : 'Envoyer la vidéo' : 'Continuer'}
        </Button>
      </div>
    </section>
  );
};
