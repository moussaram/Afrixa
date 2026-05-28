/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { Star, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { CreatorBadge } from '@/components/creators/CreatorBadge';
import { CreatorPageShell } from './CreatorPageShell';

const levels = [
  { id: 'starter', label: 'Starter', required: 500, benefits: 'Accès stats basiques' },
  { id: 'rising', label: 'Rising', required: 5000, benefits: 'Afrixa Studio complet' },
  { id: 'verified', label: 'Verified', required: 50000, benefits: 'Priorité algorithme et support' },
  { id: 'elite', label: 'Elite', required: 500000, benefits: 'Revenus partagés et événements' },
];

const CreatorProgramPage = () => {
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const followers = Number((profile as any)?.followers_count || 0);

  const currentLevel = useMemo(() => {
    if (followers >= 500000) return 'elite';
    if (followers >= 50000) return 'verified';
    if (followers >= 5000) return 'rising';
    return 'starter';
  }, [followers]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const { data, error } = await (supabase as any).from('creator_program').select('*').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        setProgram(data);
      } catch (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger le Creator Program.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const joinProgram = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('creator_program')
        .insert({ user_id: user.id, level: currentLevel, followers_at_join: followers })
        .select()
        .single();
      if (error) throw error;
      setProgram(data);
      setConfirmOpen(false);
      toast({ title: 'Bienvenue dans le Creator Program', description: 'Ton badge créateur est actif.' });
    } catch (error) {
      toast({ title: 'Erreur', description: "L'inscription n'a pas pu être finalisée.", variant: 'destructive' });
    }
  };

  return (
    <CreatorPageShell title="Creator Program" subtitle="Badge, niveaux et avantages officiels Afrixa">
      {loading ? (
        <Skeleton className="h-40 rounded-2xl bg-[#2D2D4E]" />
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#9CA3AF]">Statut actuel</p>
              <div className="mt-2">{program ? <CreatorBadge level={program.level} /> : <span className="text-white">Non inscrit</span>}</div>
            </div>
            {!program && (
              <Button disabled={followers < 500} onClick={() => setConfirmOpen(true)} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
                <Star className="mr-2 h-4 w-4" />
                Rejoindre
              </Button>
            )}
          </div>
          {followers < 500 && <p className="mt-4 text-sm text-[#F59E0B]">Il faut au moins 500 abonnés pour rejoindre le programme.</p>}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {levels.map((level) => (
          <div key={level.id} className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <CreatorBadge level={level.id} />
            <div className="mt-4 flex items-center gap-2 text-sm text-[#9CA3AF]">
              <TrendingUp className="h-4 w-4 text-[#10B981]" />
              {level.required.toLocaleString('fr-FR')} abonnés requis
            </div>
            <p className="mt-2 text-sm text-white">{level.benefits}</p>
          </div>
        ))}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Confirmer l'inscription</DialogTitle>
            <DialogDescription>Ton compte sera ajouté au Creator Program avec le niveau correspondant à ton audience actuelle.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" onClick={joinProgram}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorPageShell>
  );
};

export default CreatorProgramPage;
