import { useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { playbackClock } from '@/engine/playbackClock';
import { RenderEngine } from '@/engine/renderEngine';
import { syncMediaElements } from '@/engine/syncEngine';
import { mediaPool } from '@/engine/mediaPool';
import { MediaAsset } from '@/types/models';

export function projectDuration(clips: { start: number; duration: number }[]): number {
  return clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export function usePlaybackEngine(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const project = useProjectStore((s) => s.project);
  const setPlayheadTime = useUIStore((s) => s.setPlayheadTime);
  const setIsPlaying = useUIStore((s) => s.setIsPlaying);
  const previewQuality = useUIStore((s) => s.previewQuality);

  const projectRef = useRef(project);
  projectRef.current = project;

  const mediaById = useMemo(() => {
    const m = new Map<string, MediaAsset>();
    project.mediaAssets.forEach((a) => m.set(a.id, a));
    return m;
  }, [project.mediaAssets]);
  const mediaByIdRef = useRef(mediaById);
  mediaByIdRef.current = mediaById;

  const engine = useMemo(() => new RenderEngine((id) => mediaByIdRef.current.get(id)), []);

  useEffect(() => {
    playbackClock.setDuration(projectDuration(project.clips));
  }, [project.clips]);

  useEffect(() => {
    const unsub = playbackClock.subscribe((time) => {
      setPlayheadTime(time);
      setIsPlaying(playbackClock.isPlaying);
      const p = projectRef.current;

      syncMediaElements(p, time, playbackClock.isPlaying, (id) => mediaByIdRef.current.get(id));

      const canvas = canvasRef.current;
      if (canvas) {
        const scale = previewQuality === 'full' ? 1 : previewQuality === 'half' ? 0.5 : 0.25;
        const w = Math.round(p.canvas.width * scale);
        const h = Math.round(p.canvas.height * scale);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (scale === 1) {
            engine.renderFrame(ctx, p, time);
          } else {
            ctx.save();
            ctx.scale(scale, scale);
            engine.renderFrame(ctx, { ...p }, time);
            ctx.restore();
          }
        }
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, engine, previewQuality]);

  // Repaint immediately (even while paused) whenever project data changes,
  // e.g. a transform slider drag, so the preview never looks stale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    engine.renderFrame(ctx, project, playbackClock.time);
  }, [project, engine, canvasRef]);

  return {
    play: () => { mediaPool.resumeAudioContext(); playbackClock.play(); },
    pause: () => playbackClock.pause(),
    togglePlay: () => { mediaPool.resumeAudioContext(); playbackClock.togglePlay(); },
    seek: (t: number) => playbackClock.seek(t),
    stepFrame: (dir: 1 | -1) => playbackClock.stepFrame(project.canvas.fps, dir),
    duration: projectDuration(project.clips),
  };
}
