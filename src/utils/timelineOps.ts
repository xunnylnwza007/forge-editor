import {
  AudioClip, DEFAULT_CHROMA_KEY, DEFAULT_COLOR, DEFAULT_CROP, DEFAULT_SPEED, DEFAULT_TEXT_STYLE,
  DEFAULT_TRANSFORM, ImageClip, MediaAsset, Project, TextClip, TimelineClip, Track, VideoClip, cryptoId,
} from '@/types/models';

/** Find (or note the absence of) a track suitable for a given asset type. */
export function findTargetTrack(project: Project, mediaType: MediaAsset['type']): Track | null {
  const wantType = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : mediaType === 'gif' || mediaType === 'image' ? 'video' : 'video';
  const candidates = project.tracks.filter((t) => t.type === wantType && !t.locked);
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.index - b.index)[0];
}

/** End time of the last clip on a track (0 if empty). */
export function trackEndTime(project: Project, trackId: string): number {
  return project.clips.filter((c) => c.trackId === trackId).reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export function buildClipFromAsset(asset: MediaAsset, track: Track, start: number): TimelineClip | null {
  const duration = asset.metadata.duration && asset.metadata.duration > 0 ? asset.metadata.duration : 5;
  const base = {
    id: cryptoId(),
    trackId: track.id,
    start,
    duration,
    sourceIn: 0,
    sourceOut: duration,
    name: asset.name,
  };

  if (asset.type === 'video') {
    const clip: VideoClip = {
      ...base,
      kind: 'video',
      mediaId: asset.id,
      transform: { ...DEFAULT_TRANSFORM },
      crop: { ...DEFAULT_CROP },
      color: { ...DEFAULT_COLOR },
      effects: [],
      filters: [],
      masks: [],
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      blendMode: 'normal',
      keyframes: {},
      speed: { ...DEFAULT_SPEED },
      volume: 1,
      muted: false,
    };
    return clip;
  }
  if (asset.type === 'audio') {
    const clip: AudioClip = {
      ...base,
      kind: 'audio',
      mediaId: asset.id,
      volume: 1,
      muted: false,
      pan: 0,
      fadeIn: 0,
      fadeOut: 0,
      speed: { ...DEFAULT_SPEED },
      eq: { bass: 0, mid: 0, treble: 0 },
    };
    return clip;
  }
  if (asset.type === 'image' || asset.type === 'gif') {
    const clip: ImageClip = {
      ...base,
      kind: 'image',
      mediaId: asset.id,
      transform: { ...DEFAULT_TRANSFORM },
      crop: { ...DEFAULT_CROP },
      color: { ...DEFAULT_COLOR },
      effects: [],
      filters: [],
      masks: [],
      chromaKey: { ...DEFAULT_CHROMA_KEY },
      blendMode: 'normal',
      keyframes: {},
    };
    return clip;
  }
  return null;
}

export function buildTextClip(track: Track, start: number, preset: 'heading' | 'subtitle' | 'body' | 'caption'): TextClip {
  const presets: Record<string, { text: string; fontSize: number; fontWeight: number }> = {
    heading: { text: 'Heading', fontSize: 72, fontWeight: 800 },
    subtitle: { text: 'Subtitle text', fontSize: 40, fontWeight: 600 },
    body: { text: 'Body text', fontSize: 32, fontWeight: 400 },
    caption: { text: 'Caption', fontSize: 24, fontWeight: 500 },
  };
  const p = presets[preset];
  return {
    id: cryptoId(),
    kind: 'text',
    trackId: track.id,
    start,
    duration: 4,
    sourceIn: 0,
    sourceOut: 4,
    name: p.text,
    text: p.text,
    style: { ...DEFAULT_TEXT_STYLE, fontSize: p.fontSize, fontWeight: p.fontWeight },
    animation: { entrance: 'fade', entranceDuration: 0.3, exit: 'fade', exitDuration: 0.3, loop: 'none' },
    transform: { ...DEFAULT_TRANSFORM },
    crop: { ...DEFAULT_CROP },
    color: { ...DEFAULT_COLOR },
    effects: [],
    filters: [],
    masks: [],
    chromaKey: { ...DEFAULT_CHROMA_KEY },
    blendMode: 'normal',
    keyframes: {},
  };
}
