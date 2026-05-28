import { Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChallengeCard } from '@/components/creators/ChallengeCard';
import { useChallenge } from '@/hooks/useChallenge';
import { CreatorPageShell } from './CreatorPageShell';

const fallbackChallenges = [
  {
    id: 'demo-dans-afrixa',
    title: 'Danse Afrixa',
    hashtag: '#DanseAfrixa',
    description: 'Montre ton meilleur pas et fais vibrer la communauté.',
    prize_description: '50 000 FCFA à gagner',
    participants_count: 1280,
    views_count: 340000,
  },
  {
    id: 'demo-talents',
    title: 'Talents de chez nous',
    hashtag: '#TalentAfrixa',
    description: 'Cuisine, humour, musique, artisanat : fais découvrir ton talent.',
    prize_description: 'Spotlight officiel Afrixa',
    participants_count: 640,
    views_count: 185000,
  },
];

const ChallengesPage = () => {
  const { challenges, loading } = useChallenge();
  const visibleChallenges = challenges.length ? challenges : fallbackChallenges;

  return (
    <CreatorPageShell title="Challenges & Tendances" subtitle="Défis officiels pour créer du contenu viral">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl bg-[#2D2D4E]" />
          <Skeleton className="h-80 rounded-2xl bg-[#2D2D4E]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
          <Button asChild className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] sm:w-auto">
            <Link to="/create">
              <Camera className="mr-2 h-4 w-4" />
              Participer avec une vidéo
            </Link>
          </Button>
        </>
      )}
    </CreatorPageShell>
  );
};

export default ChallengesPage;
