/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, FileText, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type Plan = { id: string; name: string; amount_xof: number; duration_days: number };
type Subscription = { id: string; status: string; amount_xof: number; expires_at: string | null; created_at: string };
type RequestItem = {
  id: string; subscription_id: string; status: string; legal_name: string; document_type: string;
  issuing_country: string; decision_reason: string | null; submitted_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  payment_pending: 'Paiement en attente',
  active: 'Abonnement actif',
  submitted: 'Dossier envoyé',
  under_review: 'En cours d’examen',
  needs_information: 'Complément demandé',
  approved: 'Identité approuvée',
  rejected: 'Demande refusée',
  expired: 'Abonnement expiré',
  revoked: 'Vérification retirée',
};

const IdentityVerificationPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [documentType, setDocumentType] = useState('national_id');
  const [country, setCountry] = useState('BJ');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');

  const latestSubscription = subscriptions[0] ?? null;
  const activeSubscription = useMemo(
    () => subscriptions.find((item) => item.status === 'active' && item.expires_at && new Date(item.expires_at) > new Date()) ?? null,
    [subscriptions],
  );
  const latestRequest = requests[0] ?? null;
  const canApply = Boolean(activeSubscription && (!latestRequest || latestRequest.status === 'needs_information' || latestRequest.status === 'rejected' || (latestRequest.status === 'approved' && latestRequest.subscription_id !== activeSubscription.id)));
  const money = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('identity-verification', {
      body: { action: 'status' },
    });
    if (error) {
      console.error('Identity verification status load failed', error);
      toast.error('Impossible de charger la vérification d’identité.');
    } else {
      setPlan(data?.plan ?? null);
      setSubscriptions(data?.subscriptions ?? []);
      setRequests(data?.requests ?? []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const subscriptionId = searchParams.get('subscription_id');
    if (searchParams.get('payment') !== 'return' || !subscriptionId) return;
    let cancelled = false;
    void (async () => {
      setPaymentMessage('Vérification du paiement auprès de FedaPay…');
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: { action: 'verify_payment', subscription_id: subscriptionId },
      });
      if (cancelled) return;
      if (error) {
        setPaymentMessage('Le paiement n’a pas encore pu être confirmé. Réessaie dans quelques instants.');
      } else if (data?.verified) {
        setPaymentMessage('Paiement confirmé. Tu peux maintenant envoyer ton dossier.');
        toast.success('Abonnement de vérification activé.');
        await load();
      } else {
        setPaymentMessage('Paiement en attente de confirmation. Reviens ici dans quelques instants.');
      }
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [searchParams, setSearchParams, load]);

  useEffect(() => {
    if (profile) {
      const name = [profile.prenom, profile.deuxieme_prenom, profile.nom].filter(Boolean).join(' ').trim();
      if (name) setLegalName((current) => current || name);
    }
  }, [profile]);

  const startPayment = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: { action: 'create_checkout' },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error(data?.error ?? 'Lien de paiement indisponible');
      window.location.assign(data.checkout_url);
    } catch (error: any) {
      console.error('Identity verification checkout failed', error);
      toast.error(error?.context?.error ?? error?.message ?? 'Impossible de lancer le paiement.');
      setBusy(false);
    }
  };

  const submitApplication = async () => {
    if (!user?.id || !activeSubscription || !file) {
      toast.error('Choisis un justificatif avant de continuer.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error('Format accepté : JPG, PNG ou PDF, 10 Mo maximum.');
      return;
    }
    setBusy(true);
    const folder = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    const path = user.id + '/' + folder + '/' + safeName;
    try {
      const { error: uploadError } = await supabase.storage
        .from('identity-verification-documents')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: {
          action: 'submit_request',
          subscription_id: activeSubscription.id,
          legal_name: legalName,
          document_type: documentType,
          issuing_country: country,
          document_path: path,
          applicant_note: note,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Ton dossier a été transmis à l’équipe Afrixa.');
      setFile(null);
      setNote('');
      await load();
    } catch (error: any) {
      console.error('Identity verification application failed', error);
      toast.error(error?.message ?? 'Impossible de transmettre le dossier.');
      await supabase.storage.from('identity-verification-documents').remove([path]);
    } finally {
      setBusy(false);
    }
  };

  const verifyAgain = async () => {
    if (!latestSubscription) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: { action: 'verify_payment', subscription_id: latestSubscription.id },
      });
      if (error) throw error;
      if (data?.verified) {
        toast.success('Paiement confirmé.');
        setPaymentMessage('Paiement confirmé. Tu peux envoyer ton dossier.');
        await load();
      } else {
        toast.info('FedaPay n’a pas encore confirmé le paiement.');
      }
    } catch (error) {
      console.error('Payment verification retry failed', error);
      toast.error('La vérification du paiement a échoué.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-5">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Afrixa · Vérification du profil</p>
            <h1 className="text-2xl font-black">Identité vérifiée</h1>
          </div>
        </div>

        <section className="mt-5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-background p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <BadgeCheck className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="font-bold">Le badge bleu Afrixa</h2>
              <p className="text-sm text-muted-foreground">Confirme que l’identité du titulaire a été examinée par notre équipe.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/80 p-3">
              <p className="text-2xl font-black">{plan ? money(plan.amount_xof) : '2 000 FCFA'}</p>
              <p className="text-xs text-muted-foreground">Pour 12 mois</p>
            </div>
            <div className="rounded-xl bg-background/80 p-3">
              <p className="text-2xl font-black">365 jours</p>
              <p className="text-xs text-muted-foreground">Renouvellement manuel</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Le paiement couvre l’examen du dossier et ne garantit pas son approbation. Le badge est accordé uniquement après validation par Afrixa.
          </p>
        </section>

        {paymentMessage && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">{paymentMessage}</div>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-12 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <>
            {latestRequest && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-bold">État de ta demande</h2>
                </div>
                <p className="mt-2 text-sm font-semibold">{STATUS_LABELS[latestRequest.status] ?? latestRequest.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">Envoyée le {new Date(latestRequest.submitted_at).toLocaleDateString('fr-FR')}</p>
                {latestRequest.decision_reason && (
                  <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">{latestRequest.decision_reason}</p>
                )}
                {latestRequest.status === 'approved' && (
                  <p className="mt-2 text-sm text-emerald-600">Ton identité est approuvée. Le badge bleu apparaît sur ton profil pendant la période active.</p>
                )}
              </section>
            )}

            {!activeSubscription && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-4">
                <h2 className="font-bold">1. Activer l’examen de ton identité</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Un abonnement séparé est nécessaire. Il n’est pas inclus dans les autres formules Afrixa.
                </p>
                <Button className="mt-4 w-full" variant="gradient" disabled={busy || !plan} onClick={() => void startPayment()}>
                  {busy ? 'Préparation du paiement…' : 'Payer 2 000 FCFA avec FedaPay'}
                </Button>
                {latestSubscription?.status === 'payment_pending' && (
                  <Button className="mt-2 w-full" variant="outline" disabled={busy} onClick={() => void verifyAgain()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Vérifier mon paiement
                  </Button>
                )}
              </section>
            )}

            {activeSubscription && (
              <section className="mt-5 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">2. Envoyer tes justificatifs</h2>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">Abonnement actif</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expire le {new Date(activeSubscription.expires_at!).toLocaleDateString('fr-FR')}. Pièce acceptée : carte nationale d’identité, passeport ou titre de séjour.
                </p>
                {canApply ? (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="identity-legal-name">Nom complet comme indiqué sur la pièce</Label>
                      <Input id="identity-legal-name" value={legalName} onChange={(event) => setLegalName(event.target.value)} maxLength={160} placeholder="Nom et prénoms" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="identity-document-type">Type de justificatif</Label>
                        <select id="identity-document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="national_id">Carte nationale d’identité</option>
                          <option value="passport">Passeport</option>
                          <option value="residence_permit">Titre de séjour</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="identity-country">Pays émetteur (code ISO)</Label>
                        <Input id="identity-country" value={country} onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="BJ" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="identity-document">Justificatif (JPG, PNG ou PDF · 10 Mo max.)</Label>
                      <Input id="identity-document" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                      {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} Mo</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="identity-note">Note facultative</Label>
                      <Textarea id="identity-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Information utile pour l’équipe Afrixa…" />
                    </div>
                    <Button className="w-full" variant="gradient" disabled={busy || !file || legalName.trim().length < 3 || country.length !== 2} onClick={() => void submitApplication()}>
                      <UploadCloud className="mr-2 h-4 w-4" /> {busy ? 'Envoi en cours…' : 'Soumettre mon dossier'}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {latestRequest?.status === 'approved'
                      ? 'Ta demande a été approuvée. Le renouvellement sera possible à l’expiration.'
                      : 'Ton dossier est déjà en cours de traitement. Tu seras informé de la décision de l’équipe.'}
                  </p>
                )}
              </section>
            )}

            <section className="mt-5 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Conditions importantes</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>La demande est volontaire et examinée par l’équipe Afrixa.</li>
                <li>Le paiement ne garantit pas l’obtention du badge.</li>
                <li>Un complément demandé par l’équipe peut être envoyé sans repayer pendant la période active.</li>
                <li>Le badge est désactivé à l’expiration de l’abonnement ou en cas de révocation.</li>
                <li>Les documents restent privés et ne sont jamais affichés sur le profil public.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default IdentityVerificationPage;
