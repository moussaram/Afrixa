import { useState } from 'react';
import { X, ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdCardProps {
  className?: string;
}

const mockAds = [
  {
    id: 'ad1',
    brand: 'Dangote Group',
    logo: 'https://i.pravatar.cc/40?img=50',
    title: 'Investissez dans l\'avenir de l\'Afrique',
    description: 'Rejoignez des milliers d\'investisseurs sur notre plateforme.',
    cta: 'En savoir plus',
    thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=700&fit=crop',
    tag: 'Finance',
  },
  {
    id: 'ad2',
    brand: 'Kano Fashion',
    logo: 'https://i.pravatar.cc/40?img=51',
    title: 'Tenues Traditionnelles Haoussa',
    description: 'Livraison dans tout le Nigeria et la diaspora.',
    cta: 'Découvrir',
    thumbnail: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&h=700&fit=crop',
    tag: 'Mode',
  },
];

const AdCard = ({ className }: AdCardProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [adIndex] = useState(() => Math.floor(Math.random() * mockAds.length));
  const ad = mockAds[adIndex];

  if (dismissed) return null;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      {/* Background */}
      <img loading="lazy"
        src={ad.thumbnail}
        alt={ad.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

      {/* Sponsored badge */}
      <div className="absolute top-16 left-4 flex items-center gap-1.5 glass rounded-full px-3 py-1 border border-border/30">
        <Zap className="w-3 h-3 text-primary" />
        <span className="text-xs font-semibold text-foreground">Sponsorisé</span>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-16 right-4 w-8 h-8 rounded-full glass border border-border/30 flex items-center justify-center"
      >
        <X className="w-4 h-4 text-foreground" />
      </button>

      {/* Content */}
      <div className="absolute bottom-24 left-0 right-0 px-4 space-y-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img loading="lazy" src={ad.logo} alt={ad.brand} className="w-8 h-8 rounded-full border-2 border-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">{ad.brand}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">{ad.tag}</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-foreground leading-tight">{ad.title}</h3>
        <p className="text-sm text-foreground/80">{ad.description}</p>

        <button className="flex items-center gap-2 gradient-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm">
          {ad.cta}
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export { AdCard };
