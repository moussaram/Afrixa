import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

const TUTORIAL_KEY = 'afrixa:feed-tutorial-seen';

export const FeedTutorialOverlay = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(TUTORIAL_KEY) !== 'true');
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setVisible(false);
  };

  return (
    <button
      type="button"
      onClick={dismiss}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-8 text-left"
      aria-label="Fermer le tutoriel du feed"
    >
      <span className="flex max-w-xs flex-col items-center gap-5 text-center text-white">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/40 bg-white/10">
          <ChevronUp className="h-10 w-10 animate-bounce" />
        </span>
        <span className="text-xl font-black">Glisse vers le haut pour la video suivante</span>
      </span>
    </button>
  );
};
