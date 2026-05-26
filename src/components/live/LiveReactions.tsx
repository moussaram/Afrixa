import { type Reaction } from './useReactions';

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
