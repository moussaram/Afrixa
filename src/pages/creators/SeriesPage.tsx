/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/hooks/use-toast';
import { SeriesCard } from '@/components/creators/SeriesCard';
import { useSeries } from '@/hooks/useSeries';
import { CreatorPageShell } from './CreatorPageShell';

const SeriesPage = () => {
  const { user } = useAuth();
  const { series, loading, retry } = useSeries();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createSeries = async () => {
    if (!user?.id || !title.trim()) {
      toast({ title: 'Titre requis', description: 'Ajoute un titre pour créer la série.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from('series')
        .insert({ creator_id: user.id, title: title.trim(), description: description.trim() || null });
      if (error) throw error;
      toast({ title: 'Série créée', description: 'Tu pourras y ajouter des épisodes lors de tes prochains uploads.' });
      setOpen(false);
      setTitle('');
      setDescription('');
      retry();
    } catch (error) {
      toast({ title: 'Erreur', description: "La série n'a pas pu être créée.", variant: 'destructive' });
    }
  };

  return (
    <CreatorPageShell
      title="Séries épisodiques"
      subtitle="Organise tes vidéos en saisons et épisodes"
      action={<Button className="bg-[#7C3AED]" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Créer</Button>}
    >
      {loading ? (
        <Skeleton className="h-80 rounded-2xl bg-[#2D2D4E]" />
      ) : series.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-6 text-center">
          <h2 className="text-lg font-bold text-white">Aucune série pour le moment</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">Crée une série pour regrouper tes vidéos et prévenir tes abonnés à chaque nouvel épisode.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {series.map((item) => <SeriesCard key={item.id} series={item} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Créer une série</DialogTitle>
            <DialogDescription>Les épisodes seront ajoutés depuis l’upload vidéo.</DialogDescription>
          </DialogHeader>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de la série" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" onClick={createSeries}>Créer la série</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorPageShell>
  );
};

export default SeriesPage;
