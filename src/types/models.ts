// ============================================================================
// CORE DATA MODEL
// This is the persistent "project state" — the UI never stores edit data
// itself, it only ever renders what's here. Everything the app can do to a
// project should be expressible as a mutation of these types.
// ============================================================================

export type ID = string;

export type MediaType = 'video' | 'audio' | 'image' | 'gif' | 'subtitle';

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number; // seconds
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
  fileSize: number;
  mimeType: string;
}

export interface MediaAsset {
  id: ID;
  name: string;
  type: MediaType;
  /** Object URL for the imported file (session-local). */
  src: string;
  /** Original File handle kept so we can re-derive blobs (e.g. for export). */
  file: File;
  metadata: MediaMetadata;
  thumbnailUrl?: string;
  /** Multiple thumbnails sampled across the duration, for filmstrip display. */
  filmstrip?: string[];
  /** Cached peak data for audio waveform rendering: min/max pairs per bucket. */
  waveformPeaks?: Float32Array;
  binId?: ID | null;
  createdAt: number;
}

export interface MediaBin {
  id: ID;
  name: string;
  parentId: ID | null;
}

// ---------------------------------------------------------------------------
// Transform / effects / keyframes — shared by any visual clip
// ---------------------------------------------------------------------------

export interface Transform2D {
  x: number; // 0 = centered, in project px
  y: number;
  scale: number; // 1 = 100%
  rotation: number; // degrees
  opacity: number; // 0-1
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_TRANSFORM: Transform2D = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipH: false,
  flipV: false,
};

export type CropMode = 'free' | '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '3:2' | '21:9';

export interface Crop {
  mode: CropMode;
  /** Normalized 0-1 crop rect relative to source frame. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_CROP: Crop = { mode: 'free', x: 0, y: 0, width: 1, height: 1 };

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bezier';

export interface Keyframe<T = number> {
  id: ID;
  time: number; // seconds, relative to clip start
  value: T;
  easing: EasingType;
  bezier?: [number, number, number, number];
}

/** A track of keyframes for a single animatable property. */
export type KeyframeTrack<T = number> = Keyframe<T>[];

export type AnimatableProp =
  | 'transform.x'
  | 'transform.y'
  | 'transform.scale'
  | 'transform.rotation'
  | 'transform.opacity'
  | 'color.brightness'
  | 'color.contrast'
  | 'color.saturation'
  | 'color.temperature'
  | 'effect.blur'
  | 'audio.volume';

export interface ColorAdjustments {
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  hue: number;
  fade: number;
  sharpness: number;
  clarity: number;
  vignette: number;
  grain: number;
}

export const DEFAULT_COLOR: ColorAdjustments = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  fade: 0,
  sharpness: 0,
  clarity: 0,
  vignette: 0,
  grain: 0,
};

export interface EffectInstance {
  id: ID;
  type: string; // e.g. 'gaussianBlur', 'chromaticAberration', 'glitch'
  intensity: number; // 0-100
  startTime: number; // relative to clip
  duration: number;
  keyframes?: KeyframeTrack;
}

export interface FilterInstance {
  id: ID;
  presetId: string;
  intensity: number; // 0-100
}

export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'colorDodge' | 'colorBurn' | 'softLight' | 'hardLight' | 'difference';

export type SpeedCurvePreset = 'none' | 'montage' | 'hero' | 'bullet' | 'jumpCut' | 'flashIn' | 'flashOut';

export interface SpeedSettings {
  rate: number; // 0.1 - 100
  reversed: boolean;
  preserveTune: boolean; // pitch preservation
  curve: SpeedCurvePreset;
  customCurve?: Keyframe<number>[];
}

export const DEFAULT_SPEED: SpeedSettings = {
  rate: 1,
  reversed: false,
  preserveTune: true,
  curve: 'none',
};

export type MaskShape = 'rectangle' | 'circle' | 'ellipse' | 'linear' | 'split' | 'heart' | 'polygon';

export interface MaskInstance {
  id: ID;
  shape: MaskShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  feather: number;
  inverted: boolean;
  points?: { x: number; y: number }[]; // for polygon
  keyframes?: Record<string, KeyframeTrack>;
}

export interface ChromaKeySettings {
  enabled: boolean;
  color: string; // hex
  strength: number;
  similarity: number;
  edgeFeather: number;
  spillReduction: number;
}

export const DEFAULT_CHROMA_KEY: ChromaKeySettings = {
  enabled: false,
  color: '#00ff00',
  strength: 50,
  similarity: 40,
  edgeFeather: 5,
  spillReduction: 50,
};

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextStroke { color: string; width: number; }
export interface TextShadow { color: string; opacity: number; blur: number; distance: number; angle: number; }
export interface TextBackground { color: string; padding: number; cornerRadius: number; opacity: number; }

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  lineHeight: number;
  color: string;
  opacity: number;
  stroke?: TextStroke;
  shadow?: TextShadow;
  background?: TextBackground;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 700,
  italic: false,
  underline: false,
  align: 'center',
  letterSpacing: 0,
  lineHeight: 1.2,
  color: '#ffffff',
  opacity: 1,
};

export type TextAnimationKind =
  | 'none' | 'fade' | 'slide' | 'pop' | 'zoom' | 'typewriter' | 'bounce'
  | 'pulse' | 'shake' | 'float' | 'flicker';

export interface TextAnimation {
  entrance: TextAnimationKind;
  entranceDuration: number;
  exit: TextAnimationKind;
  exitDuration: number;
  loop: TextAnimationKind;
}

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

export interface CaptionWord {
  id: ID;
  text: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  id: ID;
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
}

// ---------------------------------------------------------------------------
// Timeline clips
// ---------------------------------------------------------------------------

export type ClipKind = 'video' | 'audio' | 'image' | 'text' | 'sticker' | 'subtitle' | 'effectClip';

interface BaseClip {
  id: ID;
  kind: ClipKind;
  trackId: ID;
  /** Position on the timeline, seconds. */
  start: number;
  /** Duration on the timeline (post-speed), seconds. */
  duration: number;
  /** In/out points within the source media, seconds (pre-speed). */
  sourceIn: number;
  sourceOut: number;
  selected?: boolean;
  locked?: boolean;
  name: string;
}

export interface VisualClipCommon {
  transform: Transform2D;
  crop: Crop;
  color: ColorAdjustments;
  effects: EffectInstance[];
  filters: FilterInstance[];
  masks: MaskInstance[];
  chromaKey: ChromaKeySettings;
  blendMode: BlendMode;
  animationIn?: { kind: string; duration: number };
  animationOut?: { kind: string; duration: number };
  keyframes: Partial<Record<AnimatableProp, KeyframeTrack>>;
}

export interface VideoClip extends BaseClip, VisualClipCommon {
  kind: 'video';
  mediaId: ID;
  speed: SpeedSettings;
  volume: number; // 0-1
  muted: boolean;
  linkedAudioClipId?: ID | null;
}

export interface AudioClip extends BaseClip {
  kind: 'audio';
  mediaId: ID;
  volume: number;
  muted: boolean;
  pan: number; // -1..1
  fadeIn: number;
  fadeOut: number;
  speed: SpeedSettings;
  eq: { bass: number; mid: number; treble: number };
  linkedVideoClipId?: ID | null;
}

export interface ImageClip extends BaseClip, VisualClipCommon {
  kind: 'image';
  mediaId: ID;
}

export interface TextClip extends BaseClip, VisualClipCommon {
  kind: 'text';
  text: string;
  style: TextStyle;
  animation: TextAnimation;
}

export interface StickerClip extends BaseClip, VisualClipCommon {
  kind: 'sticker';
  mediaId: ID;
}

export interface SubtitleClip extends BaseClip {
  kind: 'subtitle';
  cues: CaptionCue[];
  style: TextStyle;
  karaoke: boolean;
}

export type TimelineClip = VideoClip | AudioClip | ImageClip | TextClip | StickerClip | SubtitleClip;

// ---------------------------------------------------------------------------
// Tracks / transitions
// ---------------------------------------------------------------------------

export type TrackType =
  | 'video' | 'overlayVideo' | 'image' | 'text' | 'subtitle'
  | 'sticker' | 'effect' | 'audio' | 'music' | 'voiceover';

export interface Track {
  id: ID;
  type: TrackType;
  name: string;
  index: number; // stacking order, higher = on top / rendered last for video
  hidden: boolean;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  height: number; // px, for UI
}

export interface TransitionInstance {
  id: ID;
  type: string; // 'crossDissolve' | 'fade' | 'slideLeft' | ...
  duration: number;
  /** The two clips it sits between. */
  fromClipId: ID;
  toClipId: ID;
}

export interface Marker {
  id: ID;
  time: number;
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '3:2' | '21:9' | 'custom';

export interface CanvasSettings {
  aspectRatio: AspectRatioPreset;
  width: number;
  height: number;
  background: { type: 'color' | 'transparent' | 'image' | 'blur' | 'gradient'; value?: string };
  fps: number;
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov';
  videoCodec: 'h264' | 'h265' | 'vp9' | 'av1';
  audioCodec: 'aac' | 'opus';
  resolutionPreset: '480p' | '720p' | '1080p' | '1440p' | '2160p' | 'custom';
  width: number;
  height: number;
  fps: number;
  bitrateMbps: number;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  resolutionPreset: '1080p',
  width: 1920,
  height: 1080,
  fps: 30,
  bitrateMbps: 12,
};

export interface Project {
  id: ID;
  name: string;
  canvas: CanvasSettings;
  tracks: Track[];
  clips: TimelineClip[];
  transitions: TransitionInstance[];
  markers: Marker[];
  mediaAssets: MediaAsset[];
  mediaBins: MediaBin[];
  exportSettings: ExportSettings;
  createdAt: number;
  updatedAt: number;
}

export function createEmptyProject(name = 'Untitled Project'): Project {
  const now = Date.now();
  return {
    id: cryptoId(),
    name,
    canvas: {
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      background: { type: 'color', value: '#000000' },
      fps: 30,
    },
    tracks: [
      { id: cryptoId(), type: 'audio', name: 'Audio 1', index: 0, hidden: false, muted: false, solo: false, locked: false, height: 64 },
      { id: cryptoId(), type: 'video', name: 'Video 1', index: 1, hidden: false, muted: false, solo: false, locked: false, height: 72 },
      { id: cryptoId(), type: 'video', name: 'Video 2', index: 2, hidden: false, muted: false, solo: false, locked: false, height: 72 },
      { id: cryptoId(), type: 'text', name: 'Text 1', index: 3, hidden: false, muted: false, solo: false, locked: false, height: 48 },
    ],
    clips: [],
    transitions: [],
    markers: [],
    mediaAssets: [],
    mediaBins: [],
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };
}

export function cryptoId(): ID {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
