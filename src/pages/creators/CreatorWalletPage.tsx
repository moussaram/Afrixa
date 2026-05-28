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

const CreatorWalletPage = () => {
  const { wallet, earnings, loading } = useCreatorEarnings();
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState('');
  const [phone, setPhone] = useState('');

  const requestWithdrawal = () => {
    if ((wallet?.balance || 0) < 5000) {
      toast({ title: 'Retrait impossible', description: 'Le minimum de retrait est de 5 000 FCFA.', variant: 'destructive' });
      return;
    }
    if (!operator || !phone) {
      toast({ title: 'Information manquante', description: "Choisis un opérateur et renseigne ton numéro.", variant: 'destructive' });
      return;
    }
    setOpen(false);
    toast({ title: 'Demande de retrait envoyée', description: 'Le transfert Mobile Money sera traité via Flutterwave.' });
  };

  return (
    <CreatorPageShell title="Portefeuille Créateur" subtitle="Gains, retraits et historique">
      {loading ? (
        <Skeleton className="h-32 rounded-2xl bg-[#2D2D4E]" />
      ) : (
        <>
          <CreatorWallet balance={wallet?.balance} pending={wallet?.pending} totalEarned={wallet?.total_earned} />
          <Button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] sm:w-auto" onClick={() => setOpen(true)}>
            Retirer mes gains
          </Button>
          <VirtualGifts />
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
            <DialogDescription>Minimum de retrait : 5 000 FCFA.</DialogDescription>
          </DialogHeader>
          <Select value={operator} onValueChange={setOperator}>
            <SelectTrigger><SelectValue placeholder="Opérateur Mobile Money" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Orange Money">Orange Money</SelectItem>
              <SelectItem value="Wave">Wave</SelectItem>
              <SelectItem value="MTN">MTN</SelectItem>
              <SelectItem value="Moov">Moov</SelectItem>
            </SelectContent>
          </Select>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Numéro de retrait" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" onClick={requestWithdrawal}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorPageShell>
  );
};

export default CreatorWalletPage;
