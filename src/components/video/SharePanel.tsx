import { X, Link, MessageCircle, Facebook, Twitter, Send } from 'lucide-react';
import { useState } from 'react';
import { Video } from '@/types';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';

interface SharePanelProps {
  video: Video;
  onClose: () => void;
}

const shareOptions = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: 'bg-green-500',
    action: (url: string, title: string) =>
      window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, '_blank'),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    color: 'bg-blue-600',
    action: (url: string) =>
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank'),
  },
  {
    id: 'messenger',
    label: 'Messenger',
    icon: '⚡',
    color: 'bg-blue-500',
    action: (url: string) =>
      window.open(`fb-messenger://share?link=${encodeURIComponent(url)}`, '_blank'),
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    icon: '🐦',
    color: 'bg-black',
    action: (url: string, title: string) =>
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank'),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: 'bg-sky-500',
    action: (url: string, title: string) =>
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank'),
  },
];

export const SharePanel = ({ video, onClose }: SharePanelProps) => {
  const [copied, setCopied] = useState(false);

  // Generate deep link
  const videoUrl = `${window.location.origin}/video/${video.id}`;
  const shareTitle = `Regarde cette vidéo de @${video.user.username} sur Afrixa !`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const el = document.createElement('textarea');
      el.value = videoUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: video.description,
          url: videoUrl,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('Partage natif impossible', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-card rounded-t-3xl flex flex-col z-10 pb-safe">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="font-semibold text-foreground">Partager</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Video preview */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <img
            src={video.thumbnailUrl}
            alt={video.description}
            className="w-14 h-20 object-cover rounded-lg flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground line-clamp-2">{video.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              @{video.user.username} · {formatNumber(video.views)} vues
            </p>
          </div>
        </div>

        {/* Share platforms grid */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-5 gap-4">
            {shareOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => opt.action(videoUrl, shareTitle)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform group-active:scale-90",
                  opt.color
                )}>
                  {opt.icon}
                </div>
                <span className="text-xs text-muted-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Link section */}
        <div className="px-4 pb-4 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
            <Link className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground/70 truncate">{videoUrl}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
              copied
                ? "bg-green-500 text-white"
                : "gradient-primary text-primary-foreground"
            )}
          >
            {copied ? '✓ Copié !' : 'Copier'}
          </button>
        </div>

        {/* Native share button */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <div className="px-4 pb-4">
            <button
              onClick={handleNativeShare}
              className="w-full py-3 rounded-2xl bg-muted/50 text-foreground font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Partager via…
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
