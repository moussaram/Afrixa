import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  fetchFeedAd,
  recordAdClick,
  recordAdImpression,
  type FeedAd,
} from '@/lib/ads';
import { useAuth } from '@/contexts/useAuth';

interface AdCardProps {
  className?: string;
}

export const AdCard = ({ className }: AdCardProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);
  const [ad, setAd] = useState<FeedAd | null>(null);
  const [impressionId, setImpressionId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [clicking, setClicking] = useState(false);

  // La publicite n est demandee qu une fois la carte reellement visible.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!visible || requestedRef.current) return;
      requestedRef.current = true;
      void (async () => {
        const served = await fetchFeedAd();
        if (!served) return;
        setAd(served);
        if (!user?.id) return;
        const impression = await recordAdImpression(served.campaign_id);
        setImpressionId(impression);
      })();
    }, { threshold: [0.5] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [user?.id]);

  const handleClick = useCallback(async () => {
    if (!ad) return;
    if (!user?.id) {
      toast.error('Connecte-toi pour ouvrir cette publicité.');
      return;
    }
    if (!impressionId) {
      toast.error('Cette publicité n’est plus disponible.');
      return;
    }
    setClicking(true);
    try {
      const result = await recordAdClick(impressionId);
      window.open(result.cta_url || ad.cta_url, '_blank', 'noopener,noreferrer');
    } catch (clickError) {
      console.error('Unable to record ad click', clickError);
      toast.error('Impossible d’ouvrir cette publicité.');
    } finally {
      setClicking(false);
    }
  }, [ad, impressionId, user?.id]);

  if (dismissed || !ad) {
    return <div ref={containerRef} className={cn('h-full w-full', className)} aria-hidden="true" />;
  }

  return (
    <div ref={containerRef} className={cn('relative h-full w-full overflow-hidden bg-background', className)}>
      <img
        loading="lazy"
        src={ad.media_url}
        alt={ad.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      <div className="absolute top-16 left-4 flex items-center gap-1.5 glass rounded-full px-3 py-1 border border-border/30">
        <Zap className="w-3 h-3 text-primary" />
        <span className="text-xs font-semibold text-foreground">Sponsorisé</span>
      </div>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Masquer la publicité"
        className="absolute top-16 right-4 w-8 h-8 rounded-full glass border border-border/30 flex items-center justify-center"
      >
        <X className="w-4 h-4 text-foreground" />
      </button>

      <div className="absolute bottom-24 left-0 right-0 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            {ad.advertiser_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{ad.advertiser_name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Afrixa Ads</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-foreground leading-tight">{ad.title}</h3>
        {ad.description && <p className="text-sm text-foreground/80">{ad.description}</p>}

        <button
          onClick={() => void handleClick()}
          disabled={clicking}
          className="flex items-center gap-2 gradient-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60"
        >
          {ad.cta_text}
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
