import { Project, MediaAsset, AudioClip, VideoClip } from '@/types/models';
import { getActiveClips } from '@/engine/renderEngine';
import { mediaPool, isVideoOrAudioClip } from '@/engine/mediaPool';

const SEEK_DRIFT_TOLERANCE = 0.12; // seconds — beyond this we hard-correct currentTime

function computeSourceTime(clip: VideoClip | AudioClip, timelineTime: number): number {
  const localTime = timelineTime - clip.start;
  const rate = clip.speed.reversed ? -clip.speed.rate : clip.speed.rate;
  if (clip.speed.reversed) {
    return clip.sourceOut - localTime * clip.speed.rate;
  }
  return clip.sourceIn + localTime * clip.speed.rate;
}

export function syncMediaElements(
  project: Project,
  time: number,
  playing: boolean,
  getMedia: (id: string) => MediaAsset | undefined,
) {
  const active = getActiveClips(project, time).filter(isVideoOrAudioClip) as (VideoClip | AudioClip)[];
  const activeIds = new Set(active.map((c) => c.id));

  const trackById = new Map(project.tracks.map((t) => [t.id, t]));
  const anySolo = project.tracks.some((t) => t.solo);

  for (const clip of active) {
    const asset = getMedia(clip.mediaId);
    if (!asset) continue;
    const entry = mediaPool.get(clip, asset);
    const el = entry.el as HTMLVideoElement;

    const track = trackById.get(clip.trackId);
    const trackAudible = track ? (!track.muted && (!anySolo || track.solo)) : true;
    const clipMuted = 'muted' in clip ? clip.muted : false;
    const audible = trackAudible && !clipMuted;

    const targetSourceTime = computeSourceTime(clip, time);
    if (Number.isFinite(targetSourceTime)) {
      const drift = Math.abs(el.currentTime - targetSourceTime);
      if (drift > SEEK_DRIFT_TOLERANCE || !playing) {
        try {
          el.currentTime = Math.max(0, targetSourceTime);
        } catch {
          /* element not seekable yet */
        }
      }
    }

    el.playbackRate = Math.min(16, Math.max(0.0625, clip.speed.rate || 1));
    el.preservesPitch = clip.speed.preserveTune as any;

    const volume = 'volume' in clip ? clip.volume : 1;
    if (entry.gainNode) {
      entry.gainNode.gain.value = audible ? volume : 0;
      el.muted = true; // route audio exclusively through the Web Audio graph
    } else {
      el.muted = !audible;
      el.volume = volume;
    }

    if (playing && el.paused) {
      el.play().catch(() => {
        /* autoplay may be blocked until a user gesture; play() is retried
           on the next tick once the pool's context has been resumed */
      });
    } else if (!playing && !el.paused) {
      el.pause();
    }
  }

  mediaPool.releaseUnused(activeIds);
}
