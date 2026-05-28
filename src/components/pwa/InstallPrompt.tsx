import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visits] = useState(() => Number(localStorage.getItem('afrixa:pwa-visits') || 0));

  useEffect(() => {
    localStorage.setItem('afrixa:pwa-visits', String(visits + 1));
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [visits]);

  if (!event || visits < 3) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-border bg-card p-4 shadow-xl">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Installer Afrixa</p>
          <p className="text-xs text-muted-foreground">Ajoute l'app sur ton ecran d'accueil.</p>
        </div>
        <Button size="sm" onClick={() => event.prompt()}>
          Installer
        </Button>
      </div>
    </div>
  );
};
