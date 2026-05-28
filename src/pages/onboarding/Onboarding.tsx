import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Camera,
  Check,
  ChefHat,
  Dumbbell,
  Laugh,
  Music,
  Shirt,
  Sparkles,
  Plane,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { mockUsers } from '@/data/mockData';
import { useOnboarding } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

const interests = [
  { id: 'danse', label: 'Danse', icon: Sparkles },
  { id: 'musique', label: 'Musique', icon: Music },
  { id: 'mode', label: 'Mode', icon: Shirt },
  { id: 'tech', label: 'Tech', icon: Camera },
  { id: 'cuisine', label: 'Cuisine', icon: ChefHat },
  { id: 'sport', label: 'Sport', icon: Dumbbell },
  { id: 'humour', label: 'Humour', icon: Laugh },
  { id: 'beaute', label: 'Beaute', icon: Sparkles },
  { id: 'voyage', label: 'Voyage', icon: Plane },
  { id: 'business', label: 'Business', icon: Briefcase },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { state, save } = useOnboarding();
  const [step, setStep] = useState(Math.min(Math.max(state.step_completed + 1, 1), 5));
  const [selectedInterests, setSelectedInterests] = useState<string[]>(state.interests);
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const suggestedCreators = useMemo(() => mockUsers.slice(0, 6), []);
  const progress = (step / 5) * 100;

  const next = async () => {
    if (step === 2 && selectedInterests.length < 3) {
      toast.error('Choisis au moins 3 interets');
      return;
    }
    if (step === 3 && followedCreators.length < 1) {
      toast.error('Suis au moins 1 createur');
      return;
    }
    if (step === 5) {
      await save({ step_completed: 5, interests: selectedInterests, onboarding_done: true });
      navigate('/', { replace: true });
      return;
    }

    await save({ step_completed: step, interests: selectedInterests });
    setStep(current => current + 1);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };

  const toggleCreator = (id: string) => {
    setFollowedCreators(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };

  return (
    <main className="min-h-screen bg-background px-5 pb-8 pt-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col">
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{step}/5</span>
            <button type="button" onClick={() => navigate('/', { replace: true })}>
              Passer
            </button>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {step === 1 && (
          <section className="flex flex-1 flex-col justify-center text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground shadow-xl shadow-primary/20">
              <Sparkles className="h-12 w-12" />
            </div>
            <h1 className="text-4xl font-black tracking-normal">Bienvenue sur Afrixa</h1>
            <p className="mx-auto mt-4 max-w-xs text-base text-muted-foreground">
              Le reseau social africain pour creer, vendre, decouvrir et soutenir les talents.
            </p>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-3xl font-black">Choisis tes interets</h1>
            <p className="mt-2 text-sm text-muted-foreground">Selectionne au moins 3 univers pour personnaliser ton feed.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {interests.map(item => {
                const selected = selectedInterests.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleInterest(item.id)}
                    className={cn(
                      'flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 bg-card'
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-3xl font-black">Suis des createurs</h1>
            <p className="mt-2 text-sm text-muted-foreground">Les premiers abonnements aident Afrixa a calibrer tes recommandations.</p>
            <div className="mt-6 space-y-3">
              {suggestedCreators.map(creator => {
                const followed = followedCreators.includes(creator.id);
                return (
                  <button
                    key={creator.id}
                    type="button"
                    onClick={() => toggleCreator(creator.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={creator.avatar} alt={creator.username} />
                      <AvatarFallback>{creator.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{creator.username}</span>
                    </span>
                    <span className={cn('rounded-full p-2', followed ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                      {followed ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 4 && (
          <section>
            <h1 className="text-3xl font-black">Complete ton profil</h1>
            <p className="mt-2 text-sm text-muted-foreground">Ajoute une premiere bio. La photo pourra etre modifiee depuis ton profil.</p>
            <div className="mt-8 flex justify-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-card">
                <Camera className="h-9 w-9 text-primary" />
              </div>
            </div>
            <Textarea
              value={bio}
              onChange={event => setBio(event.target.value)}
              maxLength={160}
              placeholder="Createur, vendeur, fan de culture afro..."
              className="mt-8 min-h-28 rounded-2xl bg-card"
            />
          </section>
        )}

        {step === 5 && (
          <section className="flex flex-1 flex-col justify-center text-center">
            <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground">
              <Bell className="h-12 w-12" />
            </div>
            <h1 className="text-3xl font-black">Active les notifications</h1>
            <p className="mx-auto mt-4 max-w-xs text-sm text-muted-foreground">
              Recois les messages, commandes, lives et opportunites createur au bon moment.
            </p>
          </section>
        )}

        <div className="mt-auto pt-8">
          <Button onClick={next} className="h-14 w-full rounded-2xl text-base font-black">
            {step === 1 ? 'Commencer' : step === 5 ? 'Terminer' : 'Continuer'}
          </Button>
          {step === 5 && (
            <Button variant="ghost" onClick={next} className="mt-2 h-12 w-full rounded-2xl">
              Plus tard
            </Button>
          )}
        </div>
      </div>
    </main>
  );
};

export default Onboarding;
