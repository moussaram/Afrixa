import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Users, Globe, Lock, ImagePlus, ChevronRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type PrivacyOption = 'public' | 'followers' | 'private';

const privacyOptions: { value: PrivacyOption; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'public', label: 'Public', desc: 'Tout le monde peut regarder', icon: Globe },
  { value: 'followers', label: 'Abonnés', desc: 'Seulement vos abonnés', icon: Users },
  { value: 'private', label: 'Privé', desc: 'Seulement vous', icon: Lock },
];

export default function LiveSetup() {
  const navigate = useNavigate();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyOption>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleCoverPick = () => coverInputRef.current?.click();

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCoverImage(url);
    }
  };

  const handleGoLive = async () => {
    if (!title.trim()) {
      toast.error('Ajoutez un titre à votre live');
      return;
    }
    setIsLoading(true);
    // Simulate connection
    await new Promise(r => setTimeout(r, 1500));
    setIsLoading(false);
    navigate('/live/broadcast', {
      state: { title, coverImage, privacy, commentsEnabled },
    });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted transition-colors">
          <X className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1">Configurer le Live</h1>
        <div className="flex items-center gap-1.5 bg-destructive/20 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-destructive text-xs font-semibold">LIVE</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Cover + Title row */}
        <div className="flex gap-4">
          {/* Cover image picker */}
          <button
            onClick={handleCoverPick}
            className={cn(
              "w-24 h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 flex-shrink-0 transition-all",
              coverImage ? "border-primary" : "border-border/50 hover:border-primary/60"
            )}
            style={coverImage ? { backgroundImage: `url(${coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {!coverImage && (
              <>
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground text-center leading-tight">Couverture</span>
              </>
            )}
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

          {/* Title input */}
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Titre du live *</label>
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Décrivez votre live..."
              maxLength={80}
              rows={4}
              className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <span className="text-xs text-muted-foreground text-right">{title.length}/80</span>
          </div>
        </div>

        {/* Privacy */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Audience</h3>
          <div className="grid grid-cols-3 gap-2">
            {privacyOptions.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                    privacy === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border/30 bg-muted/30 hover:border-border"
                  )}
                >
                  <Icon className={cn("w-5 h-5", privacy === opt.value ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium", privacy === opt.value ? "text-primary" : "text-muted-foreground")}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground px-1">
            {privacyOptions.find(o => o.value === privacy)?.desc}
          </p>
        </div>

        {/* Settings */}
        <div className="space-y-1 rounded-xl border border-border/30 overflow-hidden">
          <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Commentaires</p>
                <p className="text-xs text-muted-foreground">Permettre au public de commenter</p>
              </div>
            </div>
            <button
              onClick={() => setCommentsEnabled(v => !v)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200",
                commentsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                  commentsEnabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold text-primary">💡 Conseils pour un bon live</h4>
          <ul className="space-y-1">
            {[
              'Bonne luminosité et connexion stable',
              'Interagissez avec votre audience',
              'Annoncez votre live à l\'avance',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Go Live button */}
      <div className="p-4 border-t border-border/30">
        <Button
          onClick={handleGoLive}
          disabled={isLoading || !title.trim()}
          className="w-full h-14 text-base font-bold gap-3 gradient-primary hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-primary/30"
        >
          {isLoading ? (
            <span className="animate-spin w-5 h-5 border-2 border-primary-foreground/50 border-t-primary-foreground rounded-full" />
          ) : (
            <Radio className="w-5 h-5" />
          )}
          {isLoading ? 'Connexion en cours...' : 'Go Live 🔴'}
        </Button>
      </div>
    </div>
  );
}
