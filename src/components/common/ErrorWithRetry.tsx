import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorWithRetryProps {
  message?: string;
  hint?: string;
  onRetry: () => void;
}

export const ErrorWithRetry = ({
  message = 'Impossible de charger les données',
  hint = 'Vérifiez votre connexion internet',
  onRetry,
}: ErrorWithRetryProps) => (
  <div className="flex flex-col items-center justify-center text-center px-8 py-12 gap-3 animate-fade-in">
    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
      <AlertTriangle className="w-7 h-7 text-destructive" />
    </div>
    <p className="text-foreground font-semibold">{message}</p>
    <p className="text-sm text-muted-foreground">{hint}</p>
    <button
      onClick={onRetry}
      className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full gradient-primary text-primary-foreground font-medium hover:scale-105 active:scale-95 transition-transform"
    >
      <RefreshCw className="w-4 h-4" />
      Réessayer
    </button>
  </div>
);
