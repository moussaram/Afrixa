import { X, Link, Send, Search, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Video } from '@/types';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import {
  copyShareLink,
  getVideoShareUrl,
  nativeShare,
  recordVideoShare,
  shareVideoToAfrixaUser,
  type ShareChannel,
} from '@/lib/share';

interface SharePanelProps {
  video: Video;
  onClose: () => void;
  onShared?: () => void;
}

const shareOptions: { id: ShareChannel; label: string; icon: string; color: string; url: (url: string, title: string) => string }[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: 'bg-green-500',
    url: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '📘',
    color: 'bg-blue-600',
    url: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'messenger',
    label: 'Messenger',
    icon: '⚡',
    color: 'bg-blue-500',
    url: (url) => `fb-messenger://share?link=${encodeURIComponent(url)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    icon: '🐦',
    color: 'bg-black',
    url: (url, title) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: 'bg-sky-500',
    url: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
];

interface Contact {
  user_id: string;
  username: string | null;
  prenom: string | null;
  nom: string | null;
  avatar_url: string | null;
}

export const SharePanel = ({ video, onClose, onShared }: SharePanelProps) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const videoUrl = getVideoShareUrl(video.id);
  const shareTitle = `Regarde cette vidéo de @${video.user.username} sur Afrixa !`;

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('user_id,username,prenom,nom,avatar_url')
        .neq('user_id', user.id)
        .limit(30);
      if (active) setContacts((data ?? []) as Contact[]);
    })();
    return () => { active = false; };
  }, [user]);

  const trackShare = (channel: ShareChannel) => {
    void recordVideoShare(video.id, channel)
      .then(() => onShared?.())
      .catch((shareError) => {
        console.warn('Partage non enregistré', shareError);
      });
  };

  const handleCopyLink = async () => {
    try {
      await copyShareLink(videoUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = videoUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    trackShare('link');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      const shared = await nativeShare(shareTitle, video.description, videoUrl);
      trackShare(shared ? 'native' : 'link');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error('Partage impossible sur cet appareil.');
    }
  };

  const handleSendToContact = async (contact: Contact) => {
    setSendingTo(contact.user_id);
    try {
      await shareVideoToAfrixaUser({
        videoId: video.id,
        recipientId: contact.user_id,
        authorUsername: video.user.username,
        description: video.description,
      });
      onShared?.();
      toast.success(`Vidéo envoyée à @${contact.username ?? 'ce contact'}`);
    } catch (error) {
      console.error('Unable to share video internally', error);
      toast.error('Impossible d’envoyer la vidéo.');
    } finally {
      setSendingTo(null);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [contact.username, contact.prenom, contact.nom]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term));
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-card rounded-t-3xl flex flex-col z-10 pb-safe max-h-[85vh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h3 className="font-semibold text-foreground">Partager</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="Fermer">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
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

          {/* Envoi interne Afrixa */}
          <div className="px-4 py-4 border-b border-border/30">
            <p className="text-sm font-semibold text-foreground mb-3">Envoyer à un ami sur Afrixa</p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 mb-3">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un utilisateur…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            {!user && (
              <p className="text-xs text-muted-foreground">Connecte-toi pour envoyer la vidéo dans la messagerie.</p>
            )}

            {user && filteredContacts.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun contact disponible pour le moment.</p>
            )}

            <div className="space-y-1 max-h-52 overflow-y-auto">
              {user && filteredContacts.map((contact) => (
                <div key={contact.user_id} className="flex items-center gap-3 py-1.5">
                  {contact.avatar_url ? (
                    <img src={contact.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground">
                      {(contact.username ?? '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">@{contact.username ?? 'utilisateur'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[contact.prenom, contact.nom].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSendToContact(contact)}
                    disabled={sendingTo === contact.user_id}
                    className="px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                  >
                    {sendingTo === contact.user_id ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4">
            <div className="grid grid-cols-5 gap-4">
              {shareOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    window.open(opt.url(videoUrl, shareTitle), '_blank');
                    trackShare(opt.id);
                  }}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-transform group-active:scale-90',
                      opt.color
                    )}
                  >
                    {opt.icon}
                  </div>
                  <span className="text-xs text-muted-foreground">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5">
              <Link className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground/70 truncate">{videoUrl}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1',
                copied ? 'bg-green-500 text-white' : 'gradient-primary text-primary-foreground'
              )}
            >
              {copied && <Check className="w-4 h-4" />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

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
    </div>
  );
};
