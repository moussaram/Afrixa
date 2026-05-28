import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

const getFfmpeg = async () => {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
    await ffmpegInstance.load();
  }
  return ffmpegInstance;
};

export const compressVideo = async (
  file: File,
  onProgress: (percent: number) => void
) => {
  const ffmpeg = await getFfmpeg();
  const inputName = `input-${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
  const outputName = `output-${Date.now()}.mp4`;

  ffmpeg.on('progress', ({ progress }) => {
    onProgress(Math.max(0, Math.min(100, Math.round(progress * 100))));
  });

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vcodec',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'fast',
    '-vf',
    'scale=-2:720',
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  onProgress(100);
  return new Blob([data], { type: 'video/mp4' });
};

export const getVideoMetadata = (file: File) =>
  new Promise<{ duration: number; resolution: string }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration,
        resolution: `${video.videoWidth}x${video.videoHeight}`,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire les metadonnees video'));
    };
    video.src = url;
  });
