import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StoryViewerProps {
  stories: Array<{ id: string; media_url?: string; text_content?: string; background_color?: string; duration?: number }>;
  onClose: () => void;
}

export const StoryViewer = ({ stories, onClose }: StoryViewerProps) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const current = stories[index];
    const timer = setTimeout(() => {
      if (index >= stories.length - 1) onClose();
      else setIndex(value => value + 1);
    }, (current?.duration ?? 5) * 1000);
    return () => clearTimeout(timer);
  }, [index, onClose, stories]);

  const story = stories[index];
  if (!story) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black text-white">
      <div className="absolute left-3 right-3 top-4 flex gap-1">
        {stories.map((item, i) => <div key={item.id} className="h-1 flex-1 rounded-full bg-white/30"><div className={i <= index ? 'h-full rounded-full bg-white' : ''} /></div>)}
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-3 top-8 text-white">
        <X className="h-6 w-6" />
      </Button>
      <button className="absolute inset-y-0 left-0 w-1/2" onClick={() => setIndex(value => Math.max(0, value - 1))} />
      <button className="absolute inset-y-0 right-0 w-1/2" onClick={() => (index >= stories.length - 1 ? onClose() : setIndex(value => value + 1))} />
      {story.media_url ? (
        <img src={story.media_url} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center px-8 text-center text-3xl font-black" style={{ backgroundColor: story.background_color ?? '#7C3AED' }}>
          {story.text_content}
        </div>
      )}
    </div>
  );
};
