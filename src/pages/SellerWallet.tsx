import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Check, Phone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonCard } from '@/components/common/SkeletonLoader';

const paymentMethods = [
  { id: 'orange_money', name: 'Orange Money', emoji: '🟠' },
  { id: 'wave', name: 'Wave', emoji: '🔵' },
  { id: 'mtn', name: 'MTN MoMo', emoji: '🟡' },
  { id: 'moov', name: 'Moov Money', emoji: '🔵' },
];

interface Payout {
  id: string;
  order_id: string | null;
  amount: number;
  operator: string | null;
  payout_reference: string | null;
  status: string;
  created_at: string;
}

const formatFCFA = (n: number) => n.toLocaleString('fr-FR').replace(/,/g, ' ');

const SellerWallet = () => {
  const navigate = useNavigate();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return;

        const [payoutsRes, ordersRes] = await Promise.all([
          supabase
            .from('seller_payouts')
            .select('*')
            .eq('seller_id', uid)
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('seller_amount, status, escrow_released')
            .eq('seller_id', uid),
        ]);

        const list = (payoutsRes.data ?? []) as Payout[];
        setPayouts(list);
        setAvailableBalance(
          list.filter((p) => p.status === 'envoye').reduce((s, p) => s + (p.amount || 0), 0),
        );

        const orders = ordersRes.data ?? [];
        setPendingBalance(
          orders
            .filter((o) => !o.escrow_released && ['payee', 'expediee', 'livree'].includes(o.status))
            .reduce((s, o) => s + (o.seller_amount || 0), 0),
        );
      } catch (e) {
        toast.error('Erreur de chargement du portefeuille');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleWithdraw = () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount <= 0) return toast.error('Montant invalide');
    if (amount > availableBalance) return toast.error('Solde insuffisant');
    if (!selectedMethod) return toast.error('Choisissez un opérateur');
    if (phone.length < 8) return toast.error('Numéro invalide');
    setShowWithdraw(false);
    toast.success('Demande de retrait envoyée ! Vous recevrez votre argent sous 24-48h.');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-foreground">💰 Mon portefeuille</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#7C3AED]/5 border border-[#7C3AED]/30 text-center">
          <p className="text-sm text-muted-foreground mb-1">Solde disponible</p>
          <p className="text-3xl font-bold text-foreground">
            {loading ? '…' : formatFCFA(availableBalance)} <span className="text-lg">FCFA</span>
          </p>
          <button
            onClick={() => setShowWithdraw(true)}
            className="mt-4 px-6 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm"
          >
            Retirer mes gains
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c1a2e] border border-[#3B82F6]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <p className="text-sm text-foreground font-medium">Solde en attente (escrow)</p>
              <p className="text-xs text-muted-foreground">Libéré après confirmation livraison</p>
            </div>
          </div>
          <p className="text-lg font-bold text-[#3B82F6]">
            {loading ? '…' : formatFCFA(pendingBalance)}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Historique des versements</h3>
          {loading ? (
            <div className="space-y-2">
              <SkeletonCard /> <SkeletonCard />
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun versement pour le moment
            </p>
          ) : (
            <div className="space-y-2">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A2E] border border-border/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.payout_reference || `#${p.id.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.operator || '—'} ·{' '}
                      {new Date(p.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      +{formatFCFA(p.amount)} FCFA
                    </p>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
                      <Check className="w-3 h-3" />{' '}
                      {p.status === 'envoye' ? 'Envoyé' : p.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showWithdraw && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowWithdraw(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-[#1A1A2E] rounded-t-[20px] animate-slide-up">
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="font-bold text-foreground">Retirer mes gains</h3>
              <button onClick={() => setShowWithdraw(false)} className="p-1">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-4 pb-8 space-y-4">
              <div className="text-center p-3 rounded-xl bg-[#0A0A0F]">
                <p className="text-xs text-muted-foreground">Disponible</p>
                <p className="text-xl font-bold text-foreground">
                  {formatFCFA(availableBalance)} FCFA
                </p>
              </div>

              <input
                type="number"
                placeholder="Montant à retirer (FCFA)"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={cn(
                      'p-3 rounded-xl border text-left text-sm transition-all',
                      selectedMethod === m.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/20 bg-[#0A0A0F]',
                    )}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <p className="text-xs text-foreground mt-1">{m.name}</p>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  placeholder="Numéro de téléphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm"
                />
              </div>

              <button
                onClick={handleWithdraw}
                className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm"
              >
                Demander le retrait
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SellerWallet;
