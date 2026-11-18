import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Building2, Clock3, FileText, ShieldCheck, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';

type RequestType = 'identity' | 'business';
type VerificationRequest = {
  id: string;
  request_type: RequestType;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  fee_amount_fcfa: number;
  submitted_at: string;
  reviewer_note: string | null;
  rejection_reason: string | null;
};

const FEES: Record<RequestType, number> = { identity: 1500, business: 5000 };
const STATUS: Record<VerificationRequest['status'], string> = {
  pending: 'En attente',
  in_review: 'En cours d’examen',
  approved: 'Approuvée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
};

const AccountVerification = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [kind, setKind] = useState<RequestType>('identity');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applicantName, setApplicantName] = useState('');
  const [countryCode, setCountryCode] = useState('BJ');
  const [businessName, setBusinessName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);

  useEffect(() => {
    const fullName = [profile?.prenom, profile?.deuxieme_prenom, profile?.nom].filter(Boolean).join(' ');
    if (fullName) setApplicantName(fullName);
  }, [profile]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('account_verification_requests')
      .select('id,request_type,status,fee_amount_fcfa,submitted_at,reviewer_note,rejection_reason')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('Could not load verification requests', error);
      toast.error('Impossible de charger vos demandes.');
    } else {
      setRequests((data ?? []) as VerificationRequest[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const activeRequest = requests.find((request) => request.request_type === kind && ['pending', 'in_review'].includes(request.status));
  const alreadyVerified = kind === 'identity' ? Boolean(profile?.identity_verified) : Boolean(profile?.business_verified);
  const selectedFiles = (files: FileList | null) => {
    const next = Array.from(files ?? []);
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (next.length > 6) {
      toast.error('Vous pouvez joindre au maximum 6 documents.');
      return;
    }
    if (next.some((file) => !allowed.includes(file.type) || file.size > 10 * 1024 * 1024)) {
      toast.error('Formats autorisés : JPG, PNG, WebP ou PDF, 10 Mo maximum par fichier.');
      return;
    }
    setDocuments(next);
  };

  const submit = async () => {
    if (!user) return;
    if (applicantName.trim().length < 3) {
      toast.error('Renseignez votre nom complet.');
      return;
    }
    if (!/^[A-Z]{2}$/.test(countryCode.trim().toUpperCase())) {
      toast.error('Le code du pays doit contenir 2 lettres (ex. BJ).');
      return;
    }
    if (documents.length === 0) {
      toast.error('Ajoutez au moins un justificatif.');
      return;
    }
    if (kind === 'business' && businessName.trim().length < 2) {
      toast.error('Renseignez le nom légal de votre entreprise ou boutique.');
      return;
    }

    setSubmitting(true);
    const requestId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    try {
      const metadata = [];
      for (const file of documents) {
        const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90);
        const path = `${user.id}/${requestId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('account-verification-private')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        metadata.push({ path, name: file.name, mime_type: file.type, size: file.size });
      }

      const { error } = await (supabase as any).from('account_verification_requests').insert({
        id: requestId,
        user_id: user.id,
        request_type: kind,
        status: 'pending',
        applicant_name: applicantName.trim(),
        country_code: countryCode.trim().toUpperCase(),
        document_paths: metadata,
        business_name: kind === 'business' ? businessName.trim() : null,
        business_registration_number: kind === 'business' ? registrationNumber.trim() || null : null,
        business_description: kind === 'business' ? businessDescription.trim() || null : null,
        website_url: kind === 'business' ? websiteUrl.trim() || null : null,
        fee_amount_fcfa: FEES[kind],
        fee_currency: 'XOF',
        payment_status: 'not_configured',
      });
      if (error) throw error;

      setDocuments([]);
      setBusinessName('');
      setRegistrationNumber('');
      setBusinessDescription('');
      setWebsiteUrl('');
      toast.success('Votre demande a été envoyée à l’équipe Afrixa.');
      await loadRequests();
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from('account-verification-private').remove(uploadedPaths).catch(() => undefined);
      }
      console.error('Verification request submission failed', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l’envoi. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="font-bold">Vérification Afrixa</h1><p className="text-xs text-muted-foreground">Authenticité et confiance</p></div>
      </header>

      <section className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <div className="rounded-2xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">Choisissez votre vérification</h2></div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setKind('identity'); setDocuments([]); }} className={`rounded-xl border p-4 text-left ${kind === 'identity' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <BadgeCheck className="mb-2 h-6 w-6 text-primary" /><p className="font-semibold">Identité vérifiée</p><p className="mt-1 text-xs text-muted-foreground">Badge bleu après contrôle manuel de votre identité.</p><p className="mt-3 font-bold">1 500 FCFA</p><p className="text-xs text-muted-foreground">Délai cible : 3 à 5 jours ouvrables</p>
            </button>
            <button type="button" onClick={() => { setKind('business'); setDocuments([]); }} className={`rounded-xl border p-4 text-left ${kind === 'business' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <Building2 className="mb-2 h-6 w-6 text-primary" /><p className="font-semibold">Entreprise / boutique</p><p className="mt-1 text-xs text-muted-foreground">Contrôle des justificatifs commerciaux.</p><p className="mt-3 font-bold">5 000 FCFA</p><p className="text-xs text-muted-foreground">Délai cible : 5 à 7 jours ouvrables</p>
            </button>
          </div>
        </div>

        {alreadyVerified ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="font-semibold text-emerald-600">{kind === 'identity' ? 'Votre identité est déjà vérifiée.' : 'Votre entreprise ou boutique est déjà vérifiée.'}</p>
            <p className="mt-1 text-sm text-muted-foreground">Le badge officiel correspondant est actif sur votre profil.</p>
          </div>
        ) : activeRequest ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5" />Demande déjà en cours</div>
            <p className="mt-2 text-sm">Votre demande {kind === 'identity' ? 'd’identité' : 'd’entreprise'} est : <strong>{STATUS[activeRequest.status]}</strong>.</p>
            <p className="mt-1 text-xs text-muted-foreground">Soumise le {new Date(activeRequest.submitted_at).toLocaleDateString('fr-FR')}.</p>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-4">
            <div><h2 className="font-semibold">Formulaire de demande</h2><p className="text-xs text-muted-foreground">Les documents sont privés et accessibles uniquement à vous et au personnel autorisé d’Afrixa.</p></div>
            <div className="space-y-1"><label className="text-sm font-medium">Nom complet</label><Input value={applicantName} onChange={(event) => setApplicantName(event.target.value)} placeholder="Nom figurant sur le document officiel" /></div>
            <div className="space-y-1"><label className="text-sm font-medium">Code pays (ISO)</label><Input value={countryCode} maxLength={2} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} placeholder="BJ" /></div>

            {kind === 'business' && <div className="space-y-3 rounded-xl border border-border/50 p-3">
              <div className="space-y-1"><label className="text-sm font-medium">Nom légal de l’entreprise / boutique *</label><Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Nom enregistré" /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Numéro d’immatriculation (facultatif)</label><Input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} placeholder="RCCM, IFU..." /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Description de l’activité</label><Input value={businessDescription} onChange={(event) => setBusinessDescription(event.target.value)} placeholder="Activité principale" /></div>
              <div className="space-y-1"><label className="text-sm font-medium">Site web (facultatif)</label><Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://" /></div>
            </div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">Justificatifs (1 à 6 fichiers)</label>
              <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-border p-5 text-center hover:bg-muted/30">
                <UploadCloud className="mb-2 h-7 w-7 text-primary" /><span className="text-sm font-medium">Choisir des documents</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP ou PDF · 10 Mo maximum par fichier</span>
                <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => selectedFiles(event.target.files)} />
              </label>
              {documents.map((file) => <div key={file.name + file.size} className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4" /><span className="truncate">{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(1)} Mo</span></div>)}
            </div>

            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              Frais de traitement : <strong className="text-foreground">{FEES[kind].toLocaleString('fr-FR')} FCFA</strong>. Le paiement en ligne n’est pas encore activé : aucun montant ne sera débité depuis ce formulaire. La demande sera soumise pour examen, et les frais seront demandés via un parcours de paiement sécurisé lorsqu’il sera disponible.
            </div>
            <Button className="w-full" onClick={() => void submit()} disabled={submitting || !!activeRequest}>{submitting ? 'Envoi en cours…' : 'Soumettre ma demande'}</Button>
          </div>
        )}

        <div className="rounded-2xl border border-border/50 bg-card p-4">
          <h2 className="font-semibold">Historique de mes demandes</h2>
          {loading ? <p className="mt-3 text-sm text-muted-foreground">Chargement…</p> : requests.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aucune demande pour le moment.</p> : <div className="mt-3 divide-y divide-border/50">
            {requests.map((request) => <div key={request.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{request.request_type === 'identity' ? 'Identité vérifiée' : 'Entreprise / boutique vérifiée'}</p><span className="rounded-full bg-muted px-2 py-1 text-xs">{STATUS[request.status]}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(request.submitted_at).toLocaleDateString('fr-FR')} · {request.fee_amount_fcfa.toLocaleString('fr-FR')} FCFA</p>
              {request.rejection_reason && <p className="mt-2 text-xs text-destructive">Motif : {request.rejection_reason}</p>}
              {request.reviewer_note && <p className="mt-1 text-xs text-muted-foreground">{request.reviewer_note}</p>}
            </div>)}
          </div>}
        </div>
      </section>
    </main>
  );
};

export default AccountVerification;
