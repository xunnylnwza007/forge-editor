import { useEffect, useRef, useState } from 'react';
import { TimelineClip, Track } from '@/types/models';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { snapTime } from '@/utils/time';

const MIN_DURATION = 0.08;

function getSnapGuides(allClips: TimelineClip[], excludeId: string, playhead: number): number[] {
  const guides: number[] = [playhead];
  for (const c of allClips) {
    if (c.id === excludeId) continue;
    guides.push(c.start, c.start + c.duration);
  }
  return guides;
}

export function ClipView({
  clip, track, pixelsPerSecond, allClips, allTracks,
}: {
  clip: TimelineClip;
  track: Track;
  pixelsPerSecond: number;
  allClips: TimelineClip[];
  allTracks: Track[];
}) {
  const updateClip = useProjectStore((s) => s.updateClip);
  const selectedClipIds = useUIStore((s) => s.selectedClipIds);
  const toggleClipSelection = useUIStore((s) => s.toggleClipSelection);
  const playheadTime = useUIStore((s) => s.playheadTime);
  const snappingEnabled = useUIStore((s) => s.snappingEnabled);
  const selected = selectedClipIds.includes(clip.id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setDragging] = useState(false);

  const asset = 'mediaId' in clip ? undefined : undefined; // placeholder, real asset lookup below via store
  const mediaAssets = useProjectStore((s) => s.project.mediaAssets);
  const mediaAsset = 'mediaId' in clip ? mediaAssets.find((a) => a.id === (clip as any).mediaId) : undefined;

  // Draw audio waveform
  useEffect(() => {
    if (clip.kind !== 'audio' && clip.kind !== 'video') return;
    if (!mediaAsset?.waveformPeaks) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const peaks = mediaAsset.waveformPeaks;
    const bucketCount = peaks.length / 2;
    const mediaDuration = mediaAsset.metadata.duration || clip.duration;
    const startBucket = Math.floor((clip.sourceIn / mediaDuration) * bucketCount);
    const endBucket = Math.ceil((clip.sourceOut / mediaDuration) * bucketCount);
    const visibleBuckets = Math.max(1, endBucket - startBucket);

    ctx.fillStyle = 'rgba(79, 209, 197, 0.55)';
    const mid = h / 2;
    for (let x = 0; x < w; x++) {
      const bucketIdx = startBucket + Math.floor((x / w) * visibleBuckets);
      const min = peaks[bucketIdx * 2] ?? 0;
      const max = peaks[bucketIdx * 2 + 1] ?? 0;
      ctx.fillRect(x, mid + min * mid, 1, Math.max(1, (max - min) * mid));
    }
  }, [clip, mediaAsset, pixelsPerSecond]);

  const onClipPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return; // handled separately
    e.stopPropagation();
    toggleClipSelection(clip.id, e.shiftKey || e.metaKey || e.ctrlKey);
    if (track.locked) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origStart = clip.start;
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      let newStart = origStart + dx / pixelsPerSecond;
      newStart = Math.max(0, newStart);

      if (snappingEnabled) {
        const guides = getSnapGuides(allClips, clip.id, playheadTime);
        const tol = 8 / pixelsPerSecond;
        const snappedStart = snapTime(newStart, guides, tol);
        const snappedEnd = snapTime(newStart + clip.duration, guides, tol);
        if (snappedStart.snapped) newStart = snappedStart.time;
        else if (snappedEnd.snapped) newStart = snappedEnd.time - clip.duration;
      }

      // Track switching: find lane under pointer
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const laneEl = el?.closest('.track-lane') as HTMLElement | null;
      const targetTrackId = laneEl?.dataset.trackId;
      let trackId = clip.trackId;
      if (targetTrackId) {
        const targetTrack = allTracks.find((t) => t.id === targetTrackId);
        const compatible =
          targetTrack &&
          !targetTrack.locked &&
          ((clip.kind === 'video' && (targetTrack.type === 'video' || targetTrack.type === 'overlayVideo')) ||
            (clip.kind === 'audio' && (targetTrack.type === 'audio' || targetTrack.type === 'music' || targetTrack.type === 'voiceover')) ||
            (clip.kind === 'image' && (targetTrack.type === 'video' || targetTrack.type === 'image' || targetTrack.type === 'overlayVideo')) ||
            (clip.kind === 'text' && targetTrack.type === 'text') ||
            (clip.kind === 'sticker' && targetTrack.type === 'sticker') ||
            (clip.kind === 'subtitle' && targetTrack.type === 'subtitle'));
        if (compatible) trackId = targetTrackId;
      }

      updateClip(clip.id, { start: newStart, trackId } as any, `move-${clip.id}`);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onHandlePointerDown = (side: 'left' | 'right') => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (track.locked) return;
    const startClientX = e.clientX;
    const origStart = clip.start;
    const origDuration = clip.duration;
    const origSourceIn = clip.sourceIn;
    const speed = 'speed' in clip ? clip.speed.rate : 1;
    const mediaDuration = mediaAsset?.metadata.duration ?? Infinity;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dSeconds = dx / pixelsPerSecond;

      if (side === 'left') {
        let newStart = origStart + dSeconds;
        let newDuration = origDuration - dSeconds;
        let newSourceIn = origSourceIn + dSeconds * speed;
        if (newDuration < MIN_DURATION) return;
        if (newStart < 0) return;
        if (newSourceIn < 0) return;
        updateClip(clip.id, { start: newStart, duration: newDuration, sourceIn: newSourceIn } as any, `trimL-${clip.id}`);
      } else {
        let newDuration = origDuration + dSeconds;
        if (newDuration < MIN_DURATION) return;
        const newSourceOut = origSourceIn + newDuration * speed;
        if (mediaAsset && newSourceOut > mediaDuration + 0.001) return;
        updateClip(clip.id, { duration: newDuration, sourceOut: newSourceOut } as any, `trimR-${clip.id}`);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const left = clip.start * pixelsPerSecond;
  const width = Math.max(4, clip.duration * pixelsPerSecond);

  return (
    <div
      className={`timeline-clip kind-${clip.kind} ${selected ? 'selected' : ''}`}
      style={{ left, width }}
      onPointerDown={onClipPointerDown}
    >
      <div className="timeline-clip__label">{clip.name}</div>
      {clip.kind === 'video' && mediaAsset?.filmstrip && width > 24 && (
        <div className="timeline-clip__thumbs">
          {mediaAsset.filmstrip.map((f, i) => <img key={i} src={f} draggable={false} />)}
        </div>
      )}
      {(clip.kind === 'audio' || (clip.kind === 'video' && mediaAsset?.waveformPeaks)) && (
        <canvas ref={canvasRef} className="timeline-clip__waveform" style={{ width: '100%', height: clip.kind === 'audio' ? '100%' : '30%' }} />
      )}
      {!track.locked && (
        <>
          <div className="timeline-clip__handle left" data-handle="left" onPointerDown={onHandlePointerDown('left')} />
          <div className="timeline-clip__handle right" data-handle="right" onPointerDown={onHandlePointerDown('right')} />
        </>
      )}
    </div>
  );
}
