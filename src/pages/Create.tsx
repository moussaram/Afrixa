import { useState, useEffect, useCallback } from 'react';
import { X, Music, Upload, Check, RotateCcw, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { CameraPreview } from '@/components/create/CameraPreview';
import { DurationTabs } from '@/components/create/DurationTabs';
import { getDurationSeconds, type DurationMode } from '@/components/create/duration';
import { SpeedSelector } from '@/components/create/SpeedSelector';
import { type SpeedValue } from '@/components/create/speed';
import { SideControls, type TimerValue } from '@/components/create/SideControls';
import { RecordButton } from '@/components/create/RecordButton';
import { TimerCountdown } from '@/components/create/TimerCountdown';
import { EffectsPanel, type Effect } from '@/components/create/EffectsPanel';
import { SoundLibrary, type Sound } from '@/components/create/SoundLibrary';
import { TimerSelector } from '@/components/create/TimerSelector';
import { PostEditor } from '@/components/create/PostEditor';
import { toast } from 'sonner';

type CreateStep = 'capture' | 'edit';

const Create = () => {
  const navigate = useNavigate();
  const camera = useCamera();
  const { stopRecording } = camera;

  const [createStep, setCreateStep] = useState<CreateStep>('capture');
  
  // Mode & Duration
  const [durationMode, setDurationMode] = useState<DurationMode>('60s');
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedValue>('1x');
  
  // Timer
  const [timerValue, setTimerValue] = useState<TimerValue>(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showTimerSelector, setShowTimerSelector] = useState(false);
  
  // Recording
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingProgress, setRecordingProgress] = useState(0);
  
  // Panels
  const [showEffects, setShowEffects] = useState(false);
  const [showSounds, setShowSounds] = useState(false);
  
  // Selected media
  const [selectedEffect, setSelectedEffect] = useState<Effect | null>(null);
  const [selectedSound, setSelectedSound] = useState<Sound | null>(null);
  const [soundVolume, setSoundVolume] = useState(50);
  
  // Captured content
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [recordedMediaUrl, setRecordedMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'photo'>('video');

  const maxDuration = getDurationSeconds(durationMode);
  const isPhotoMode = durationMode === 'photo';

  // Recording timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (camera.isRecording && !camera.isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          setRecordingProgress((newTime / maxDuration) * 100);
          
          if (newTime >= maxDuration) {
            stopRecording();
            toast.success('Durée maximale atteinte');
            return maxDuration;
          }
          return newTime;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [camera.isRecording, camera.isPaused, maxDuration, stopRecording]);

  // Watch for recorded blob
  useEffect(() => {
    if (camera.recordedBlob) {
      const url = URL.createObjectURL(camera.recordedBlob);
      setRecordedMediaUrl(url);
      setMediaType('video');
    }
  }, [camera.recordedBlob]);

  useEffect(() => {
    setRecordingTime(0);
    setRecordingProgress(0);
  }, [durationMode]);

  const handleStartRecording = useCallback(() => {
    if (timerValue > 0) {
      setIsTimerActive(true);
    } else {
      camera.startRecording();
    }
  }, [timerValue, camera]);

  const handleTimerComplete = useCallback(() => {
    setIsTimerActive(false);
    camera.startRecording();
  }, [camera]);

  const handleStopRecording = useCallback(() => {
    camera.stopRecording();
    toast.success('Vidéo enregistrée !');
  }, [camera]);

  const handleCapturePhoto = useCallback(() => {
    const photo = camera.capturePhoto();
    if (photo) {
      setCapturedPhoto(photo);
      setRecordedMediaUrl(photo);
      setMediaType('photo');
      toast.success('Photo capturée !');
    }
  }, [camera]);

  const handleConfirmRecording = () => {
    setCreateStep('edit');
  };

  const handleResetRecording = () => {
    setRecordingTime(0);
    setRecordingProgress(0);
    setCapturedPhoto(null);
    setRecordedMediaUrl(null);
  };

  const handleClose = () => {
    if (camera.isRecording || recordingTime > 0 || capturedPhoto) {
      toast.info('Brouillon sauvegardé');
    }
    navigate('/');
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setRecordedMediaUrl(url);
        setMediaType(file.type.startsWith('image') ? 'photo' : 'video');
        toast.success(`Fichier chargé : ${file.name}`);
        // Go directly to edit step
        setCreateStep('edit');
      }
    };
    input.click();
  };

  // ─── POST EDITOR STEP ─────────────────────────────────
  if (createStep === 'edit') {
    return (
      <PostEditor
        mediaUrl={recordedMediaUrl}
        mediaType={mediaType}
        selectedSound={selectedSound}
        onBack={() => setCreateStep('capture')}
      />
    );
  }

  // ─── CAPTURE STEP ─────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <TimerCountdown
        seconds={timerValue}
        isActive={isTimerActive}
        onComplete={handleTimerComplete}
      />

      <CameraPreview
        ref={camera.videoRef}
        isStreaming={camera.isStreaming}
        hasPermission={camera.hasPermission}
        error={camera.error}
        isRecording={camera.isRecording}
        recordingTime={recordingTime}
        onStartStream={camera.startStream}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between p-4">
          <Button variant="glass" size="icon" onClick={handleClose}>
            <X className="w-6 h-6" />
          </Button>

          {/* Live button */}
          <Button
            variant="glass"
            size="sm"
            className="gap-2 border border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => navigate('/live/setup')}
          >
            <Radio className="w-4 h-4" />
            <span className="text-xs font-semibold">LIVE</span>
          </Button>
          
          <Button
            variant="glass"
            size="sm"
            className="gap-2"
            onClick={() => setShowSounds(true)}
          >
            <Music className="w-4 h-4" />
            <span>{selectedSound ? selectedSound.title : 'Ajouter un son'}</span>
          </Button>
        </div>

        <div className="mt-2">
          <DurationTabs
            selected={durationMode}
            onSelect={setDurationMode}
            disabled={camera.isRecording}
          />
        </div>
      </div>

      {/* Right Side Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <SideControls
          flashMode={camera.flashMode}
          timerValue={timerValue}
          onToggleCamera={camera.toggleCamera}
          onCycleFlash={camera.cycleFlashMode}
          onOpenTimer={() => setShowTimerSelector(true)}
          onOpenEffects={() => setShowEffects(true)}
          onOpenBeauty={() => setShowEffects(true)}
          disabled={camera.isRecording}
        />
      </div>

      {/* Speed Selector */}
      {!isPhotoMode && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 z-10">
          <SpeedSelector
            selected={selectedSpeed}
            onSelect={setSelectedSpeed}
            disabled={camera.isRecording}
          />
        </div>
      )}

      {!camera.isRecording && camera.isStreaming && (
        <div className="absolute bottom-56 left-1/2 -translate-x-1/2 z-10">
          <p className="text-muted-foreground/80 text-sm">
            {isPhotoMode ? 'Appuyez pour capturer' : 'Appuyez sur le bouton pour enregistrer'}
          </p>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 glass border-t border-border/30 pb-safe z-10">
        <div className="flex items-center justify-around py-6">
          {/* Upload button */}
          <button
            onClick={handleUpload}
            className="flex flex-col items-center gap-2 text-foreground"
          >
            <div className="p-3 glass rounded-xl">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-xs">Uploader</span>
          </button>

          {/* Record button */}
          <div className="relative">
            <RecordButton
              isRecording={camera.isRecording}
              isPaused={camera.isPaused}
              isPhotoMode={isPhotoMode}
              progress={recordingProgress}
              onRecord={handleStartRecording}
              onStop={handleStopRecording}
              onCapture={handleCapturePhoto}
              disabled={!camera.isStreaming}
            />
          </div>

          {/* Confirm / Reset */}
          {(recordingTime > 0 || capturedPhoto) ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleConfirmRecording}
                className="p-3 gradient-primary rounded-xl"
              >
                <Check className="w-6 h-6 text-primary-foreground" />
              </button>
              <span className="text-xs text-foreground">Suivant</span>
            </div>
          ) : (
            <button
              onClick={handleResetRecording}
              className="flex flex-col items-center gap-2 text-foreground opacity-50"
            >
              <div className="p-3 glass rounded-xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <span className="text-xs">Annuler</span>
            </button>
          )}
        </div>
      </div>

      {/* Panels */}
      <EffectsPanel
        isOpen={showEffects}
        onClose={() => setShowEffects(false)}
        onSelectEffect={setSelectedEffect}
        selectedEffect={selectedEffect}
      />

      <SoundLibrary
        isOpen={showSounds}
        onClose={() => setShowSounds(false)}
        onSelectSound={setSelectedSound}
        selectedSound={selectedSound}
        volume={soundVolume}
        onVolumeChange={setSoundVolume}
      />

      <TimerSelector
        isOpen={showTimerSelector}
        onClose={() => setShowTimerSelector(false)}
        value={timerValue}
        onSelect={setTimerValue}
      />
    </div>
  );
};

export default Create;
