import { useEffect, useState } from 'react';
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
import { useAuth } from '@/contexts/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { enableWebPush } from '@/lib/firebase/messaging';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/validation';

interface SuggestedCreator {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
}

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
  const { user, profile, refreshProfile } = useAuth();
  const { state, loading, save } = useOnboarding();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [followedCreators, setFollowedCreators] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [pushLoading, setPushLoading] = useState(false);
  const [suggestedCreators, setSuggestedCreators] = useState<SuggestedCreator[]>(() =>
    mockUsers.slice(0, 6).map(creator => ({
      id: creator.id,
      username: creator.username,
      displayName: creator.displayName,
      avatar: creator.avatar,
      bio: creator.bio,
    }))
  );
  const progress = (step / 5) * 100;

  useEffect(() => {
    if (loading) return;
    setStep(Math.min(Math.max(state.step_completed + 1, 1), 5));
    setSelectedInterests(state.interests);
  }, [loading, state.interests, state.step_completed]);

  useEffect(() => {
    if (profile?.bio) setBio(profile.bio);
  }, [profile?.bio]);

  useEffect(() => {
    if (!user?.id || user.id.startsWith('mock-')) return;
    let active = true;
    const loadCreators = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from('profiles')
        .select('user_id,username,prenom,nom,avatar_url,bio')
        .neq('user_id', user.id)
        .not('username', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Unable to load suggested creators', error);
        return;
      }
      if (active) {
        setSuggestedCreators((data ?? []).map((creator: {
          user_id: string;
          username: string;
          prenom: string | null;
          nom: string | null;
          avatar_url: string | null;
          bio: string | null;
        }) => ({
          id: creator.user_id,
          username: creator.username,
          displayName: [creator.prenom, creator.nom].filter(Boolean).join(' ') || creator.username,
          avatar: creator.avatar_url,
          bio: creator.bio,
        })));
      }

      const { data: existingFollows, error: followsError } = await client
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      if (followsError) {
        console.error('Unable to load followed creators', followsError);
      } else if (active) {
        setFollowedCreators((existingFollows ?? []).map((follow: { following_id: string }) => follow.following_id));
      }
    };

    void loadCreators();
    return () => { active = false; };
  }, [user?.id]);

  const next = async () => {
    if (step === 2 && selectedInterests.length < 3) {
      toast.error('Choisis au moins 3 interets');
      return;
    }
    if (step === 3 && followedCreators.length < 1) {
      if (suggestedCreators.length > 0) {
        toast.error('Suis au moins 1 createur');
        return;
      }
    }

    try {
      if (step === 3 && user && !user.id.startsWith('mock-') && followedCreators.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = supabase as any;
        const { error } = await client.from('follows').upsert(
          followedCreators.map(followingId => ({ follower_id: user.id, following_id: followingId })),
          { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
        );
        if (error) throw error;
      }

      if (step === 4 && user && !user.id.startsWith('mock-')) {
        const { error } = await supabase.from('profiles').update({
          bio: sanitizeText(bio).slice(0, 160) || null,
        }).eq('user_id', user.id);
        if (error) throw error;
        await refreshProfile();
      }

      if (step === 5) {
        await save({ step_completed: 5, interests: selectedInterests, onboarding_done: true });
        navigate('/', { replace: true });
        return;
      }

      await save({ step_completed: step, interests: selectedInterests });
      setStep(current => current + 1);
    } catch (error) {
      console.error('Unable to save onboarding progress', error);
      toast.error('Impossible d’enregistrer cette étape. Réessaie.');
    }
  };

  const skipOnboarding = async () => {
    try {
      await save({ onboarding_done: true });
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Unable to skip onboarding', error);
      toast.error('Impossible d’enregistrer cette action. Réessaie.');
    }
  };

  const activateNotifications = async () => {
    if (!user || user.id.startsWith('mock-')) {
      toast.error('Connecte-toi pour activer les notifications push.');
      return;
    }

    setPushLoading(true);
    try {
      await enableWebPush(user.id);
      await save({ step_completed: 5, interests: selectedInterests, onboarding_done: true });
      toast.success('Notifications activées.');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Unable to activate notifications during onboarding', error);
      toast.error(error instanceof Error ? error.message : 'Impossible d’activer les notifications.');
    } finally {
      setPushLoading(false);
    }
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

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Chargement de ton parcours…</main>;
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-8 pt-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col">
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{step}/5</span>
            <button type="button" onClick={() => void skipOnboarding()}>
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
                      <AvatarImage src={creator.avatar ?? undefined} alt={creator.username} />
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
          <Button
            onClick={() => step === 5 ? void activateNotifications() : void next()}
            disabled={pushLoading}
            className="h-14 w-full rounded-2xl text-base font-black"
          >
            {pushLoading ? 'Activation…' : step === 1 ? 'Commencer' : step === 5 ? 'Activer les notifications' : 'Continuer'}
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
