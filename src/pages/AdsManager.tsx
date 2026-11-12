import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Pause, Play, Plus, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { useAds } from '@/hooks/useAds';
import { formatFCFA } from '@/lib/creatorFormatters';

const INTERESTS = ['Musique', 'Mode', 'Sport', 'Cuisine', 'Tech', 'Beauté', 'Voyage', 'Gaming', 'Danse', 'Humour'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de paiement',
  active: 'Active',
  paused: 'En pause',
  completed: 'Terminée',
  rejected: 'Refusée',
};

const AdsManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaigns, pricing, loading, error, refresh, create, pay, togglePause } = useAds();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [ctaText, setCtaText] = useState('Découvrir');
  const [ctaUrl, setCtaUrl] = useState('');
  const [budget, setBudget] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [interests, setInterests] = useState<string[]>([]);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const minimum = pricing?.min_budget_fcfa ?? 5000;
  const cpc = pricing?.cpc_fcfa ?? 50;

  const toggleInterest = (value: string) => {
    setInterests((current) => current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]);
  };

  const submit = async () => {
    if (!user?.id) {
      toast.error('Connecte-toi pour créer une campagne.');
      navigate('/auth/login');
      return;
    }
    const value = Number(budget);
    if (title.trim().length < 3 || !mediaUrl.startsWith('https://') || !ctaUrl.startsWith('https://')) {
      toast.error('Renseigne un titre, un visuel https et un lien https.');
      return;
    }
    if (!Number.isFinite(value) || value < minimum) {
      toast.error(`Le budget minimum est de ${formatFCFA(minimum)}.`);
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      toast.error('Renseigne un numéro Mobile Money valide.');
      return;
    }
    setSubmitting(true);
    try {
      const campaign = await create({
        title: title.trim(),
        description: description.trim(),
        mediaUrl: mediaUrl.trim(),
        ctaText: ctaText.trim(),
        ctaUrl: ctaUrl.trim(),
        budget: value,
        durationDays: Number(durationDays) || 7,
        interests,
      });
      await pay(campaign.campaignId, phone);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : '';
      toast.error(
        message === 'checkout_creation_failed' || message === 'payment_unavailable'
          ? 'Le paiement est momentanément indisponible.'
          : message || 'Impossible de créer la campagne.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-24 pt-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Megaphone className="h-6 w-6 text-primary" /> Afrixa Ads
        </h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Campagne
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        CPC {formatFCFA(cpc)} · budget minimum {formatFCFA(minimum)} · le budget est payé par FedaPay avant diffusion.
      </p>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      <section className="mt-6 space-y-3">
        {loading && campaigns.length === 0 && (
          <>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Aucune campagne pour le moment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crée une campagne, paie le budget et suis ses impressions et clics réels.
            </p>
          </div>
        )}

        {campaigns.map((campaign) => {
          const remaining = Math.max(campaign.budget - campaign.spent, 0);
          const spentPercent = campaign.budget > 0 ? Math.min((campaign.spent / campaign.budget) * 100, 100) : 0;
          const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
          return (
            <article key={campaign.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black">{campaign.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABELS[campaign.status] ?? campaign.status}
                    {campaign.starts_at ? ` · depuis le ${new Date(campaign.starts_at).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                  {campaign.rejection_reason && (
                    <p className="text-xs text-destructive">{campaign.rejection_reason}</p>
                  )}
                </div>
                {(campaign.status === 'active' || campaign.status === 'paused') && (
                  <Button size="sm" variant="outline" onClick={() => void togglePause(campaign).catch(() => toast.error('Action impossible.'))}>
                    {campaign.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/40 p-2">
                  <p className="text-sm font-bold">{campaign.impressions.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] text-muted-foreground">Impressions</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-2">
                  <p className="text-sm font-bold">{campaign.clicks.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] text-muted-foreground">Clics</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-2">
                  <p className="text-sm font-bold">{ctr.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatFCFA(campaign.spent)} dépensés</span>
                  <span>{formatFCFA(remaining)} restants</span>
                </div>
                <Progress value={spentPercent} className="mt-1 h-1.5" />
              </div>

              {campaign.status === 'pending' && (
                <p className="mt-3 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                  Paiement incomplet : la campagne démarrera après confirmation FedaPay.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle campagne</DialogTitle>
            <DialogDescription>
              CPC {formatFCFA(cpc)} · budget minimum {formatFCFA(minimum)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de la campagne" maxLength={100} />
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" maxLength={300} />
            <Input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="Visuel (URL https)" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={ctaText} onChange={(event) => setCtaText(event.target.value)} placeholder="Bouton" maxLength={30} />
              <Input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="Lien destination (https)" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={budget} onChange={(event) => setBudget(event.target.value.replace(/[^\d]/g, ''))} placeholder={`Budget FCFA (min ${minimum})`} inputMode="numeric" />
              <Input value={durationDays} onChange={(event) => setDurationDays(event.target.value.replace(/[^\d]/g, ''))} placeholder="Durée (jours)" inputMode="numeric" />
            </div>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Numéro Mobile Money pour le paiement" inputMode="tel" />
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Centres d’intérêt (optionnel, 10 max)</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      interests.includes(interest)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Ouverture…' : 'Créer et payer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdsManager;
