import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Phone, Search, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { africanCountries, type AfricanCountry } from '@/data/africanCountries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// All dial codes from african countries + popular ones
const DIAL_CODES = [
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+1', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
  ...africanCountries.map(c => ({ code: c.dialCode, flag: c.flag, name: c.name }))
].filter((v, i, a) => a.findIndex(t => t.code === v.code) === i);

const TOTAL_STEPS = 3;

interface FormData {
  nom: string;
  prenom: string;
  deuxieme_prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  profession: string;
  dialCode: string;
  dialFlag: string;
  numero: string;
  password: string;
  confirmPassword: string;
  nationalite: AfricanCountry | null;
}

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDialPicker, setShowDialPicker] = useState(false);
  const [dialSearch, setDialSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  const [form, setForm] = useState<FormData>({
    nom: '',
    prenom: '',
    deuxieme_prenom: '',
    date_naissance: '',
    lieu_naissance: '',
    profession: '',
    dialCode: '+225',
    dialFlag: '🇨🇮',
    numero: '',
    password: '',
    confirmPassword: '',
    nationalite: null,
  });

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const filteredDials = DIAL_CODES.filter(d =>
    d.name.toLowerCase().includes(dialSearch.toLowerCase()) ||
    d.code.includes(dialSearch)
  );

  const filteredCountries = africanCountries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validateStep1 = () => {
    if (!form.nom.trim()) { toast.error('Le nom est requis'); return false; }
    if (!form.prenom.trim()) { toast.error('Le prénom est requis'); return false; }
    if (!form.date_naissance) { toast.error('La date de naissance est requise'); return false; }
    if (!form.lieu_naissance.trim()) { toast.error('Le lieu de naissance est requis'); return false; }
    if (!form.profession.trim()) { toast.error('La profession est requise'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!form.numero.trim()) { toast.error('Le numéro mobile est requis'); return false; }
    if (form.numero.replace(/\D/g, '').length < 6) { toast.error('Numéro mobile invalide'); return false; }
    if (form.password.length < 8) { toast.error('Le mot de passe doit contenir au moins 8 caractères'); return false; }
    if (form.password !== form.confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return false; }
    return true;
  };

  const handleNext = async () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2) {
      if (!validateStep2()) return;
      await handleRegister();
      return;
    }
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const phone = `${form.dialCode}${form.numero.replace(/\D/g, '')}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { data: { phone } }
      });
      if (error) {
        toast.error(error.message || 'Erreur envoi OTP');
        return;
      }
      // Passer à l'OTP avec les données du formulaire
      navigate('/auth/verify-otp', {
        state: {
          phone,
          formData: form,
          mode: 'register'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) toast.error('Erreur Google');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-safe pt-12 pb-4">
        <button
          onClick={() => step === 1 ? navigate('/auth/login') : setStep(s => s - 1)}
          className="w-10 h-10 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {[1, 2].map(i => (
            <div key={i} className={cn(
              'rounded-full transition-all duration-300',
              i === step ? 'w-6 h-2.5 gradient-primary' :
              i < step ? 'w-2.5 h-2.5 bg-primary/60' : 'w-2.5 h-2.5 bg-muted'
            )} />
          ))}
        </div>
        <div className="w-10" />
      </header>

      {/* Step 1: Identité */}
      {step === 1 && (
        <div className="flex-1 flex flex-col px-6 pt-4 gap-6 overflow-y-auto pb-6">
          <div>
            <h2 className="text-2xl font-black text-foreground">Créer un compte</h2>
            <p className="text-muted-foreground mt-1 text-sm">Inscrivez-vous pour rejoindre Afrixa</p>
          </div>

          {/* Google signup - premier choix */}
          <div className="space-y-3">
            <Button variant="outline" className="w-full h-13 rounded-2xl font-semibold border-border/40 bg-muted/20 gap-3" onClick={handleGoogle}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Inscription rapide — Vous pourrez compléter vos informations dans les paramètres
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-xs text-muted-foreground">ou s'inscrire avec un numéro</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          <div className="space-y-4">
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
                placeholder="Ingénieur, Étudiant, Entrepreneur..." className="h-12 rounded-xl bg-muted/30 border-border/30" />
            </div>

            {/* Nationalité */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nationalité</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un pays africain..."
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl bg-muted/30 border-border/30"
                />
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
        </div>
      )}

      {/* Step 2: Mobile + Mot de passe */}
      {step === 2 && (
        <div className="flex-1 flex flex-col px-6 pt-4 gap-6">
          <div>
            <h2 className="text-2xl font-black text-foreground">Sécuriser le compte</h2>
            <p className="text-muted-foreground mt-1 text-sm">Numéro mobile et mot de passe</p>
          </div>

          <div className="space-y-4">
            {/* Phone */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Numéro mobile *</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDialPicker(p => !p)}
                  className="flex items-center gap-1.5 px-3 h-12 rounded-xl bg-muted/30 border border-border/30 min-w-[80px] shrink-0"
                >
                  <span className="text-lg">{form.dialFlag}</span>
                  <span className="text-sm font-medium">{form.dialCode}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                <Input
                  type="tel"
                  placeholder="07 00 00 00 00"
                  value={form.numero}
                  onChange={e => setField('numero', e.target.value)}
                  className="flex-1 h-12 rounded-xl bg-muted/30 border-border/30"
                />
              </div>
              {showDialPicker && (
                <div className="mt-1 rounded-xl border border-border/30 bg-background shadow-lg overflow-hidden">
                  <div className="p-2">
                    <Input
                      placeholder="Rechercher indicatif..."
                      value={dialSearch}
                      onChange={e => setDialSearch(e.target.value)}
                      className="h-9 rounded-lg bg-muted/20 border-border/20 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredDials.slice(0, 20).map(d => (
                      <button key={d.code + d.name} onClick={() => {
                        setField('dialCode', d.code);
                        setField('dialFlag', d.flag);
                        setShowDialPicker(false);
                        setDialSearch('');
                      }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/30 text-left">
                        <span className="text-lg w-7">{d.flag}</span>
                        <span className="text-sm text-foreground flex-1">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Un code de vérification sera envoyé par SMS</p>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Mot de passe * (min. 8 caractères)</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  className="h-12 rounded-xl bg-muted/30 border-border/30 pr-12"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-1.5 flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={cn('h-1 flex-1 rounded-full transition-all',
                      form.password.length >= i * 3 ? (
                        form.password.length >= 12 ? 'bg-primary' :
                        form.password.length >= 8 ? 'bg-primary/60' : 'bg-destructive'
                      ) : 'bg-muted'
                    )} />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Confirmer le mot de passe *</label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => setField('confirmPassword', e.target.value)}
                  className="h-12 rounded-xl bg-muted/30 border-border/30 pr-12"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {form.confirmPassword && (
                <p className={cn('text-xs mt-1', form.password === form.confirmPassword ? 'text-primary' : 'text-destructive')}>
                  {form.password === form.confirmPassword ? '✓ Les mots de passe correspondent' : '✗ Ne correspondent pas'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="px-6 pb-10 pt-4">
        <Button
          variant="gradient"
          className="w-full h-14 text-base font-bold rounded-2xl gap-2"
          onClick={handleNext}
          disabled={loading}
        >
          {loading ? 'Envoi du code SMS...' :
           step === 2 ? <><Phone className="w-5 h-5" /> Vérifier mon numéro</> :
           <> Continuer <ArrowRight className="w-5 h-5" /></>}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Déjà un compte ?{' '}
          <Link to="/auth/login" className="text-primary underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
