/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type ReviewRequest = {
  id: string; user_id: string; subscription_id: string; status: string;
  legal_name: string; document_type: string; issuing_country: string;
  applicant_note: string | null; decision_reason: string | null;
  submitted_at: string;
};

const IdentityVerificationAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reviewerRole, setReviewerRole] = useState('reviewer');
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [filter, setFilter] = useState('submitted');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, { index: number; document_url: string }[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('identity-verification', {
      body: { action: 'review_queue', status: filter },
    });
    if (error || data?.error) {
      console.error('Identity review queue failed', error ?? data?.error);
      setAllowed(false);
      setRequests([]);
      setLoading(false);
      return;
    }
    setAllowed(true);
    setReviewerRole(data?.reviewer_role ?? 'reviewer');
    setRequests(data?.requests ?? []);
    setLoading(false);
  }, [user?.id, filter]);

  useEffect(() => { void load(); }, [load]);

  const openDocument = async (request: ReviewRequest) => {
    setBusyId(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: { action: 'review_document', request_id: request.id },
      });
      if (error || data?.error || !Array.isArray(data?.documents) || data.documents.length === 0) throw error ?? new Error(data?.error ?? 'Documents indisponibles');
      setDocumentUrls((current) => ({ ...current, [request.id]: data.documents }));
    } catch (error: any) {
      console.error('Unable to open identity document', error);
      toast.error('Impossible d’ouvrir le justificatif.');
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (request: ReviewRequest, decision: string) => {
    const reason = (reasons[request.id] ?? '').trim();
    if (['needs_information', 'rejected', 'revoked'].includes(decision) && reason.length < 3) {
      toast.error('Indique un motif clair pour cette décision.');
      return;
    }
    setBusyId(request.id);
    try {
      const { data, error } = await supabase.functions.invoke('identity-verification', {
        body: {
          action: 'review_decide',
          request_id: request.id,
          decision,
          reason,
          internal_note: notes[request.id] ?? '',
        },
      });
      if (error || data?.error) throw error ?? new Error(data?.error);
      toast.success('Décision enregistrée.');
      await load();
    } catch (error: any) {
      console.error('Identity review decision failed', error);
      toast.error(error?.message ?? 'Impossible d’enregistrer cette décision.');
    } finally {
      setBusyId(null);
    }
  };

  if (allowed === false) {
    return (
      <main className="min-h-screen bg-background px-4 pt-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-destructive" />
          <h1 className="text-xl font-black">Accès réservé</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ton compte n’est pas habilité à examiner les demandes d’identité.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate(-1)}>Retour</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Afrixa · Équipe</p>
              <h1 className="text-2xl font-black">Vérification d’identité</h1>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ['submitted', 'Nouvelles demandes'],
            ['under_review', 'En examen'],
            ['needs_information', 'Compléments'],
            ['approved', 'Approuvées'],
            ['rejected', 'Refusées'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${filter === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        <section className="mt-4 space-y-4">
          {loading && <p className="py-10 text-center text-sm text-muted-foreground">Chargement des dossiers…</p>}
          {!loading && requests.length === 0 && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Aucun dossier dans cette catégorie.</p>}
          {!loading && requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{request.legal_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.document_type === 'national_id' ? 'Carte nationale d’identité' : request.document_type === 'passport' ? 'Passeport' : 'Titre de séjour'}
                    {' · '}{request.issuing_country} · {new Date(request.submitted_at).toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Compte : {request.user_id}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{request.status}</span>
              </div>
              {request.applicant_note && <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">{request.applicant_note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {documentUrls[request.id] ? (
                  documentUrls[request.id].map((document) => (
                    <a key={document.index} href={document.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary">
                      <FileText className="mr-2 h-4 w-4" /> Pièce {document.index} (lien temporaire)
                    </a>
                  ))
                ) : (
                  <Button size="sm" variant="outline" disabled={busyId === request.id} onClick={() => void openDocument(request)}>
                    <FileText className="mr-2 h-4 w-4" /> Préparer les liens privés des pièces
                  </Button>
                )}
              </div>
              {request.decision_reason && <p className="mt-2 text-xs text-muted-foreground">Motif précédent : {request.decision_reason}</p>}
              {request.status === 'approved' && reviewerRole === 'supervisor' && (
                <div className="mt-4 space-y-3">
                  <Textarea value={reasons[request.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Motif obligatoire de révocation" maxLength={1000} />
                  <Button size="sm" variant="destructive" disabled={busyId === request.id} onClick={() => void decide(request, 'revoked')}>Révoquer le badge</Button>
                </div>
              )}
              {['submitted', 'under_review', 'needs_information'].includes(request.status) && (
                <div className="mt-4 space-y-3">
                  <Textarea value={reasons[request.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Motif communiqué au demandeur (obligatoire pour complément ou refus)" maxLength={1000} />
                  <Textarea value={notes[request.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Note interne facultative" maxLength={2000} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busyId === request.id} onClick={() => void decide(request, 'under_review')}>Prendre en charge</Button>
                    <Button size="sm" variant="secondary" disabled={busyId === request.id} onClick={() => void decide(request, 'needs_information')}>Demander un complément</Button>
                    <Button size="sm" variant="gradient" disabled={busyId === request.id} onClick={() => void decide(request, 'approved')}><BadgeCheck className="mr-1 h-4 w-4" /> Approuver</Button>
                    <Button size="sm" variant="destructive" disabled={busyId === request.id} onClick={() => void decide(request, 'rejected')}>Refuser</Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
};

export default IdentityVerificationAdmin;
