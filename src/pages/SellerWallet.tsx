import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonCard } from '@/components/common/SkeletonLoader';

const fedapayPayoutMethods = [
  { id: 'mtn_open', name: 'MTN Bénin' },
  { id: 'moov', name: 'Moov Bénin' },
  { id: 'sbin', name: 'Celtis Bénin' },
  { id: 'mtn_ci', name: 'MTN Côte d’Ivoire' },
  { id: 'moov_ci', name: 'Moov Côte d’Ivoire' },
  { id: 'wave_ci', name: 'Wave Côte d’Ivoire' },
  { id: 'orange_ci', name: 'Orange Côte d’Ivoire' },
  { id: 'moov_tg', name: 'Moov Togo' },
  { id: 'togocel', name: 'Togocel' },
  { id: 'orange-bf', name: 'Orange Burkina Faso' },
  { id: 'moov_bf', name: 'Moov Burkina Faso' },
  { id: 'mtn_open_gn', name: 'MTN Guinée' },
  { id: 'wave_sn', name: 'Wave Sénégal' },
  { id: 'orange_sn', name: 'Orange Sénégal' },
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
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [savingPayoutInfo, setSavingPayoutInfo] = useState(false);

  const [loading, setLoading] = useState(true);
  const [totalPaid, setTotalPaid] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return;

        const [payoutsRes, ordersRes, profileRes] = await Promise.all([
          supabase
            .from('seller_payouts')
            .select('*')
            .eq('seller_id', uid)
            .not('order_id', 'is', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('seller_amount, status, escrow_released')
            .eq('seller_id', uid),
          supabase.from('profiles').select('numero_mobile, numero_mobile_operateur').eq('user_id', uid).maybeSingle(),
        ]);

        setPayoutMethod(profileRes.data?.numero_mobile_operateur ?? '');
        setPayoutPhone(profileRes.data?.numero_mobile ?? '');

        const list = (payoutsRes.data ?? []) as Payout[];
        setPayouts(list);
        setTotalPaid(
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

  const savePayoutDetails = async () => {
    if (!payoutMethod) return toast.error('Choisissez votre opérateur de versement');
    if (payoutPhone.replace(/\D/g, '').length < 8) return toast.error('Numéro de versement invalide');
    setSavingPayoutInfo(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Session utilisateur indisponible');
      const { error } = await supabase.from('profiles').update({
        numero_mobile: payoutPhone.trim(),
        numero_mobile_operateur: payoutMethod,
      }).eq('user_id', user.id);
      if (error) throw error;
      toast.success('Coordonnées de versement enregistrées');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer les coordonnées');
    } finally {
      setSavingPayoutInfo(false);
    }
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
          <p className="text-sm text-muted-foreground mb-1">Total déjà versé</p>
          <p className="text-3xl font-bold text-foreground">
            {loading ? '…' : formatFCFA(totalPaid)} <span className="text-lg">FCFA</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Les versements marketplace sont déclenchés automatiquement après confirmation de livraison.</p>
        </div>

        <section className="rounded-2xl bg-[#1A1A2E] border border-border/20 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Coordonnées pour recevoir vos versements</h2>
            <p className="text-xs text-muted-foreground mt-1">Ces informations servent aux versements FedaPay après livraison confirmée.</p>
          </div>
          <select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground text-sm">
            <option value="">Choisir un opérateur</option>
            {fedapayPayoutMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
          <input type="tel" value={payoutPhone} onChange={(event) => setPayoutPhone(event.target.value)} placeholder="Numéro Mobile Money destinataire" className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm" />
          <button onClick={savePayoutDetails} disabled={savingPayoutInfo} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50">
            <Save className="w-4 h-4 inline mr-2" />{savingPayoutInfo ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
          </button>
        </section>

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

    </div>
  );
};

export default SellerWallet;
