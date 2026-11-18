import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Clock, Check, Save, RefreshCw, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonCard } from '@/components/common/SkeletonLoader';

const payoutMethods = [
  { id: 'mtn_open', name: 'MTN Bénin' }, { id: 'moov', name: 'Moov Bénin' },
  { id: 'sbin', name: 'Celtis Bénin' }, { id: 'mtn_ci', name: 'MTN Côte d’Ivoire' },
  { id: 'moov_ci', name: 'Moov Côte d’Ivoire' }, { id: 'wave_ci', name: 'Wave Côte d’Ivoire' },
  { id: 'orange_ci', name: 'Orange Côte d’Ivoire' }, { id: 'moov_tg', name: 'Moov Togo' },
  { id: 'togocel', name: 'Togocel' }, { id: 'orange-bf', name: 'Orange Burkina Faso' },
  { id: 'moov_bf', name: 'Moov Burkina Faso' }, { id: 'mtn_open_gn', name: 'MTN Guinée' },
  { id: 'wave_sn', name: 'Wave Sénégal' }, { id: 'orange_sn', name: 'Orange Sénégal' },
];

type Payout = { id: string; order_id: string | null; amount: number; operator: string | null; payout_reference: string | null; status: string; created_at: string };
type LedgerEntry = { id: string; order_id: string; amount: number; currency: string; created_at: string };

const formatFCFA = (amount: number) => Math.max(0, Number(amount) || 0).toLocaleString('fr-FR') + ' FCFA';

const SellerWallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [releasedOrders, setReleasedOrders] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutPhone, setPayoutPhone] = useState('');

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Connectez-vous pour consulter votre portefeuille.');
      const [ledgerRes, ordersRes, payoutsRes, profileRes] = await Promise.all([
        supabase.from('seller_wallet_ledger').select('id, order_id, amount, currency, created_at').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('orders').select('seller_amount, status, escrow_released').eq('seller_id', user.id),
        supabase.from('seller_payouts').select('id, order_id, amount, operator, payout_reference, status, created_at').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('numero_mobile, numero_mobile_operateur').eq('user_id', user.id).maybeSingle(),
      ]);
      if (ledgerRes.error) throw ledgerRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (payoutsRes.error) throw payoutsRes.error;
      if (profileRes.error) throw profileRes.error;

      const ledger = (ledgerRes.data ?? []) as LedgerEntry[];
      const payoutList = (payoutsRes.data ?? []) as Payout[];
      const payoutsReserved = payoutList
        .filter((payout) => ['en_attente', 'processing', 'envoye'].includes(payout.status))
        .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
      const credited = ledger.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      setAvailableBalance(Math.max(0, credited - payoutsReserved));

      const active = (ordersRes.data ?? []).filter((order) =>
        !order.escrow_released && ['payee', 'en_preparation', 'expediee', 'livree'].includes(order.status),
      );
      setPendingOrders(active.length);
      setPendingBalance(active.reduce((sum, order) => sum + Number(order.seller_amount || 0), 0));
      setReleasedOrders(ledger.length);
      setPayouts(payoutList);
      setPayoutMethod(profileRes.data?.numero_mobile_operateur ?? '');
      setPayoutPhone(profileRes.data?.numero_mobile ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement du portefeuille');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWallet(); }, [loadWallet]);

  const savePayoutDetails = async () => {
    if (!payoutMethod) return toast.error('Choisissez votre opérateur de versement');
    if (payoutPhone.replace(/\D/g, '').length < 8) return toast.error('Numéro de versement invalide');
    setSaving(true);
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
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">💰 Mon portefeuille</h1>
          <button onClick={() => void loadWallet()} className="p-2" aria-label="Actualiser"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#7C3AED]/5 border border-[#7C3AED]/30 text-center">
          <Wallet className="w-7 h-7 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Solde disponible dans Afrixa</p>
          <p className="text-3xl font-bold text-foreground">{loading ? '…' : formatFCFA(availableBalance)}</p>
          <p className="text-xs text-muted-foreground mt-2">Montants libérés après confirmation de réception, diminués des versements déjà effectués ou en cours.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-[#0c1a2e] border border-blue-500/30">
            <Clock className="w-5 h-5 text-blue-300 mb-2" />
            <p className="text-xs text-blue-200">Solde en attente</p>
            <p className="text-lg font-bold text-blue-200">{loading ? '…' : formatFCFA(pendingBalance)}</p>
            <p className="text-[10px] text-blue-200/70 mt-1">{pendingOrders} commande(s) non libérée(s)</p>
          </div>
          <div className="p-4 rounded-2xl bg-[#1A1A2E] border border-border/20">
            <Check className="w-5 h-5 text-emerald-400 mb-2" />
            <p className="text-xs text-muted-foreground">Commandes libérées</p>
            <p className="text-2xl font-bold text-foreground">{loading ? '…' : releasedOrders}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Crédits enregistrés</p>
          </div>
        </div>

        <section className="rounded-2xl bg-[#1A1A2E] border border-border/20 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Coordonnées pour recevoir vos versements</h2>
            <p className="text-xs text-muted-foreground mt-1">Enregistrez le numéro de destination. Le retrait externe sera activé après validation du circuit de transfert FedaPay.</p>
          </div>
          <select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground text-sm">
            <option value="">Choisir un opérateur</option>
            {payoutMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
          <input type="tel" value={payoutPhone} onChange={(event) => setPayoutPhone(event.target.value)} placeholder="Numéro Mobile Money destinataire" className="w-full p-3 rounded-xl bg-[#0A0A0F] border border-border/20 text-foreground placeholder:text-muted-foreground text-sm" />
          <button onClick={() => void savePayoutDetails()} disabled={saving} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50">
            <Save className="w-4 h-4 inline mr-2" />{saving ? 'Enregistrement…' : 'Enregistrer les coordonnées'}
          </button>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Historique des versements</h3>
          {loading ? <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div> : payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun versement effectué pour le moment</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A2E] border border-border/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{payout.payout_reference || 'Versement Afrixa'}</p>
                    <p className="text-xs text-muted-foreground">{payout.operator || '—'} · {new Date(payout.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">{formatFCFA(payout.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{payout.status === 'envoye' ? 'Envoyé' : payout.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SellerWallet;
