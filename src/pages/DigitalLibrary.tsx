import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, FileCheck2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type Entitlement = {
  id: string;
  product_id: string;
  order_id: string;
  status: string;
  granted_at: string;
};
type PurchaseOrder = {
  id: string;
  product_name: string;
  product_image: string | null;
  status: string;
};

const DigitalLibrary = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<Array<Entitlement & PurchaseOrder>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    if (!user) {
      setItems([]);
      setError('Connectez-vous pour consulter vos achats numériques.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: entitlements, error: entitlementError } = await supabase
        .from('digital_entitlements')
        .select('id,product_id,order_id,status,granted_at')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false });
      if (entitlementError) throw entitlementError;
      const rows = (entitlements || []) as Entitlement[];
      if (!rows.length) {
        setItems([]);
        return;
      }
      const orderIds = Array.from(new Set(rows.map(row => row.order_id)));
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id,product_name,product_image,status')
        .in('id', orderIds)
        .eq('buyer_id', user.id);
      if (ordersError) throw ordersError;
      const orderMap = new Map(((orders || []) as PurchaseOrder[]).map(order => [order.id, order]));
      setItems(rows.flatMap(row => {
        const order = orderMap.get(row.order_id);
        return order ? [{ ...row, ...order }] : [];
      }));
    } catch (loadError) {
      console.error('Digital library load failed', loadError);
      setError('Impossible de charger vos achats numériques.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const download = async (entitlementId: string) => {
    setDownloadingId(entitlementId);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('download-digital-product', {
        body: { entitlement_id: entitlementId },
      });
      if (invokeError) throw invokeError;
      if (!data?.signed_url || typeof data.signed_url !== 'string') {
        throw new Error('Lien de téléchargement indisponible.');
      }
      window.location.assign(data.signed_url);
    } catch (downloadError) {
      console.error('Digital download failed', downloadError);
      toast.error(downloadError instanceof Error ? downloadError.message : 'Téléchargement refusé.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-1" aria-label="Retour"><ArrowLeft className="w-6 h-6 text-foreground" /></button>
          <h1 className="flex-1 text-lg font-bold text-foreground">Mes achats numériques</h1>
          <button onClick={() => void loadLibrary()} disabled={loading} className="p-2" aria-label="Actualiser">
            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3">
        {loading && <p className="py-12 text-center text-sm text-muted-foreground">Chargement de votre bibliothèque…</p>}
        {!loading && error && <div className="py-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={() => void loadLibrary()} className="text-sm text-primary font-semibold">Réessayer</button>
        </div>}
        {!loading && !error && items.length === 0 && <div className="py-16 text-center">
          <FileCheck2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold text-foreground">Votre bibliothèque est vide</p>
          <p className="text-sm text-muted-foreground mt-1">Les fichiers achetés apparaîtront ici après confirmation du paiement.</p>
        </div>}
        {!loading && !error && items.map(item => (
          <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card/40 p-3">
            {item.product_image
              ? <img src={item.product_image} alt={item.product_name} className="w-16 h-16 rounded-xl object-cover" />
              : <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center"><FileCheck2 className="w-6 h-6 text-muted-foreground" /></div>}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{item.product_name}</h2>
              <p className="text-xs text-muted-foreground">Acheté le {new Date(item.granted_at).toLocaleDateString('fr-FR')}</p>
              <p className="text-xs text-emerald-500 mt-1">{item.status === 'active' ? 'Accès actif' : 'Accès suspendu'}</p>
            </div>
            <button onClick={() => void download(item.id)} disabled={item.status !== 'active' || downloadingId === item.id}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              <Download className="w-4 h-4" />{downloadingId === item.id ? 'Préparation…' : 'Télécharger'}
            </button>
          </article>
        ))}
      </main>
    </div>
  );
};

export default DigitalLibrary;
