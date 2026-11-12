import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { CreatorWallet } from '@/components/creators/CreatorWallet';
import { VirtualGifts } from '@/components/creators/VirtualGifts';
import { formatFCFA } from '@/lib/creatorFormatters';
import { useCreatorEarnings } from '@/hooks/useCreatorEarnings';
import { CreatorPageShell } from './CreatorPageShell';

const WITHDRAWAL_STATUS: Record<string, string> = {
  demande: 'En cours de validation',
  processing: 'Versement en cours',
  envoye: 'Versé',
  echec: 'Échoué',
};

const CreatorWalletPage = () => {
  const { wallet, earnings, withdrawals, settings, loading, error, requestWithdrawal } = useCreatorEarnings();
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const minimum = settings?.min_withdrawal_fcfa ?? 5000;

  const openWithdrawal = () => {
    setAmount(String(minimum));
    setOpen(true);
  };

  const submitWithdrawal = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < minimum) {
      toast({ title: 'Retrait impossible', description: `Le minimum de retrait est de ${formatFCFA(minimum)}.`, variant: 'destructive' });
      return;
    }
    if (value > (wallet?.balance ?? 0)) {
      toast({ title: 'Retrait impossible', description: 'Le montant dépasse ton solde disponible.', variant: 'destructive' });
      return;
    }
    if (!operator || phone.replace(/\D/g, '').length < 8) {
      toast({ title: 'Information manquante', description: 'Choisis un opérateur et renseigne un numéro valide.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestWithdrawal(value, operator, phone);
      setOpen(false);
      toast({
        title: result.pending ? 'Retrait enregistré' : 'Retrait envoyé',
        description: result.message ?? 'Ton versement est en cours de traitement.',
      });
    } catch (withdrawalError) {
      toast({
        title: 'Retrait impossible',
        description: withdrawalError instanceof Error ? withdrawalError.message : 'Réessaie plus tard.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CreatorPageShell title="Portefeuille Créateur" subtitle="Gains, retraits et historique">
      {loading ? (
        <Skeleton className="h-32 rounded-2xl bg-[#2D2D4E]" />
      ) : (
        <>
          <CreatorWallet balance={wallet?.balance} pending={wallet?.pending} totalEarned={wallet?.total_earned} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] sm:w-auto" onClick={openWithdrawal}>
            Retirer mes gains
          </Button>
          <p className="text-xs text-[#9CA3AF]">
            Minimum {formatFCFA(minimum)} · {settings?.withdrawal_daily_limit ?? 3} retraits par jour maximum.
          </p>

          <VirtualGifts />

          <section className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <h2 className="mb-4 font-bold text-white">Mes retraits</h2>
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">Aucun retrait demandé pour le moment.</p>
              ) : (
                withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{formatFCFA(withdrawal.amount)}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {new Date(withdrawal.created_at).toLocaleDateString('fr-FR')} · {withdrawal.operator ?? 'Mobile Money'} · {withdrawal.phone_masked}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#10B981]">
                      {WITHDRAWAL_STATUS[withdrawal.status] ?? withdrawal.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <h2 className="mb-4 font-bold text-white">Historique des gains</h2>
            <div className="space-y-3">
              {earnings.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">Aucun gain confirmé pour le moment.</p>
              ) : (
                earnings.map((earning) => (
                  <div key={earning.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{earning.type}</p>
                      <p className="text-xs text-[#9CA3AF]">{earning.status}</p>
                    </div>
                    <p className="font-bold text-[#10B981]">{formatFCFA(earning.amount)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Retirer mes gains</DialogTitle>
            <DialogDescription>
              Minimum {formatFCFA(minimum)} · disponible {formatFCFA(wallet?.balance ?? 0)}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="Montant en FCFA"
            inputMode="numeric"
          />
          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger><SelectValue placeholder="Opérateur Mobile Money" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtn_open">MTN Mobile Money</SelectItem>
              <SelectItem value="moov">Moov Money</SelectItem>
              <SelectItem value="wave_ci">Wave Côte d’Ivoire</SelectItem>
              <SelectItem value="orange_ci">Orange Money Côte d’Ivoire</SelectItem>
              <SelectItem value="wave_sn">Wave Sénégal</SelectItem>
              <SelectItem value="orange_sn">Orange Money Sénégal</SelectItem>
            </SelectContent>
          </Select>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Numéro de retrait" inputMode="tel" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" onClick={() => void submitWithdrawal()} disabled={submitting}>
              {submitting ? 'Envoi…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorPageShell>
  );
};

export default CreatorWalletPage;
