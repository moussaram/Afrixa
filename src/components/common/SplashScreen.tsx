import { useEffect, useState } from 'react';
import splashScreen from '@/assets/splash-screen.jpg';
import afrixaIcon from '/afrixa-icon.png';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 2200);
    const t3 = setTimeout(onFinish, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFinish]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500',
        phase === 'in' ? 'opacity-0' : phase === 'hold' ? 'opacity-100' : 'opacity-0'
      )}
    >
      <img loading="lazy" src={splashScreen} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className={cn(
          'transition-all duration-700',
          phase === 'hold' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        )}>
          <img loading="lazy" src={afrixaIcon} alt="Afrixa" className="w-24 h-24 rounded-3xl shadow-2xl shadow-primary/40" />
        </div>
        <div className={cn(
          'text-center transition-all duration-700 delay-100',
          phase === 'hold' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}>
          <h1 className="text-4xl font-black text-foreground tracking-tight">Afrixa</h1>
          <p className="text-sm text-muted-foreground mt-1.5">African Social Network</p>
        </div>
        {/* Loading dots */}
        <div className={cn(
          'flex gap-1.5 transition-all duration-500 delay-300',
          phase === 'hold' ? 'opacity-100' : 'opacity-0'
        )}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
