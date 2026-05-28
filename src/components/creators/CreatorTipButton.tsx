/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { HandHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { formatFCFA } from '@/lib/creatorFormatters';

type CreatorTipButtonProps = {
  creatorId: string;
  videoId?: string;
  compact?: boolean;
};

const tipAmounts = [100, 250, 500, 1000, 2000];
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const CreatorTipButton = ({ creatorId, videoId, compact = false }: CreatorTipButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(500);
  const [loading, setLoading] = useState(false);

  const sendTip = async () => {
    if (!user?.id) {
      toast({ title: 'Connexion requise', description: 'Connecte-toi pour soutenir un createur.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const creatorAmount = Math.round(selectedAmount * 0.8);
      if (!isUuid(creatorId) || (videoId && !isUuid(videoId))) {
        toast({
          title: 'Pourboire envoye',
          description: `${formatFCFA(creatorAmount)} simules en mode demonstration.`,
        });
        setOpen(false);
        return;
      }
      const { error } = await (supabase as any).from('creator_earnings').insert({
        user_id: creatorId,
        video_id: videoId || null,
        type: 'tip_received',
        amount: creatorAmount,
        status: 'confirmed',
      });
      if (error) throw error;
      toast({
        title: 'Pourboire envoye',
        description: `${formatFCFA(creatorAmount)} seront verses au createur apres commission Afrixa.`,
      });
      setOpen(false);
    } catch (error) {
      toast({ title: 'Erreur', description: "Le pourboire n'a pas pu etre enregistre.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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
            <DialogTitle>Soutenir ce createur</DialogTitle>
            <DialogDescription>80% du montant revient au createur, 20% a Afrixa.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {tipAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                  selectedAmount === amount
                    ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    : 'border-white/10 bg-white/5 text-white'
                }`}
              >
                {formatFCFA(amount)}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" disabled={loading} onClick={sendTip}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
