import { useEffect, useRef, useState } from 'react';
import { Gauge, MoreHorizontal, PictureInPicture2, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdvancedVideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoId: string;
}

export const AdvancedVideoControls = ({ videoRef, videoId }: AdvancedVideoControlsProps) => {
  const [speed, setSpeed] = useState(1);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      onPointerDown={() => {
        longPressRef.current = setTimeout(() => setSpeed(2), 450);
      }}
      onPointerUp={() => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
        if (speed === 2) setSpeed(1);
      }}
    >
      <Button variant="glass" size="icon" onClick={() => seek(-10)} aria-label="Reculer 10 secondes">
        <RotateCcw className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        {[0.5, 1, 1.5, 2].map(value => (
          <button
            key={value}
            onClick={() => setSpeed(value)}
            className="rounded-full bg-black/40 px-2 py-1 text-xs font-bold text-white"
          >
            <Gauge className="mr-1 inline h-3 w-3" />
            {value}x
          </button>
        ))}
        <Button variant="glass" size="icon" onClick={requestPip} aria-label="Picture in Picture">
          <PictureInPicture2 className="h-5 w-5" />
        </Button>
        <Button variant="glass" size="icon" aria-label="Options video">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
      <Button variant="glass" size="icon" onClick={() => seek(10)} aria-label="Avancer 10 secondes">
        <RotateCw className="h-5 w-5" />
      </Button>
    </div>
  );
};
