import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { africanCountries, type AfricanCountry } from '@/data/africanCountries';
import { toast } from 'sonner';

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    deuxieme_prenom: '',
    date_naissance: '',
    lieu_naissance: '',
    profession: '',
    nationalite: null as AfricanCountry | null,
  });

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const filteredCountries = africanCountries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const handleComplete = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.date_naissance || !form.lieu_naissance.trim() || !form.profession.trim()) {
      toast.error('Remplissez tous les champs obligatoires');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const username = `${form.prenom.toLowerCase().replace(/\s/g, '_')}_${Math.floor(Math.random() * 9999)}`;
      const { error } = await supabase.from('profiles').update({
        nom: form.nom,
        prenom: form.prenom,
        deuxieme_prenom: form.deuxieme_prenom || null,
        date_naissance: form.date_naissance,
        lieu_naissance: form.lieu_naissance,
        profession: form.profession,
        nationalite: form.nationalite?.name || null,
        nationalite_flag: form.nationalite?.flag || null,
        email_verifie: true,
        username,
        inscription_complete: true,
      }).eq('user_id', user.id);

      if (error) { toast.error('Erreur de mise à jour'); return; }
      await refreshProfile();
      toast.success(`Bienvenue sur Afrixa, ${form.prenom} ! 🎉`);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-4 pt-12 pb-4">
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">Compléter le profil</h2>
          <p className="text-muted-foreground mt-1 text-sm">Quelques informations supplémentaires</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nom *</label>
            <Input value={form.nom} onChange={e => setField('nom', e.target.value)}
              placeholder="Kouassi" className="h-12 rounded-xl bg-muted/30 border-border/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Prénom *</label>
            <Input value={form.prenom} onChange={e => setField('prenom', e.target.value)}
              placeholder="Jean" className="h-12 rounded-xl bg-muted/30 border-border/30" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Deuxième prénom</label>
          <Input value={form.deuxieme_prenom} onChange={e => setField('deuxieme_prenom', e.target.value)}
            placeholder="Optionnel" className="h-12 rounded-xl bg-muted/30 border-border/30" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Date de naissance *</label>
          <Input type="date" value={form.date_naissance} onChange={e => setField('date_naissance', e.target.value)}
            max={new Date(Date.now() - 13 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            className="h-12 rounded-xl bg-muted/30 border-border/30" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Lieu de naissance *</label>
          <Input value={form.lieu_naissance} onChange={e => setField('lieu_naissance', e.target.value)}
            placeholder="Abidjan, Côte d'Ivoire" className="h-12 rounded-xl bg-muted/30 border-border/30" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Profession *</label>
          <Input value={form.profession} onChange={e => setField('profession', e.target.value)}
            placeholder="Ingénieur, Étudiant..." className="h-12 rounded-xl bg-muted/30 border-border/30" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nationalité</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
              className="pl-9 h-11 rounded-xl bg-muted/30 border-border/30" />
          </div>
          {form.nationalite && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-xl">{form.nationalite.flag}</span>
              <span className="text-sm font-medium">{form.nationalite.name}</span>
              <Check className="w-4 h-4 text-primary ml-auto" />
            </div>
          )}
          {countrySearch && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border/30 bg-background shadow-lg">
              {filteredCountries.slice(0, 8).map(c => (
                <button key={c.code} onClick={() => { setField('nationalite', c); setCountrySearch(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/30 text-left">
                  <span className="text-lg">{c.flag}</span>
                  <span className="text-sm">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-10 pt-4">
        <Button variant="gradient" className="w-full h-14 text-base font-bold rounded-2xl gap-2"
          onClick={handleComplete} disabled={loading}>
          {loading ? 'Création...' : <><ArrowRight className="w-5 h-5" /> Rejoindre Afrixa</>}
        </Button>
      </div>
    </div>
  );
};

export default CompleteProfile;
