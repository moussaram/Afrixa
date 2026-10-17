import { useEffect, useRef, useState } from 'react';
import { Gauge, MoreHorizontal, PictureInPicture2, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdvancedVideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoId: string;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const AdvancedVideoControls = ({ videoRef, videoId, speed, onSpeedChange }: AdvancedVideoControlsProps) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const key = `afrixa:watch:${videoId}`;
    const stored = Number(localStorage.getItem(key) || 0);
    if (stored > 0 && Number.isFinite(stored)) video.currentTime = stored;

    const save = () => localStorage.setItem(key, String(video.currentTime));
    video.addEventListener('timeupdate', save);
    return () => video.removeEventListener('timeupdate', save);
  }, [videoId, videoRef]);

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  };

  const requestPip = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    await video.requestPictureInPicture().catch(() => undefined);
  };

  return (
    <div
      className="pointer-events-auto absolute inset-x-3 top-20 z-20 flex items-center justify-between"
    >
      <Button variant="glass" size="icon" onClick={() => seek(-10)} aria-label="Reculer 10 secondes">
        <RotateCcw className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            variant="glass"
            size="icon"
            onClick={() => setOptionsOpen(open => !open)}
            aria-label="Options vidéo"
            aria-expanded={optionsOpen}
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          {optionsOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-white/15 bg-black/90 p-3 text-white shadow-xl">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-white/70">
                <Gauge className="h-3 w-3" /> Vitesse de lecture
              </p>
              <div className="grid grid-cols-3 gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={speed === value}
                    onClick={() => { onSpeedChange(value); setOptionsOpen(false); }}
                    className={`rounded-lg px-2 py-2 text-xs font-bold ${speed === value ? 'bg-primary text-primary-foreground' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button variant="glass" size="icon" onClick={requestPip} aria-label="Picture in Picture">
          <PictureInPicture2 className="h-5 w-5" />
        </Button>
      </div>
      <Button variant="glass" size="icon" onClick={() => seek(10)} aria-label="Avancer 10 secondes">
        <RotateCw className="h-5 w-5" />
      </Button>
    </div>
  );
};
