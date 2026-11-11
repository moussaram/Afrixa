import { HandHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CreatorTipButtonProps = {
  creatorId: string;
  videoId?: string;
  compact?: boolean;
};

/**
 * Les pourboires ne sont pas encore activés : ils dépendent du débit de coins
 * et du crédit créateur côté serveur (flux de paiement en cours d'activation).
 * Aucun revenu ne doit être enregistré depuis le navigateur.
 */
export const CreatorTipButton = ({ compact = false }: CreatorTipButtonProps) => (
  <Button
    variant={compact ? 'ghost' : 'glass'}
    size={compact ? 'icon' : 'default'}
    disabled
    title="Les pourboires seront disponibles dès l'activation des paiements"
    aria-label="Pourboires bientôt disponibles"
    className={compact ? 'text-foreground' : ''}
  >
    <HandHeart className={compact ? 'h-6 w-6' : 'mr-2 h-4 w-4'} />
    {!compact && 'Soutenir'}
  </Button>
);
