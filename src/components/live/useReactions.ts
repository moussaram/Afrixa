import { useCallback, useState } from 'react';

export interface Reaction {
  id: string;
  emoji: string;
  x: number;
}

export const useReactions = () => {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const addReaction = useCallback((emoji: string) => {
    const id = Math.random().toString(36).slice(2);
    const x = Math.random() * 80;
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }, []);

  return { reactions, addReaction };
};
