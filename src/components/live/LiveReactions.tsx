import { useEffect, useState, useCallback } from 'react';

interface Reaction {
  id: string;
  emoji: string;
  x: number;
}

interface LiveReactionsProps {
  reactions: Reaction[];
}

export const LiveReactions = ({ reactions }: LiveReactionsProps) => {
  return (
    <div className="absolute bottom-32 right-4 w-16 h-64 pointer-events-none overflow-hidden">
      {reactions.map(r => (
        <FloatingReaction key={r.id} emoji={r.emoji} x={r.x} />
      ))}
    </div>
  );
};

const FloatingReaction = ({ emoji, x }: { emoji: string; x: number }) => {
  return (
    <div
      className="absolute bottom-0 text-2xl animate-float-up"
      style={{ left: `${x}%` }}
    >
      {emoji}
    </div>
  );
};

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
