/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Building2, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type SignedDocument = { path: string; url: string | null };
type VerificationItem = {
  id: string;
  user_id: string;
  request_type: 'identity' | 'business';
  status: string;
  applicant_name: string;
  country_code: string;
  document_paths: Array<{ path: string; name?: string; mime_type?: string; size?: number }>;
  signed_documents: SignedDocument[];
  business_name: string | null;
  business_registration_number: string | null;
  business_description: string | null;
  website_url: string | null;
  fee_amount_fcfa: number;
  payment_status: string;
  submitted_at: string;
  reviewer_note: string | null;
  rejection_reason: string | null;
};

const AdminVerificationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).functions.invoke('review-account-verification', {
      body: { action: 'list', ...(filter === 'active' ? {} : { status: filter }) },
    });
    if (error || data?.error) {
      console.error('Unable to load verification queue', error ?? data?.error);
      toast.error('Impossible de charger les demandes de vérification.');
      setItems([]);
    } else {
      setItems(data?.requests ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (!user) { setAllowed(false); setLoading(false); return; }
    void (async () => {
      const { data, error } = await (supabase as any).rpc('is_platform_admin');
      if (error || data !== true) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);
      await load();
    })();
  }, [user?.id, load]);

  const review = async (item: VerificationItem, decision: 'in_review' | 'approved' | 'rejected', waiveFee = false) => {
    if (decision === 'rejected' && (reasons[item.id]?.trim().length ?? 0) < 5) {
      toast.error('Indiquez un motif de refus (5 caractères minimum).');
      return;
    }
    if (decision === 'approved' && item.payment_status !== 'paid' && item.payment_status !== 'waived' && !waiveFee) {
      toast.error('Le paiement doit être confirmé. Utilisez l’exemption uniquement si elle est autorisée.');
      return;
    }
    setWorkingId(item.id);
    try {
      const { data, error } = await (supabase as any).functions.invoke('review-account-verification', {
        body: {
          action: 'review',
          request_id: item.id,
          decision,
          note: notes[item.id] ?? '',
          rejection_reason: reasons[item.id] ?? '',
          waive_fee: waiveFee,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Échec de la décision');
      toast.success(decision === 'approved' ? 'Badge attribué.' : decision === 'rejected' ? 'Demande refusée.' : 'Demande prise en charge.');
      await load();
    } catch (error) {
      console.error('Verification decision failed', error);
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer la décision.');
    } finally {
      setWorkingId(null);
    }
  };

  if (allowed === false) {
    return <main className="min-h-screen bg-background px-4 pt-12"><div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h1 className="font-bold">Accès réservé</h1><p className="mt-2 text-sm text-muted-foreground">Cette file est réservée aux administrateurs Afrixa.</p><Button className="mt-4" variant="outline" onClick={() => navigate(-1)}>Retour</Button></div></main>;
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-5">
      <header className="mx-auto flex max-w-4xl items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1"><h1 className="text-xl font-black">Vérifications Afrixa</h1><p className="text-xs text-muted-foreground">Contrôle manuel des identités et entreprises</p></div>
        <Button size="icon" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
      </header>

      <div className="mx-auto mt-5 flex max-w-4xl flex-wrap gap-2">
        {[
          ['active', 'À traiter'],
          ['approved', 'Approuvées'],
          ['rejected', 'Refusées'],
          ['cancelled', 'Annulées'],
        ].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{label}</button>)}
      </div>

      <section className="mx-auto mt-4 max-w-4xl space-y-4">
        {loading && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Chargement des demandes…</p>}
        {!loading && items.length === 0 && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Aucune demande dans cette catégorie.</p>}
        {!loading && items.map((item) => (
          <article key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {item.request_type === 'identity' ? <BadgeCheck className="h-6 w-6 text-primary" /> : <Building2 className="h-6 w-6 text-primary" />}
                <div><h2 className="font-bold">{item.request_type === 'identity' ? 'Vérification d’identité' : 'Entreprise / boutique'}</h2><p className="text-xs text-muted-foreground">{item.applicant_name} · {item.country_code} · {new Date(item.submitted_at).toLocaleString('fr-FR')}</p></div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.status}</span>
            </div>

            {item.request_type === 'business' && <div className="rounded-xl bg-muted/30 p-3 text-sm"><p><strong>Entreprise :</strong> {item.business_name}</p>{item.business_registration_number && <p><strong>Immatriculation :</strong> {item.business_registration_number}</p>}{item.business_description && <p><strong>Activité :</strong> {item.business_description}</p>}{item.website_url && <p className="break-all"><strong>Site :</strong> {item.website_url}</p>}</div>}

            <div><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Justificatifs · {item.fee_amount_fcfa.toLocaleString('fr-FR')} FCFA · paiement : {item.payment_status}</p><div className="flex flex-wrap gap-2">{(item.signed_documents ?? []).map((doc, index) => <a key={doc.path} href={doc.url ?? '#'} target="_blank" rel="noreferrer" onClick={(event) => { if (!doc.url) event.preventDefault(); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted/40"><FileText className="h-4 w-4" />Document {index + 1}</a>)}</div></div>

            {['pending', 'in_review'].includes(item.status) && <>
              <Input value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Note interne (facultatif)" maxLength={1000} />
              <Input value={reasons[item.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Motif obligatoire en cas de refus" maxLength={1000} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={workingId === item.id} onClick={() => void review(item, 'in_review')}>Prendre en charge</Button>
                <Button size="sm" disabled={workingId === item.id || (item.payment_status !== 'paid' && item.payment_status !== 'waived')} onClick={() => void review(item, 'approved')}>Approuver et attribuer le badge</Button>
                <Button size="sm" variant="secondary" disabled={workingId === item.id || item.payment_status === 'paid' || item.payment_status === 'waived'} onClick={() => void review(item, 'approved', true)}>Exempter des frais et approuver</Button>
                <Button size="sm" variant="destructive" disabled={workingId === item.id} onClick={() => void review(item, 'rejected')}>Refuser</Button>
              </div>
            </>}
            {item.rejection_reason && <p className="text-sm text-destructive">Motif du refus : {item.rejection_reason}</p>}
          </article>
        ))}
      </section>
    </main>
  );
};

export default AdminVerificationPage;
