/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { HandHeart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from 'sonner';
import { formatFCFA } from '@/lib/creatorFormatters';

type CreatorTipButtonProps = {
  creatorId: string;
  videoId?: string;
  compact?: boolean;
};

const TIP_AMOUNTS = [10, 50, 100, 200, 500];
const TIP_MESSAGES: Record<string, string> = {
  'Solde de coins insuffisant': 'Solde de Coins insuffisant.',
  'Impossible de se soutenir soi-meme': 'Tu ne peux pas te soutenir toi-même.',
  'Trop de pourboires envoyes, reessayez dans une minute': 'Trop de pourboires envoyés, réessaie dans une minute.',
  'Video indisponible pour un pourboire': 'Cette vidéo n’est pas disponible pour un pourboire.',
};

export const CreatorTipButton = ({ creatorId, videoId, compact = false }: CreatorTipButtonProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const openDialog = async () => {
    if (!user?.id) {
      toast.error('Connecte-toi pour soutenir ce créateur.');
      return;
    }
    if (!videoId) {
      toast.error('Cette vidéo ne peut pas recevoir de pourboire.');
      return;
    }
    if (creatorId === user.id) {
      toast.error('Tu ne peux pas te soutenir toi-même.');
      return;
    }
    setOpen(true);
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('coin_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('Unable to load coin balance', error);
      setBalance(null);
    } else {
      setBalance(data?.balance ?? 0);
    }
    setLoading(false);
  };

  const sendTip = async (coins: number) => {
    if (!videoId) return;
    setSending(true);
    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `tip:${Date.now()}`;
      const { error } = await (supabase as any).rpc('send_tip', {
        p_video_id: videoId,
        p_coins: coins,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw new Error(error.message);
      setOpen(false);
      setBalance((current) => (current === null ? current : Math.max(current - coins, 0)));
      toast.success(`Pourboire de ${coins} coins envoyé !`);
    } catch (tipError) {
      const message = tipError instanceof Error ? tipError.message : '';
      toast.error(TIP_MESSAGES[message] ?? 'Impossible d’envoyer ce pourboire.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'glass'}
        size={compact ? 'icon' : 'default'}
        title="Soutenir ce créateur"
        aria-label="Soutenir avec des Coins"
        className={compact ? 'text-foreground' : ''}
        onClick={() => void openDialog()}
      >
        <HandHeart className={compact ? 'h-6 w-6' : 'mr-2 h-4 w-4'} />
        {!compact && 'Soutenir'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soutenir ce créateur</DialogTitle>
            <DialogDescription>
              {loading
                ? 'Chargement du solde…'
                : balance === null
                  ? 'Solde indisponible.'
                  : `Solde : ${balance} coins. 1 coin reversé selon le barème Afrixa.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {TIP_AMOUNTS.map((coins) => (
              <Button
                key={coins}
                variant="outline"
                disabled={sending || balance === null || balance < coins}
                onClick={() => void sendTip(coins)}
              >
                {coins} 🪙
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatFCFA(500)} de pourboires correspondent au barème serveur. Le créateur reçoit le montant en FCFA sur son portefeuille.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="secondary" onClick={() => navigate('/coins')}>Recharger mes Coins</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
