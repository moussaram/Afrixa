import { Camera, FileText, Link as LinkIcon, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { cn } from '@/lib/utils';

interface ProfileCompletionBannerProps {
  interestsCount?: number;
}

type ProfileWithCompletion = {
  created_at?: string;
  avatar_url?: string | null;
  bio?: string | null;
  website_url?: string | null;
  link?: string | null;
};

export const ProfileCompletionBanner = ({ interestsCount = 0 }: ProfileCompletionBannerProps) => {
  const { profile } = useAuth();
  const completionProfile = profile as ProfileWithCompletion | null;
  const createdAt = completionProfile?.created_at ? new Date(completionProfile.created_at).getTime() : Date.now();
  const isOldEnough = Date.now() - createdAt > 3 * 24 * 60 * 60 * 1000;

  const items = [
    { label: 'Photo', done: Boolean(completionProfile?.avatar_url), icon: Camera },
    { label: 'Bio', done: Boolean(completionProfile?.bio), icon: FileText },
    { label: 'Lien', done: Boolean(completionProfile?.website_url || completionProfile?.link), icon: LinkIcon },
    { label: 'Interets', done: interestsCount > 0, icon: Sparkles },
  ];
  const progress = items.filter(item => item.done).length * 25;

  if (!completionProfile || progress === 100 || (!isOldEnough && completionProfile.avatar_url)) return null;

  return (
    <section className="mx-4 mb-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Complete ton profil pour plus de visibilite !</h2>
          <p className="mt-1 text-xs text-muted-foreground">{progress}% complete</p>
        </div>
        <div className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          {progress}%
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/70">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {items.map(item => (
          <div
            key={item.label}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px]',
              item.done ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
