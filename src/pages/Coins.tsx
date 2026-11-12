import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Gem, Gift, History, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { useCoins } from '@/hooks/useCoins';
import { COIN_OPERATORS, createCoinCheckout } from '@/lib/coins';
import { formatFCFA } from '@/lib/creatorFormatters';

const OPERATOR_LABELS: Record<string, string> = {
  fedapay: 'Choisir sur FedaPay',
  mtn_open: 'MTN Mobile Money',
  moov: 'Moov Money',
  sbin: 'UBA / SBIN',
  wave_ci: 'Wave Côte d’Ivoire',
  orange_ci: 'Orange Money Côte d’Ivoire',
  wave_sn: 'Wave Sénégal',
  orange_sn: 'Orange Money Sénégal',
};

const PURCHASE_STATUS: Record<string, string> = {
  pending: 'En attente de paiement',
  processing: 'Paiement en cours',
  completed: 'Crédité',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

const transactionLabel = (type: string) => {
  switch (type) {
    case 'purchased': return 'Achat de coins';
    case 'sent_gift': return 'Cadeau envoyé';
    case 'received_gift': return 'Cadeau reçu';
    case 'sent_tip': return 'Pourboire envoyé';
    case 'received_tip': return 'Pourboire reçu';
    case 'withdrawn': return 'Retrait';
    case 'refunded': return 'Remboursement';
    default: return type;
  }
};

const Coins = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallet, packs, gifts, purchases, transactions, loading, error, refresh } = useCoins();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState<string>('fedapay');
  const [submitting, setSubmitting] = useState(false);

  const activePack = packs.find((pack) => pack.id === selectedPack) ?? null;

  // Retour de FedaPay : la confirmation arrive par webhook, on rafraichit.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const openCheckout = useCallback((packId: string) => {
    if (!user?.id) {
      toast.error('Connecte-toi pour acheter des Coins.');
      navigate('/auth/login');
      return;
    }
    setSelectedPack(packId);
  }, [navigate, user?.id]);

  const handleBuy = async () => {
    if (!activePack) return;
    if (phone.replace(/\D/g, '').length < 8) {
      toast.error('Renseigne un numéro Mobile Money valide.');
      return;
    }
    setSubmitting(true);
    try {
      const { checkoutUrl } = await createCoinCheckout(activePack.id, phone, operator);
      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : '';
      toast.error(
        message === 'payment_unavailable' || message === 'checkout_creation_failed'
          ? 'Le paiement est momentanément indisponible.'
          : 'Impossible d’ouvrir le paiement FedaPay.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-8">
      <h1 className="text-2xl font-black">Afrixa Coins</h1>

      <section className="mt-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 border border-primary/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" /> Mon solde
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-32" />
        ) : (
          <p className="mt-2 text-3xl font-black">{wallet.balance.toLocaleString('fr-FR')} coins</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {wallet.lifetime_spent.toLocaleString('fr-FR')} coins dépensés au total
        </p>
        {!user?.id && (
          <Button size="sm" className="mt-4" onClick={() => navigate('/auth/login')}>
            Se connecter
          </Button>
        )}
      </section>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      <h2 className="mt-8 text-lg font-black">Recharger</h2>
      <section className="mt-3 grid grid-cols-2 gap-3">
        {loading && packs.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))
          : packs.map((pack) => (
            <article key={pack.id} className="rounded-2xl border border-border bg-card p-4">
              <Gem className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-black">{pack.name}</h3>
              <p className="text-xl font-black">{pack.coins.toLocaleString('fr-FR')} coins</p>
              <p className="text-xs text-muted-foreground">
                {pack.price_fcfa.toLocaleString('fr-FR')} FCFA
                {pack.bonus_percent > 0 ? ` · +${pack.bonus_percent}% bonus` : ''}
              </p>
              <Button size="sm" className="mt-3 w-full" onClick={() => openCheckout(pack.id)}>
                Acheter
              </Button>
            </article>
          ))}
      </section>

      <h2 className="mt-8 text-lg font-black">Cadeaux virtuels</h2>
      <section className="mt-3 space-y-2">
        {gifts.map((gift) => (
          <div key={gift.id} className="flex items-center justify-between rounded-2xl bg-card p-4">
            <span className="flex items-center gap-2 font-bold">
              <span className="text-xl">{gift.emoji || '🎁'}</span> {gift.name}
            </span>
            <span className="text-right text-sm">
              <span className="block font-semibold text-primary">{gift.price_coins} coins</span>
              <span className="block text-xs text-muted-foreground">{formatFCFA(gift.fcfa_value)} au créateur</span>
            </span>
          </div>
        ))}
      </section>

      {user?.id && (
        <>
          <h2 className="mt-8 flex items-center gap-2 text-lg font-black">
            <History className="h-5 w-5" /> Mes achats
          </h2>
          <section className="mt-3 space-y-2">
            {purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun achat pour le moment.</p>
            ) : purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between rounded-2xl bg-card p-4">
                <div>
                  <p className="font-bold">{purchase.coins_amount.toLocaleString('fr-FR')} coins</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(purchase.created_at).toLocaleDateString('fr-FR')} · {PURCHASE_STATUS[purchase.status] ?? purchase.status}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatFCFA(purchase.fcfa_paid)}</p>
              </div>
            ))}
          </section>

          <h2 className="mt-8 flex items-center gap-2 text-lg font-black">
            <Gift className="h-5 w-5" /> Coins envoyés et reçus
          </h2>
          <section className="mt-3 space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>
            ) : transactions.map((transaction) => {
              const incoming = transaction.amount > 0;
              return (
                <div key={transaction.id} className="flex items-center justify-between rounded-2xl bg-card p-4">
                  <div className="flex items-center gap-3">
                    {incoming
                      ? <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
                      : <ArrowUpRight className="h-5 w-5 text-destructive" />}
                    <div>
                      <p className="font-bold">{transactionLabel(transaction.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString('fr-FR')}
                        {transaction.description ? ` · ${transaction.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <p className={incoming ? 'font-bold text-emerald-500' : 'font-bold text-destructive'}>
                    {incoming ? '+' : ''}{transaction.amount.toLocaleString('fr-FR')}
                  </p>
                </div>
              );
            })}
          </section>
        </>
      )}

      <Dialog open={Boolean(activePack)} onOpenChange={(open) => !open && setSelectedPack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acheter {activePack?.coins.toLocaleString('fr-FR')} coins</DialogTitle>
            <DialogDescription>
              {activePack ? `${formatFCFA(activePack.price_fcfa)} · paiement sécurisé FedaPay` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Numéro Mobile Money (ex. 0197000000)"
              inputMode="tel"
            />
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger>
                <SelectValue placeholder="Moyen de paiement" />
              </SelectTrigger>
              <SelectContent>
                {COIN_OPERATORS.map((value) => (
                  <SelectItem key={value} value={value}>{OPERATOR_LABELS[value] ?? value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le numéro sert au paiement Mobile Money. Les coins sont crédités dès la confirmation du paiement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedPack(null)}>Annuler</Button>
            <Button onClick={() => void handleBuy()} disabled={submitting}>
              {submitting ? 'Ouverture…' : 'Payer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Coins;
