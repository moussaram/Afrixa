import { forwardRef, useState } from 'react';
import { SwitchCamera, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CameraPreviewProps {
  isStreaming: boolean;
  hasPermission: boolean | null;
  error: string | null;
  isRecording: boolean;
  recordingTime: number;
  onStartStream: () => void;
  className?: string;
}

export const CameraPreview = forwardRef<HTMLVideoElement, CameraPreviewProps>(
  ({ isStreaming, hasPermission, error, isRecording, recordingTime, onStartStream, className }, ref) => {
    const [isFocusing, setIsFocusing] = useState(false);
    const [focusPoint, setFocusPoint] = useState({ x: 0, y: 0 });

    const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setFocusPoint({ x, y });
      setIsFocusing(true);
      
      setTimeout(() => setIsFocusing(false), 1000);
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Permission denied or error state
    if (hasPermission === false || error) {
      return (
        <div className={cn("flex-1 relative bg-gradient-to-b from-muted/50 to-background flex items-center justify-center", className)}>
          <div className="text-center p-6">
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Accès caméra refusé</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-xs">
              {error || "Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."}
            </p>
            <Button onClick={onStartStream} variant="gradient">
              Réessayer
            </Button>
          </div>
        </div>
      );
    }

    // Not streaming yet - show start prompt
    if (!isStreaming) {
      return (
        <div className={cn("flex-1 relative bg-gradient-to-b from-muted/50 to-background flex items-center justify-center", className)}>
          <div className="text-center">
            <button
              onClick={onStartStream}
              className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 animate-pulse-glow hover:scale-105 transition-transform"
            >
              <Camera className="w-12 h-12 text-primary-foreground" />
            </button>
            <p className="text-muted-foreground text-lg">Aperçu caméra</p>
            <p className="text-muted-foreground/60 text-sm mt-2">Appuyez pour démarrer</p>
          </div>
        </div>
      );
    }

    return (
      <div 
        className={cn("flex-1 relative bg-black overflow-hidden", className)}
        onClick={handleTap}
      >
        {/* Video element */}
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} // Mirror for selfie camera
        />

        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 glass px-3 py-1.5 rounded-full">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-foreground">{formatTime(recordingTime)}</span>
          </div>
        )}

        {/* Focus indicator */}
        {isFocusing && (
          <div
            className="absolute w-16 h-16 border-2 border-foreground rounded-lg animate-pulse pointer-events-none"
            style={{
              left: focusPoint.x - 32,
              top: focusPoint.y - 32,
            }}
          />
        )}

        {/* Grid overlay (rule of thirds) */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-foreground" />
          <div className="absolute right-1/3 top-0 bottom-0 w-px bg-foreground" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-foreground" />
          <div className="absolute bottom-1/3 left-0 right-0 h-px bg-foreground" />
        </div>
      </div>
    );
  }
);

CameraPreview.displayName = 'CameraPreview';
