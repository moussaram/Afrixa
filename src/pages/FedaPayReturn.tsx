import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { verifyFedaPayPayment } from '@/lib/fedapay';
import { supabase } from '@/integrations/supabase/client';
import { trackPurchase } from '@/lib/firebase/analytics';

type Result = { state: 'loading' | 'success' | 'pending' | 'failed'; message: string };

const FedaPayReturn = () => {
  const [params] = useSearchParams();
  const [result, setResult] = useState<Result>({
    state: 'loading',
    message: 'Vérification du paiement auprès de FedaPay…',
  });
  const trackedOrderRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const transactionId = params.get('id');
    const reference = params.get('order_ref');
    if (!transactionId || !reference) {
      setResult({ state: 'failed', message: 'Le paiement a été interrompu ou aucune référence n’a été renvoyée.' });
      return () => { active = false; };
    }

    verifyFedaPayPayment(transactionId, reference)
      .then((response) => {
        if (!active) return;
        if (response.verified) {
          setResult({ state: 'success', message: 'Paiement confirmé. Votre commande est enregistrée.' });
          if (response.order_id && trackedOrderRef.current !== response.order_id) {
            trackedOrderRef.current = response.order_id;
            void supabase.from('orders').select('total_price').eq('id', response.order_id).maybeSingle()
              .then(({ data: order }) => {
                if (order) void trackPurchase(order.total_price, 'XOF');
              });
          }
        } else if (['pending', 'unknown'].includes(response.status ?? '')) {
          setResult({ state: 'pending', message: 'Le paiement est encore en cours de confirmation. Cette page sera mise à jour par FedaPay.' });
        } else {
          setResult({ state: 'failed', message: 'Le paiement n’a pas été confirmé. Si votre compte a été débité, contactez le support Afrixa.' });
        }
      })
      .catch(() => {
        if (active) setResult({
          state: 'pending',
          message: 'La vérification est momentanément indisponible. FedaPay notifiera Afrixa dès que le statut sera confirmé.',
        });
      });
    return () => { active = false; };
  }, [params]);

  const StatusIcon = result.state === 'loading' || result.state === 'pending'
    ? Loader2
    : result.state === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-5">
      <section className="w-full max-w-md rounded-2xl border border-border/30 bg-card p-6 text-center space-y-4">
        <StatusIcon className={`mx-auto h-12 w-12 ${result.state === 'loading' || result.state === 'pending' ? 'animate-spin text-primary' : result.state === 'success' ? 'text-emerald-500' : 'text-amber-500'}`} />
        <h1 className="text-xl font-bold text-foreground">
          {result.state === 'success' ? 'Paiement confirmé' : result.state === 'failed' ? 'Paiement non confirmé' : 'Vérification du paiement'}
        </h1>
        <p className="text-sm text-muted-foreground">{result.message}</p>
        <Link to="/orders" className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
          Voir mes commandes
        </Link>
      </section>
    </main>
  );
};

export default FedaPayReturn;
