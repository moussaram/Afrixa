import { useState } from 'react';
import { HandHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type CreatorTipButtonProps = {
  creatorId: string;
  videoId?: string;
  compact?: boolean;
};

/**
 * Tips are intentionally unavailable until a real, server-verified payment
 * flow exists. This component must never manufacture creator earnings.
 */
export const CreatorTipButton = ({ compact = false }: CreatorTipButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'glass'}
        size={compact ? 'icon' : 'default'}
        onClick={() => setOpen(true)}
        className={compact ? 'text-foreground' : ''}
      >
        <HandHeart className={compact ? 'h-6 w-6' : 'mr-2 h-4 w-4'} />
        {!compact && 'Soutenir'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Pourboires temporairement indisponibles</DialogTitle>
            <DialogDescription>
              Le paiement sécurisé des pourboires n'est pas encore activé.
              Aucun montant ne sera débité et aucun revenu ne sera ajouté au
              portefeuille du créateur depuis cet écran.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
