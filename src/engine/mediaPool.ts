import { AudioClip, MediaAsset, TimelineClip, VideoClip } from '@/types/models';

interface PooledEntry {
  el: HTMLVideoElement | HTMLAudioElement;
  sourceNode?: MediaElementAudioSourceNode;
  gainNode?: GainNode;
  assetId: string;
}

/**
 * One shared AudioContext for the whole app. All per-clip gain nodes route
 * into this context's destination, which is what makes audio/video stay in
 * sync with the visual master clock instead of each <video> owning its own
 * playback timeline.
 */
class MediaPool {
  private ctx: AudioContext | null = null;
  private entries = new Map<string, PooledEntry>(); // key: clipId

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.ctx;
  }

  resumeAudioContext() {
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  private ensureEntry(clip: VideoClip | AudioClip, asset: MediaAsset): PooledEntry {
    let entry = this.entries.get(clip.id);
    if (entry) return entry;

    const el: HTMLVideoElement | HTMLAudioElement =
      clip.kind === 'video' ? document.createElement('video') : document.createElement('audio');
    el.src = asset.src;
    el.preload = 'auto';
    (el as HTMLVideoElement).playsInline = true;
    el.crossOrigin = 'anonymous';

    let sourceNode: MediaElementAudioSourceNode | undefined;
    let gainNode: GainNode | undefined;
    try {
      const ctx = this.getCtx();
      sourceNode = ctx.createMediaElementSource(el);
      gainNode = ctx.createGain();
      sourceNode.connect(gainNode).connect(ctx.destination);
    } catch {
      // Some browsers throw if called before a user gesture; volume will
      // fall back to el.volume in that case.
    }

    entry = { el, sourceNode, gainNode, assetId: asset.id };
    this.entries.set(clip.id, entry);
    return entry;
  }

  get(clip: VideoClip | AudioClip, asset: MediaAsset): PooledEntry {
    return this.ensureEntry(clip, asset);
  }

  has(clipId: string) {
    return this.entries.has(clipId);
  }

  releaseUnused(activeClipIds: Set<string>) {
    for (const [clipId, entry] of this.entries) {
      if (!activeClipIds.has(clipId)) {
        entry.el.pause();
      }
    }
  }

  disposeAll() {
    for (const entry of this.entries.values()) {
      entry.el.pause();
      entry.el.src = '';
    }
    this.entries.clear();
  }
}

export const mediaPool = new MediaPool();

export function isVideoOrAudioClip(clip: TimelineClip): clip is VideoClip | AudioClip {
  return clip.kind === 'video' || clip.kind === 'audio';
}
