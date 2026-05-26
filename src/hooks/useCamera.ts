import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraFacing = 'user' | 'environment';
export type FlashMode = 'auto' | 'on' | 'off';

interface UseCameraOptions {
  initialFacing?: CameraFacing;
}

export const useCamera = (options: UseCameraOptions = {}) => {
  const { initialFacing = 'user' } = options;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [facing, setFacing] = useState<CameraFacing>(initialFacing);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const startStream = useCallback(async () => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsStreaming(true);
      setHasPermission(true);
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setHasPermission(false);
      setError(err instanceof Error ? err.message : 'Failed to access camera');
    }
  }, [facing]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const toggleCamera = useCallback(async () => {
    const newFacing = facing === 'user' ? 'environment' : 'user';
    setFacing(newFacing);
  }, [facing]);

  const cycleFlashMode = useCallback(() => {
    setFlashMode(prev => {
      if (prev === 'off') return 'auto';
      if (prev === 'auto') return 'on';
      return 'off';
    });
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp9',
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    
    return null;
  }, []);

  // Effect to restart stream when facing changes
  useEffect(() => {
    if (isStreaming) {
      startStream();
    }
  }, [facing, isStreaming, startStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    videoRef,
    facing,
    flashMode,
    isStreaming,
    isRecording,
    isPaused,
    hasPermission,
    error,
    zoomLevel,
    recordedBlob,
    startStream,
    stopStream,
    toggleCamera,
    cycleFlashMode,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    capturePhoto,
    setZoomLevel,
  };
};
