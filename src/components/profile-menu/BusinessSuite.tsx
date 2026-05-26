import { useState } from 'react';
import { Building2, Globe, Tag, Mail, Phone, BarChart3, TrendingUp, Users, Zap, CheckCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const categories = [
  'Créateur de contenu', 'Musicien/Artiste', 'Mode & Beauté',
  'Alimentation & Boissons', 'Sport & Fitness', 'Voyage & Tourisme',
  'Technologie', 'Education', 'Santé & Bien-être', 'Business & Finance',
];

const businessFeatures = [
  { icon: BarChart3, label: 'Statistiques avancées', desc: 'Vues, portée, engagement détaillés' },
  { icon: TrendingUp, label: 'Analyse de performance', desc: 'Évolution de votre audience' },
  { icon: Users, label: 'Démographie', desc: 'Âge, localisation de vos abonnés' },
  { icon: Zap, label: 'Outils de promotion', desc: 'Booster vos vidéos facilement' },
];

export const BusinessSuite = () => {
  const [isBusinessMode, setIsBusinessMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'landing' | 'setup' | 'dashboard'>('landing');

  const handleActivate = () => {
    if (isBusinessMode) {
      setStep('dashboard');
    } else {
      setStep('setup');
    }
  };

  const handleSaveSetup = () => {
    if (!selectedCategory) {
      toast.error('Veuillez choisir une catégorie');
      return;
    }
    setIsBusinessMode(true);
    setStep('dashboard');
    toast.success('🎉 Compte Business activé !');
  };

  if (step === 'setup') {
    return (
      <div className="flex flex-col px-4 py-5 gap-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Configurer votre compte</h3>
          <p className="text-sm text-muted-foreground mt-1">Renseignez vos informations professionnelles</p>
        </div>

        {/* Category */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Catégorie d'activité *</p>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  selectedCategory === cat
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:border-primary/40'
                )}
              >
                {selectedCategory === cat && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Informations de contact</p>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Site web (optionnel)"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              className="pl-9 bg-muted/20 border-border/30"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Email professionnel (optionnel)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="pl-9 bg-muted/20 border-border/30"
            />
          </div>
        </div>

        <Button variant="gradient" onClick={handleSaveSetup} className="w-full">
          Activer le compte Business
        </Button>
      </div>
    );
  }

  if (step === 'dashboard') {
    return (
      <div className="flex flex-col px-4 py-5 gap-4">
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Compte Business Actif</p>
            <p className="text-xs text-muted-foreground">{selectedCategory || 'Créateur de contenu'}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Portée', value: '12.4K', icon: TrendingUp, color: 'text-primary' },
            { label: 'Abonnés', value: '1.2K', icon: Users, color: 'text-secondary' },
            { label: 'Engagement', value: '8.4%', icon: BarChart3, color: 'text-green-500' },
            { label: 'Boosts actifs', value: '2', icon: Zap, color: 'text-yellow-500' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card/30 rounded-xl p-3 border border-border/20">
                <Icon className={cn('w-5 h-5 mb-1.5', stat.color)} />
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Contact info */}
        {(website || email) && (
          <div className="bg-card/30 rounded-xl border border-border/20 divide-y divide-border/20">
            {website && (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{website}</span>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{email}</span>
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full border-border/30"
          onClick={() => setStep('setup')}
        >
          Modifier les informations
        </Button>
      </div>
    );
  }

  // Landing
  return (
    <div className="flex flex-col px-4 py-5 gap-5">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-8 h-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Afrixa Business</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          Accédez aux outils professionnels pour développer votre présence
        </p>
      </div>

      <div className="space-y-2">
        {businessFeatures.map((feat) => {
          const Icon = feat.icon;
          return (
            <div key={feat.label} className="flex items-center gap-3 bg-card/30 rounded-xl p-3 border border-border/20">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{feat.label}</p>
                <p className="text-xs text-muted-foreground">{feat.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
          );
        })}
      </div>

      <Button variant="gradient" onClick={handleActivate} className="w-full">
        {isBusinessMode ? 'Accéder au tableau de bord' : 'Passer en compte Business'}
      </Button>
      <p className="text-xs text-muted-foreground text-center">Gratuit · Accès instantané</p>
    </div>
  );
};
