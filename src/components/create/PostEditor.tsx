import { useState, useRef } from 'react';
import { ArrowLeft, MapPin, Globe, Users, Lock, Hash, AtSign, ChevronRight, Volume2, Eye, MessageCircle, Download, Share2, X, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PostEditorProps {
  mediaUrl: string | null;
  mediaType: 'video' | 'photo';
  selectedSound?: { title: string; artist: string } | null;
  onBack: () => void;
}

type Visibility = 'public' | 'friends' | 'private';
type Step = 'details' | 'location' | 'settings' | 'posting';

const trendingHashtags = ['#viral', '#fyp', '#trending', '#dance', '#funny', '#food', '#tech', '#beauté', '#musique', '#gaming'];

const locationSuggestions = [
  { id: '1', name: 'Paris, France', flag: '🇫🇷' },
  { id: '2', name: 'Dakar, Sénégal', flag: '🇸🇳' },
  { id: '3', name: 'Abidjan, Côte d\'Ivoire', flag: '🇨🇮' },
  { id: '4', name: 'Casablanca, Maroc', flag: '🇲🇦' },
  { id: '5', name: 'New York, USA', flag: '🇺🇸' },
  { id: '6', name: 'Londres, UK', flag: '🇬🇧' },
  { id: '7', name: 'Montréal, Canada', flag: '🇨🇦' },
  { id: '8', name: 'Douala, Cameroun', flag: '🇨🇲' },
];

export const PostEditor = ({ mediaUrl, mediaType, selectedSound, onBack }: PostEditorProps) => {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [step, setStep] = useState<Step>('details');
  
  // Description
  const [description, setDescription] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Location
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<typeof locationSuggestions[0] | null>(null);
  
  // Settings
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  
  // Cover/thumbnail
  const [coverIndex, setCoverIndex] = useState(0);
  
  const [isPosting, setIsPosting] = useState(false);

  const maxLength = 2200;
  const remaining = maxLength - description.length;

  const insertText = (text: string) => {
    const pos = textareaRef.current?.selectionStart ?? description.length;
    const before = description.slice(0, pos);
    const after = description.slice(pos);
    const newDesc = before + text + ' ' + after;
    setDescription(newDesc);
    setTimeout(() => {
      const newPos = pos + text.length + 1;
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const filteredLocations = locationSuggestions.filter(l =>
    l.name.toLowerCase().includes(locationQuery.toLowerCase())
  );

  const handlePost = async () => {
    setIsPosting(true);
    setStep('posting');
    // Simulate upload
    await new Promise(r => setTimeout(r, 2500));
    toast.success('Vidéo publiée avec succès ! 🎉');
    navigate('/');
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 py-3">
      {(['details', 'location', 'settings'] as const).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
            step === s || (step === 'posting' && i === 2)
              ? "bg-primary text-primary-foreground scale-110"
              : ['details', 'location', 'settings'].indexOf(step) > i || step === 'posting'
              ? "bg-primary/30 text-primary"
              : "bg-muted text-muted-foreground"
          )}>
            {(['details', 'location', 'settings'].indexOf(step) > i || step === 'posting') ? '✓' : i + 1}
          </div>
          {i < 2 && (
            <div className={cn(
              "w-8 h-0.5 transition-all duration-300",
              ['details', 'location', 'settings'].indexOf(step) > i || step === 'posting'
                ? "bg-primary" : "bg-muted"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  // ─── STEP: POSTING ───────────────────────────────────
  if (step === 'posting') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center gap-6 px-8">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90 animate-spin" style={{ animationDuration: '1.5s' }}>
            <circle cx="40" cy="40" r="36" stroke="hsl(var(--muted))" strokeWidth="4" fill="none" />
            <circle
              cx="40" cy="40" r="36"
              stroke="url(#postGrad)" strokeWidth="4" fill="none"
              strokeLinecap="round" strokeDasharray="226" strokeDashoffset="56"
            />
            <defs>
              <linearGradient id="postGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--secondary))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🚀</div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Publication en cours…</h2>
          <p className="text-muted-foreground text-sm">Votre contenu est en cours d'envoi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={step === 'details' ? onBack : () => {
          if (step === 'location') setStep('details');
          if (step === 'settings') setStep('location');
        }} className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-base">
            {step === 'details' && 'Détails de la publication'}
            {step === 'location' && 'Localisation'}
            {step === 'settings' && 'Paramètres'}
          </h1>
          {renderStepIndicator()}
        </div>
      </div>

      {/* ─── STEP 1: DETAILS ─────────────────────────────── */}
      {step === 'details' && (
        <div className="flex-1 overflow-y-auto">
          {/* Preview + Description */}
          <div className="flex gap-3 p-4">
            {/* Thumbnail */}
            <div className="w-20 h-28 rounded-xl bg-muted overflow-hidden flex-shrink-0 relative">
              {mediaUrl ? (
                mediaType === 'photo'
                  ? <img loading="lazy" src={mediaUrl} alt="cover" className="w-full h-full object-cover" />
                  : <video src={mediaUrl} className="w-full h-full object-cover" muted />
              ) : (
                <div className="w-full h-full gradient-primary opacity-60" />
              )}
              <div className="absolute bottom-1 left-1 right-1 bg-background/80 rounded-md text-center text-xs py-0.5 text-foreground font-medium cursor-pointer">
                Couverture
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1 flex flex-col">
              <Textarea
                ref={textareaRef}
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, maxLength))}
                placeholder="Ajoutez une description, des #hashtags ou @mentionnez quelqu'un…"
                className="flex-1 min-h-[112px] bg-transparent border-0 p-0 resize-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <span className={cn("text-xs text-right mt-1", remaining < 50 ? "text-destructive" : "text-muted-foreground")}>
                {remaining}
              </span>
            </div>
          </div>

          {/* Quick insert buttons */}
          <div className="flex gap-3 px-4 pb-3">
            <button
              onClick={() => insertText('#')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground hover:bg-muted/80 transition-colors"
            >
              <Hash className="w-3.5 h-3.5 text-primary" />
              Hashtag
            </button>
            <button
              onClick={() => insertText('@')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm text-foreground hover:bg-muted/80 transition-colors"
            >
              <AtSign className="w-3.5 h-3.5 text-primary" />
              Mention
            </button>
          </div>

          {/* Trending hashtags */}
          <div className="px-4 pb-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Hashtags tendance</p>
            <div className="flex flex-wrap gap-2">
              {trendingHashtags.map(tag => (
                <button
                  key={tag}
                  onClick={() => insertText(tag)}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Sound info */}
          {selectedSound && (
            <div className="mx-4 mb-4 flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border/50">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <Music className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{selectedSound.title}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedSound.artist}</p>
              </div>
            </div>
          )}

          {/* Next button */}
          <div className="px-4 pb-6">
            <Button onClick={() => setStep('location')} className="w-full" variant="gradient" size="lg">
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: LOCATION ────────────────────────────── */}
      {step === 'location' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Ajouter une localisation</h2>
              </div>
              
              {/* Search input */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={locationQuery}
                  onChange={e => setLocationQuery(e.target.value)}
                  placeholder="Chercher une ville, un pays…"
                  className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-primary/30"
                />
                {locationQuery && (
                  <button onClick={() => setLocationQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Selected location */}
            {selectedLocation && (
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{selectedLocation.flag}</span>
                  <span className="text-sm font-medium text-foreground">{selectedLocation.name}</span>
                </div>
                <button onClick={() => setSelectedLocation(null)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Suggestions list */}
            <div className="space-y-1">
              {!selectedLocation && (
                <button
                  onClick={() => { setSelectedLocation(null); setLocationQuery(''); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Aucune localisation</span>
                </button>
              )}
              {filteredLocations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => { setSelectedLocation(loc); setLocationQuery(''); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                    selectedLocation?.id === loc.id ? "bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-lg">
                    {loc.flag}
                  </div>
                  <span className="text-sm text-foreground">{loc.name}</span>
                  {selectedLocation?.id === loc.id && (
                    <span className="ml-auto text-primary text-xs font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-6">
            <Button onClick={() => setStep('settings')} className="w-full" variant="gradient" size="lg">
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: SETTINGS ────────────────────────────── */}
      {step === 'settings' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Visibility */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Qui peut voir cette vidéo ?</p>
              <div className="space-y-2">
                {[
                  { value: 'public' as Visibility, label: 'Tout le monde', desc: 'Visible par tous les utilisateurs', icon: Globe, color: 'text-green-500' },
                  { value: 'friends' as Visibility, label: 'Amis seulement', desc: 'Visible uniquement par vos abonnés', icon: Users, color: 'text-blue-500' },
                  { value: 'private' as Visibility, label: 'Privé', desc: 'Visible uniquement par vous', icon: Lock, color: 'text-muted-foreground' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setVisibility(opt.value)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left",
                      visibility === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", visibility === opt.value ? "bg-primary/15" : "bg-muted")}>
                      <opt.icon className={cn("w-5 h-5", visibility === opt.value ? "text-primary" : opt.color)} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center",
                      visibility === opt.value ? "border-primary bg-primary" : "border-border"
                    )}>
                      {visibility === opt.value && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactions */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Interactions autorisées</p>
              <div className="bg-card rounded-xl border border-border divide-y divide-border">
                {[
                  { label: 'Commentaires', desc: 'Permettre aux utilisateurs de commenter', icon: MessageCircle, value: allowComments, set: setAllowComments },
                  { label: 'Duo', desc: 'Permettre les vidéos en duo', icon: Share2, value: allowDuet, set: setAllowDuet },
                  { label: 'Stitch', desc: 'Permettre les vidéos stitch', icon: Eye, value: allowStitch, set: setAllowStitch },
                  { label: 'Téléchargement', desc: 'Permettre le téléchargement de la vidéo', icon: Download, value: allowDownload, set: setAllowDownload },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-4 p-4">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => item.set(!item.value)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all duration-300 relative",
                        item.value ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-5 h-5 bg-background rounded-full shadow-sm transition-all duration-300",
                        item.value ? "left-6" : "left-0.5"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-muted/40 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Résumé de publication</p>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span>Visibilité : <span className="font-medium text-primary">{visibility === 'public' ? 'Public' : visibility === 'friends' ? 'Amis' : 'Privé'}</span></span>
              </div>
              {selectedLocation && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedLocation.flag} {selectedLocation.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{selectedSound ? `${selectedSound.title} – ${selectedSound.artist}` : 'Aucun son ajouté'}</span>
              </div>
            </div>
          </div>

          <div className="px-4 pb-6 space-y-3">
            <Button onClick={handlePost} className="w-full" variant="gradient" size="lg">
              🚀 Publier maintenant
            </Button>
            <Button
              onClick={() => { toast.info('Brouillon sauvegardé'); navigate('/'); }}
              variant="outline" className="w-full" size="lg"
            >
              Sauvegarder en brouillon
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
