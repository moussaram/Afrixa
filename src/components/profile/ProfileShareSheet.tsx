import { useState } from 'react';
import { X, Copy, Check, Send, QrCode, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfileShareSheetProps {
  open: boolean;
  onClose: () => void;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

const shareOptions = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: 'bg-green-500',
    getUrl: (url: string, text: string) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    color: 'bg-blue-600',
    getUrl: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'messenger',
    label: 'Messenger',
    icon: '⚡',
    color: 'bg-blue-500',
    getUrl: (url: string) => `fb-messenger://share?link=${encodeURIComponent(url)}`,
  },
  {
    id: 'twitter',
    label: 'X',
    icon: '🐦',
    color: 'bg-black',
    getUrl: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: 'bg-sky-500',
    getUrl: (url: string, text: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'sms',
    label: 'SMS',
    icon: '📱',
    color: 'bg-emerald-500',
    getUrl: (url: string, text: string) => `sms:?body=${encodeURIComponent(text + ' ' + url)}`,
  },
];

export const ProfileShareSheet = ({ open, onClose, username, displayName, avatarUrl }: ProfileShareSheetProps) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const profileUrl = `https://afrixa.app/@${username}`;
  const shareText = `Découvre le profil de ${displayName} (@${username}) sur Afrixa !`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = profileUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `@${username} sur Afrixa`, text: shareText, url: profileUrl });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('Partage natif impossible', error);
      }
    } else {
      handleCopy();
    }
  };

  const handlePlatformShare = (opt: typeof shareOptions[0]) => {
    window.open(opt.getUrl(profileUrl, shareText), '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-card rounded-t-3xl z-10 pb-safe animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="font-semibold text-foreground text-lg">Partager le profil</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Profile preview card */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/30">
            <img
              src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face'}
              alt={username}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground">@{username}</p>
            </div>
            <QrCode className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>

        {/* Share platforms */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-6 gap-3">
            {shareOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => handlePlatformShare(opt)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform group-active:scale-90",
                  opt.color
                )}>
                  {opt.icon}
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Copy link */}
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5 min-w-0">
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground/70 truncate">{profileUrl}</span>
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0",
              copied ? "bg-green-500 text-white" : "gradient-primary text-primary-foreground"
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Native share */}
        <div className="px-4 pb-6">
          <button
            onClick={handleNativeShare}
            className="w-full py-3 rounded-2xl bg-muted/40 text-foreground font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Plus d'options de partage…
          </button>
        </div>
      </div>
    </div>
  );
};
