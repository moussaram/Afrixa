import { type Dispatch, type SetStateAction, useState } from 'react';
import { type NavigateFunction, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Zap, TrendingUp, Users, Eye, Star, Check,
  Play, BarChart3, CreditCard, Smartphone, Lock, ChevronDown,
  Target, Clock, MapPin, Video, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { mockVideos } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';

// ─── Data ─────────────────────────────────────────────────────────────────────

const boostPlans = [
  {
    id: 'starter', name: 'Starter', emoji: '🚀', price: 2.99, duration: 3,
    reach: '5K – 15K', impressions: '10K+',
    color: 'from-blue-500/15 to-blue-600/5', border: 'border-blue-500/40',
    badge: null,
    features: ['5 000 à 15 000 personnes', 'Ciblage centres d\'intérêt', 'Rapport basique', 'Support email'],
  },
  {
    id: 'growth', name: 'Growth', emoji: '⚡', price: 7.99, duration: 7,
    reach: '25K – 75K', impressions: '50K+',
    color: 'from-primary/15 to-secondary/5', border: 'border-primary/50',
    badge: 'Populaire',
    features: ['25 000 à 75 000 personnes', 'Ciblage âge & région', 'Rapport temps réel', 'Badge Sponsorisé', 'Support prioritaire'],
  },
  {
    id: 'viral', name: 'Viral', emoji: '🔥', price: 19.99, duration: 14,
    reach: '100K – 500K', impressions: '250K+',
    color: 'from-orange-500/15 to-red-500/5', border: 'border-orange-500/40',
    badge: 'Best Value',
    features: ['100K à 500K personnes', 'Ciblage multi-critères', 'Dashboard analytics', 'Section Trending', 'Support 24h/7j', 'A/B test auto'],
  },
  {
    id: 'enterprise', name: 'Pro Creator', emoji: '💎', price: 49.99, duration: 30,
    reach: '500K – 2M+', impressions: '1M+',
    color: 'from-purple-500/15 to-pink-500/5', border: 'border-purple-500/40',
    badge: 'Creator',
    features: ['500K à 2M+ personnes', 'Campagne multi-vidéos (×5)', 'Account Manager dédié', 'Analytics avancés', 'Placement "Pour Toi"', 'Badge vérifié temporaire'],
  },
];

const ageRanges = ['13–17', '18–24', '25–34', '35–44', '45–54', '55+'];
const interests = ['Musique', 'Mode', 'Sport', 'Cuisine', 'Tech', 'Beauté', 'Voyage', 'Gaming', 'Danse', 'Humour'];
const countries = ['Sénégal', 'Nigeria', 'Côte d\'Ivoire', 'Ghana', 'Cameroun', 'Mali', 'Burkina Faso', 'France', 'International'];

const paymentMethods = [
  { id: 'card', label: 'Carte bancaire', icon: CreditCard, desc: 'Visa, Mastercard, CB' },
  { id: 'orange', label: 'Orange Money', icon: Smartphone, desc: 'Orange Money Mobile' },
  { id: 'wave', label: 'Wave', icon: Smartphone, desc: 'Wave Mobile Money' },
  { id: 'mtn', label: 'MTN MoMo', icon: Smartphone, desc: 'MTN Mobile Money' },
];

type BoostPlan = (typeof boostPlans)[number];

interface Targeting {
  objective: string;
  ages: string[];
  interests: string[];
  countries: string[];
}

interface StepVideoSelectProps {
  selectedVideo: string | null;
  setSelectedVideo: (videoId: string) => void;
  onNext: () => void;
}

interface StepPlanProps {
  selected: string;
  setSelected: (planId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

interface StepTargetingProps {
  targeting: Targeting;
  setTargeting: Dispatch<SetStateAction<Targeting>>;
  onNext: () => void;
  onBack: () => void;
  plan: BoostPlan;
}

interface StepPaymentProps {
  plan: BoostPlan;
  onBack: () => void;
  onPay: () => void;
  videoId: string | null;
}

interface StepSuccessProps {
  plan: BoostPlan;
  navigate: NavigateFunction;
}

// ─── Step components ──────────────────────────────────────────────────────────

const StepVideoSelect = ({ selectedVideo, setSelectedVideo, onNext }: StepVideoSelectProps) => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">Quelle vidéo booster ?</h2>
      <p className="text-sm text-muted-foreground">Choisissez la vidéo que vous souhaitez promouvoir</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {mockVideos.slice(0, 6).map(video => (
        <button
          key={video.id}
          onClick={() => setSelectedVideo(video.id)}
          className={cn(
            "relative rounded-2xl overflow-hidden aspect-[9/16] border-2 transition-all duration-200",
            selectedVideo === video.id ? 'border-primary scale-[1.02] shadow-lg shadow-primary/20' : 'border-border/30'
          )}
        >
          <img loading="lazy" src={video.thumbnailUrl} alt={video.description} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-white text-xs font-medium line-clamp-2">{video.description}</p>
            <div className="flex items-center gap-1 mt-1">
              <Eye className="w-3 h-3 text-white/70" />
              <span className="text-white/70 text-xs">{video.views >= 1000 ? `${(video.views/1000).toFixed(0)}K` : video.views}</span>
            </div>
          </div>
          {selectedVideo === video.id && (
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full gradient-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </button>
      ))}
    </div>
    <Button variant="gradient" size="lg" className="w-full font-bold" disabled={!selectedVideo} onClick={onNext}>
      Continuer <ArrowRight className="w-4 h-4" />
    </Button>
  </div>
);

const StepPlan = ({ selected, setSelected, onNext, onBack }: StepPlanProps) => {
  const plan = boostPlans.find(p => p.id === selected)!;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Choisir un plan</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez le plan adapté à vos objectifs</p>
      </div>
      <div className="space-y-3">
        {boostPlans.map(p => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={cn(
              "w-full text-left rounded-2xl border-2 p-4 transition-all duration-200",
              `bg-gradient-to-r ${p.color}`,
              selected === p.id ? p.border + ' scale-[1.01] shadow-lg shadow-primary/10' : 'border-border/30'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{p.name}</span>
                    {p.badge && (
                      <span className="text-xs px-2 py-0.5 rounded-full gradient-primary text-primary-foreground font-semibold">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.duration} jours · {p.reach} personnes</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="text-xl font-bold text-foreground">{p.price}€</p>
                  <p className="text-xs text-muted-foreground">{p.duration} jours</p>
                </div>
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  selected === p.id ? 'border-primary bg-primary' : 'border-border/50'
                )}>
                  {selected === p.id && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
              </div>
            </div>
            {selected === p.id && (
              <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-2 gap-1.5">
                {p.features.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="glass" className="flex-1" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Retour</Button>
        <Button variant="gradient" className="flex-1 font-bold" onClick={onNext}>Continuer <ArrowRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

const StepTargeting = ({ targeting, setTargeting, onNext, onBack, plan }: StepTargetingProps) => {
  const toggleItem = (key: 'ages' | 'interests' | 'countries', val: string) => {
    setTargeting((prev) => ({
      ...prev,
      [key]: prev[key].includes(val) ? prev[key].filter((v: string) => v !== val) : [...prev[key], val]
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Ciblage de l'audience</h2>
        <p className="text-sm text-muted-foreground">Définissez qui verra votre vidéo</p>
      </div>

      {/* Objectif */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Objectif de la campagne</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'views', label: 'Vues', icon: Eye },
            { id: 'followers', label: 'Abonnés', icon: Users },
            { id: 'engagement', label: 'Engagement', icon: TrendingUp },
          ].map(o => (
            <button
              key={o.id}
              onClick={() => setTargeting((p) => ({ ...p, objective: o.id }))}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                targeting.objective === o.id ? 'border-primary bg-primary/10' : 'border-border/30 bg-muted/20'
              )}
            >
              <o.icon className={cn("w-5 h-5", targeting.objective === o.id ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn("text-xs font-semibold", targeting.objective === o.id ? 'text-primary' : 'text-muted-foreground')}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tranche d'âge */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tranche d'âge</h3>
        <div className="flex flex-wrap gap-2">
          {ageRanges.map(age => (
            <button
              key={age}
              onClick={() => toggleItem('ages', age)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                targeting.ages.includes(age) ? 'border-primary bg-primary/15 text-primary' : 'border-border/40 text-muted-foreground'
              )}
            >
              {age}
            </button>
          ))}
        </div>
      </div>

      {/* Centres d'intérêt */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Centres d'intérêt</h3>
        <div className="flex flex-wrap gap-2">
          {interests.map(i => (
            <button
              key={i}
              onClick={() => toggleItem('interests', i)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                targeting.interests.includes(i) ? 'border-primary bg-primary/15 text-primary' : 'border-border/40 text-muted-foreground'
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Pays */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />Pays ciblés
        </h3>
        <div className="flex flex-wrap gap-2">
          {countries.map(c => (
            <button
              key={c}
              onClick={() => toggleItem('countries', c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                targeting.countries.includes(c) ? 'border-primary bg-primary/15 text-primary' : 'border-border/40 text-muted-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="glass" className="flex-1" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Retour</Button>
        <Button variant="gradient" className="flex-1 font-bold" onClick={onNext}>Continuer <ArrowRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

const StepPayment = ({ plan, onBack, onPay, videoId }: StepPaymentProps) => {
  const [method, setMethod] = useState('card');
  const [cardNum, setCardNum] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCard = (val: string) => val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 4);
    return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d;
  };

  const isCard = method === 'card';
  const canPay = isCard ? (cardNum.replace(/\s/g,'').length === 16 && expiry.length === 5 && cvv.length === 3) : phone.length >= 8;

  const handlePay = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    onPay();
  };

  const tax = +(plan.price * 0.18).toFixed(2);
  const total = +(plan.price + tax).toFixed(2);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Paiement</h2>
        <p className="text-sm text-muted-foreground">Choisissez votre moyen de paiement</p>
      </div>

      {/* Récap commande */}
      <div className="glass rounded-2xl border border-border/30 p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{plan.emoji}</span>
          <span className="font-bold text-foreground">Plan {plan.name}</span>
          <span className="ml-auto text-sm text-muted-foreground">{plan.duration} jours</span>
        </div>
        <div className="space-y-1 text-sm border-t border-border/20 pt-2">
          <div className="flex justify-between text-muted-foreground">
            <span>Sous-total</span><span>{plan.price}€</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>TVA (18%)</span><span>{tax}€</span>
          </div>
          <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border/20 mt-1">
            <span>Total</span><span>{total}€</span>
          </div>
        </div>
      </div>

      {/* Méthodes */}
      <div className="grid grid-cols-2 gap-2">
        {paymentMethods.map(pm => (
          <button
            key={pm.id}
            onClick={() => setMethod(pm.id)}
            className={cn(
              "flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 transition-all text-left",
              method === pm.id ? 'border-primary bg-primary/10' : 'border-border/30 bg-muted/10'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <pm.icon className={cn("w-5 h-5", method === pm.id ? 'text-primary' : 'text-muted-foreground')} />
              <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", method === pm.id ? 'border-primary bg-primary' : 'border-border/50')}>
                {method === pm.id && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
              </div>
            </div>
            <span className={cn("text-sm font-semibold", method === pm.id ? 'text-primary' : 'text-foreground')}>{pm.label}</span>
            <span className="text-xs text-muted-foreground">{pm.desc}</span>
          </button>
        ))}
      </div>

      {/* Formulaire paiement */}
      <div className="glass rounded-2xl border border-border/30 p-4 space-y-3">
        {isCard ? (
          <>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Numéro de carte</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNum}
                  onChange={e => setCardNum(formatCard(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <div className="w-7 h-5 bg-blue-500 rounded text-white text-[8px] flex items-center justify-center font-bold">VISA</div>
                  <div className="w-7 h-5 bg-red-500 rounded text-white text-[8px] flex items-center justify-center font-bold">MC</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Expiration</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={e => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">CVV</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g,'').slice(0,3))}
                  placeholder="123"
                  className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Titulaire</label>
              <input
                type="text"
                placeholder="Nom sur la carte"
                className="w-full bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Numéro {method === 'orange' ? 'Orange Money' : method === 'wave' ? 'Wave' : 'MTN MoMo'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">+221</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,9))}
                placeholder="77 123 45 67"
                className="w-full bg-muted/30 border border-border/40 rounded-xl pl-16 pr-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Vous recevrez une notification de confirmation sur votre téléphone
            </p>
          </div>
        )}
      </div>

      {/* Sécurité */}
      <div className="flex items-center gap-2 justify-center">
        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Paiement sécurisé · Chiffrement SSL 256-bit</span>
      </div>

      <div className="flex gap-3">
        <Button variant="glass" className="flex-1" onClick={onBack} disabled={loading}>
          <ArrowLeft className="w-4 h-4" /> Retour
        </Button>
        <Button
          variant="gradient"
          className="flex-1 font-bold text-base"
          disabled={!canPay || loading}
          onClick={handlePay}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Traitement…
            </span>
          ) : (
            <><Zap className="w-4 h-4" /> Payer {total}€</>
          )}
        </Button>
      </div>
    </div>
  );
};

const StepSuccess = ({ plan, navigate }: StepSuccessProps) => (
  <div className="flex flex-col items-center text-center py-8 space-y-5">
    <div className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center animate-bounce-slow">
      <CheckCircle2 className="w-12 h-12 text-primary-foreground" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-2">🎉 Boost activé !</h2>
      <p className="text-muted-foreground max-w-xs">
        Votre campagne <strong>{plan.name}</strong> est en cours. Votre vidéo sera visible par <strong>{plan.reach} personnes</strong> pendant <strong>{plan.duration} jours</strong>.
      </p>
    </div>
    <div className="w-full glass rounded-2xl border border-border/30 p-5 space-y-3">
      <h3 className="font-semibold text-foreground text-sm text-left">Ce qui va se passer</h3>
      {[
        { icon: '🔍', text: 'Votre vidéo est en cours de vérification (< 2h)' },
        { icon: '📢', text: 'La campagne démarrera après approbation' },
        { icon: '📊', text: 'Rapport de performance disponible sous 24h' },
        { icon: '📧', text: 'Confirmation envoyée par email' },
      ].map((item, i) => (
        <div key={i} className="flex items-center gap-3 text-sm text-foreground/80">
          <span className="text-base">{item.icon}</span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
    <div className="flex flex-col gap-3 w-full">
      <Button variant="gradient" size="lg" className="w-full font-bold" onClick={() => navigate('/profile')}>
        <BarChart3 className="w-4 h-4 mr-2" />Voir mon profil
      </Button>
      <Button variant="glass" className="w-full" onClick={() => navigate('/')}>
        Retour au feed
      </Button>
    </div>
  </div>
);

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'video', label: 'Vidéo', icon: Video },
  { id: 'plan', label: 'Plan', icon: Zap },
  { id: 'targeting', label: 'Ciblage', icon: Target },
  { id: 'payment', label: 'Paiement', icon: CreditCard },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

const Boost = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [targeting, setTargeting] = useState({ objective: 'views', ages: [] as string[], interests: [] as string[], countries: [] as string[] });
  const [done, setDone] = useState(false);

  const plan = boostPlans.find(p => p.id === selectedPlan)!;
  const progress = ((step) / STEPS.length) * 100;

  const handlePay = () => setDone(true);

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-6 pb-10">
          <StepSuccess plan={plan} navigate={navigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">Booster ma vidéo</h1>
            <p className="text-xs text-muted-foreground">{STEPS[step]?.label} · Étape {step + 1}/{STEPS.length}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="px-4 pb-3">
          <Progress value={progress + 25} className="h-1.5" />
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center gap-0.5">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                  i < step ? 'gradient-primary' : i === step ? 'border-2 border-primary bg-primary/10' : 'border-2 border-border/40 bg-muted/20'
                )}>
                  {i < step ? (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  ) : (
                    <s.icon className={cn("w-3 h-3", i === step ? 'text-primary' : 'text-muted-foreground/50')} />
                  )}
                </div>
                <span className={cn("text-[10px]", i <= step ? 'text-primary font-medium' : 'text-muted-foreground/50')}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-5">
        {step === 0 && (
          <StepVideoSelect
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <StepPlan
            selected={selectedPlan}
            setSelected={setSelectedPlan}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepTargeting
            targeting={targeting}
            setTargeting={setTargeting}
            plan={plan}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepPayment
            plan={plan}
            videoId={selectedVideo}
            onBack={() => setStep(2)}
            onPay={handlePay}
          />
        )}
      </div>
    </div>
  );
};

export default Boost;
