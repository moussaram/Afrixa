import { useEffect, useState } from 'react';
import { type GiftItem } from './gifts';

interface GiftAnimationProps {
  gift: GiftItem | null;
}

export const GiftAnimation = ({ gift }: GiftAnimationProps) => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<GiftItem | null>(null);

  useEffect(() => {
    if (gift) {
      setCurrent(gift);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [gift]);

  if (!visible || !current) return null;

  return (
    <div className="absolute left-4 right-4 bottom-36 flex items-center justify-center pointer-events-none z-20">
      <div className="bg-primary/10 border border-primary/30 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 animate-bounce-in">
        <span className="text-4xl">{current.emoji}</span>
        <div>
          <p className="text-xs text-muted-foreground">{current.fromUser} a envoyÃ©</p>
          <p className="text-base font-bold text-foreground">{current.name}</p>
          <p className="text-xs text-primary">+{current.value} coins</p>
        </div>
      </div>
    </div>
  );
};
