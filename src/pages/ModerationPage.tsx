/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';

type Report = {
  id: string;
  content_type: string;
  content_id: string;
  reason: string;
  description: string | null;
  status: string;
  auto_hidden: boolean;
  created_at: string;
  reporter_username: string | null;
  target_user_id: string | null;
  target_username: string | null;
  reports_on_content: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  reviewed: 'Examiné',
  action_taken: 'Sanction prise',
  dismissed: 'Classé',
};

const ACTIONS = [
  { value: 'dismiss', label: 'Classer' },
  { value: 'warning', label: 'Avertir' },
  { value: 'restrict_24h', label: 'Restreindre 24 h' },
  { value: 'ban_7days', label: 'Bannir 7 jours' },
  { value: 'ban_permanent', label: 'Bannir définitivement' },
] as const;

const ModerationPage = () => {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('list_moderation_reports', {
      p_status: status === 'all' ? null : status,
      p_limit: 50,
    });
    if (error) {
      console.error('Unable to load moderation reports', error);
      toast.error('Impossible de charger la file de modération.');
      setReports([]);
    } else {
      setReports(data ?? []);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void (async () => {
      if (!user?.id) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      const { data, error } = await (supabase as any).rpc('is_platform_admin');
      if (error) {
        console.error('Unable to check moderator status', error);
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(data === true);
      if (data === true) await load(statusFilter);
      else setLoading(false);
    })();
  }, [user?.id, load, statusFilter]);

  const decide = async (report: Report, action: string) => {
    if (action.startsWith('ban_') || action === 'restrict_24h') {
      const confirmed = window.confirm(
        `Appliquer « ${ACTIONS.find((entry) => entry.value === action)?.label} » à @${report.target_username ?? 'cet utilisateur'} ?`,
      );
      if (!confirmed) return;
    }
    setPendingId(report.id);
    try {
      const { error } = await (supabase as any).rpc('moderate_report', {
        p_report_id: report.id,
        p_action: action,
        p_note: notes[report.id]?.trim() || null,
        p_hide_content: true,
      });
      if (error) throw error;
      toast.success('Décision enregistrée.');
      await load();
    } catch (decisionError) {
      console.error('Unable to moderate report', decisionError);
      toast.error('La décision n’a pas pu être enregistrée.');
    } finally {
      setPendingId(null);
    }
  };

  if (allowed === false) {
    return (
      <main className="min-h-screen bg-background px-4 pb-24 pt-10">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-black">Accès réservé</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cette page est réservée aux modérateurs Afrixa.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <ShieldAlert className="h-6 w-6 text-primary" /> Modération
        </h1>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['pending', 'En attente'],
          ['action_taken', 'Sanctionnées'],
          ['dismissed', 'Classées'],
          ['all', 'Tout'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        {loading && (
          <>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </>
        )}

        {!loading && reports.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucun signalement dans cette vue.
          </p>
        )}

        {!loading && reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">
                  {report.content_type} · {STATUS_LABELS[report.status] ?? report.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cible @{report.target_username ?? 'inconnu'} · signalé par @{report.reporter_username ?? 'inconnu'} ·{' '}
                  {new Date(report.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                {report.reports_on_content} signalement(s)
              </span>
            </div>

            <p className="mt-2 text-sm">{report.reason}</p>
            {report.description && (
              <p className="text-xs text-muted-foreground">{report.description}</p>
            )}
            {report.auto_hidden && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Contenu masqué automatiquement après plusieurs signalements.
              </p>
            )}

            {report.status === 'pending' ? (
              <>
                <Input
                  value={notes[report.id] ?? ''}
                  onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                  placeholder="Note de modération (motif de la sanction)"
                  className="mt-3"
                  maxLength={300}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {ACTIONS.map((action) => (
                    <Button
                      key={action.value}
                      size="sm"
                      variant={action.value === 'dismiss' ? 'outline' : action.value === 'warning' ? 'secondary' : 'destructive'}
                      disabled={pendingId === report.id}
                      onClick={() => void decide(report, action.value)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Décision : {report.status === 'dismissed' ? 'classé sans suite' : 'sanction appliquée'}.
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
};

export default ModerationPage;
