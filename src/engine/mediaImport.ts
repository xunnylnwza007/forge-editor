import { MediaAsset, MediaType, cryptoId } from '@/types/models';

const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const GIF_EXT = ['gif'];
const AUDIO_EXT = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];
const SUBTITLE_EXT = ['srt', 'vtt'];

export function inferMediaType(file: File): MediaType | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXT.includes(ext) || file.type.startsWith('video/')) return 'video';
  if (GIF_EXT.includes(ext) || file.type === 'image/gif') return 'gif';
  if (IMAGE_EXT.includes(ext) || file.type.startsWith('image/')) return 'image';
  if (AUDIO_EXT.includes(ext) || file.type.startsWith('audio/')) return 'audio';
  if (SUBTITLE_EXT.includes(ext)) return 'subtitle';
  return null;
}

/** Shared AudioContext for decoding — created lazily on first user gesture-adjacent call. */
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return sharedAudioCtx;
}

async function extractVideoMetadataAndThumbs(file: File, src: string) {
  return new Promise<{ width: number; height: number; duration: number; thumbnailUrl: string; filmstrip: string[] }>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = src;
    video.onloadedmetadata = async () => {
      const { videoWidth: width, videoHeight: height, duration } = video;
      const canvas = document.createElement('canvas');
      const THUMB_W = 160;
      canvas.width = THUMB_W;
      canvas.height = Math.round((height / width) * THUMB_W) || 90;
      const ctx = canvas.getContext('2d')!;

      const grabFrameAt = (t: number) =>
        new Promise<string>((res) => {
          const onSeeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            video.removeEventListener('seeked', onSeeked);
            res(canvas.toDataURL('image/jpeg', 0.6));
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = Math.min(Math.max(t, 0), Math.max(duration - 0.05, 0));
        });

      const thumbnailUrl = await grabFrameAt(Math.min(0.1, duration / 2));
      const FRAMES = Math.min(10, Math.max(3, Math.round(duration)));
      const filmstrip: string[] = [];
      for (let i = 0; i < FRAMES; i++) {
        filmstrip.push(await grabFrameAt((duration * i) / FRAMES));
      }
      resolve({ width, height, duration, thumbnailUrl, filmstrip });
    };
    video.onerror = () => reject(new Error(`Failed to read video metadata for ${file.name}`));
  });
}

async function extractImageMetadata(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to read image'));
    img.src = src;
  });
}

/** Downsample decoded PCM into min/max peak pairs for fast waveform drawing. */
function computePeaks(buffer: AudioBuffer, bucketCount = 2000): Float32Array {
  const channelData = buffer.getChannelData(0);
  const samplesPerBucket = Math.max(1, Math.floor(channelData.length / bucketCount));
  const peaks = new Float32Array(bucketCount * 2); // [min, max] per bucket
  for (let b = 0; b < bucketCount; b++) {
    let min = 1.0;
    let max = -1.0;
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, channelData.length);
    for (let i = start; i < end; i++) {
      const v = channelData[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[b * 2] = min === 1.0 ? 0 : min;
    peaks[b * 2 + 1] = max === -1.0 ? 0 : max;
  }
  return peaks;
}

async function extractAudioMetadataAndWaveform(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioCtx();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return {
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels,
    waveformPeaks: computePeaks(audioBuffer),
  };
}

/**
 * Import a single file into a fully-populated MediaAsset: metadata,
 * thumbnails, and waveform data are all extracted here rather than lazily,
 * so the timeline/media panel can render immediately without recomputation.
 */
export async function importFile(file: File): Promise<MediaAsset | null> {
  const type = inferMediaType(file);
  if (!type) return null;

  const src = URL.createObjectURL(file);
  const base: MediaAsset = {
    id: cryptoId(),
    name: file.name,
    type,
    src,
    file,
    metadata: { fileSize: file.size, mimeType: file.type },
    createdAt: Date.now(),
  };

  try {
    if (type === 'video' || type === 'gif') {
      const { width, height, duration, thumbnailUrl, filmstrip } = await extractVideoMetadataAndThumbs(file, src);
      base.metadata = { ...base.metadata, width, height, duration };
      base.thumbnailUrl = thumbnailUrl;
      base.filmstrip = filmstrip;
      // GIFs and many videos carry audio; attempt waveform extraction best-effort.
      if (type === 'video') {
        try {
          const audio = await extractAudioMetadataAndWaveform(file);
          base.waveformPeaks = audio.waveformPeaks;
        } catch {
          /* silent audio or undecodable track — video still usable */
        }
      }
    } else if (type === 'image') {
      const { width, height } = await extractImageMetadata(src);
      base.metadata = { ...base.metadata, width, height, duration: 5 };
      base.thumbnailUrl = src;
    } else if (type === 'audio') {
      const { duration, sampleRate, channels, waveformPeaks } = await extractAudioMetadataAndWaveform(file);
      base.metadata = { ...base.metadata, duration, sampleRate, channels };
      base.waveformPeaks = waveformPeaks;
    } else if (type === 'subtitle') {
      base.metadata = { ...base.metadata, duration: 0 };
    }
  } catch (err) {
    console.error('Media import failed for', file.name, err);
    // Still return the asset with whatever metadata we have — better than
    // silently dropping the file the user just imported.
  }

  return base;
}

export async function importFiles(files: FileList | File[]): Promise<MediaAsset[]> {
  const arr = Array.from(files);
  const results = await Promise.all(arr.map((f) => importFile(f)));
  return results.filter((r): r is MediaAsset => r !== null);
}
