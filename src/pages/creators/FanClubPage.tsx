/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { toast } from '@/hooks/use-toast';
import { FanClubCard } from '@/components/creators/FanClubCard';
import { CreatorPageShell } from './CreatorPageShell';

const FanClubPage = () => {
  const { user, profile } = useAuth();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('1000');

  const load = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any).from('fan_clubs').select('*').eq('creator_id', user.id).maybeSingle();
      if (error) throw error;
      setClub(data);
      setName(data?.name || `VIP ${profile?.username || 'Afrixa'}`);
      setDescription(data?.description || '');
      setPrice(String(data?.price_monthly || 1000));
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger le Fan Club.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveClub = async () => {
    if (!user?.id) return;
    try {
      const payload = {
        creator_id: user.id,
        name,
        description,
        price_monthly: Number(price),
        perks: ['Vidéos exclusives', 'Badge Fan', 'Chat privé membres'],
        is_active: true,
      };
      const { data, error } = await (supabase as any).from('fan_clubs').upsert(payload, { onConflict: 'creator_id' }).select().single();
      if (error) throw error;
      setClub(data);
      setOpen(false);
      toast({ title: 'Fan Club activé', description: 'Les abonnements premium sont prêts côté créateur.' });
    } catch (error) {
      toast({ title: 'Erreur', description: "Le Fan Club n'a pas pu être enregistré.", variant: 'destructive' });
    }
  };

  return (
    <CreatorPageShell title="Fan Club" subtitle="Abonnement premium pour contenus exclusifs">
      {loading ? (
        <Skeleton className="h-72 rounded-2xl bg-[#2D2D4E]" />
      ) : (
        <>
          <FanClubCard
            name={club?.name || `VIP ${profile?.username || 'Afrixa'}`}
            description={club?.description || undefined}
            priceMonthly={club?.price_monthly || Number(price)}
            perks={club?.perks || undefined}
          />
          <Button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] sm:w-auto" onClick={() => setOpen(true)}>
            <Crown className="mr-2 h-4 w-4" />
            {club ? 'Modifier mon Fan Club' : 'Activer mon Fan Club'}
          </Button>
          <div className="rounded-2xl border border-white/10 bg-[#1A1A2E] p-4">
            <h2 className="font-bold text-white">Contenu exclusif</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">Lors de l’upload, les vidéos pourront être marquées “Fan Club uniquement”. Les non-membres verront un cadenas.</p>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[#1A1A2E] text-white">
          <DialogHeader>
            <DialogTitle>Configurer le Fan Club</DialogTitle>
            <DialogDescription>Commission : 80% créateur, 20% Afrixa.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom du Fan Club" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger><SelectValue placeholder="Prix mensuel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="500">500 FCFA / mois</SelectItem>
              <SelectItem value="1000">1 000 FCFA / mois</SelectItem>
              <SelectItem value="2000">2 000 FCFA / mois</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button className="bg-[#7C3AED]" onClick={saveClub}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorPageShell>
  );
};

export default FanClubPage;
