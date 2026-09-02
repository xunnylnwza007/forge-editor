import { ExportSettings, MediaAsset, Project } from '@/types/models';
import { RenderEngine } from '@/engine/renderEngine';
import { syncMediaElements } from '@/engine/syncEngine';
import { mediaPool } from '@/engine/mediaPool';

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'finalizing' | 'done' | 'error' | 'cancelled';
  framesRendered: number;
  totalFrames: number;
  renderFps: number;
  etaSeconds: number | null;
  error?: string;
}

export interface ExportHandle {
  cancel: () => void;
  promise: Promise<Blob>;
}

function pickMimeType(settings: ExportSettings): string {
  const candidates =
    settings.format === 'webm'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

function projectDuration(project: Project): number {
  return project.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

/**
 * Exports by driving the master clock frame-by-frame (not in realtime),
 * rendering each frame into an offscreen canvas, and capturing the canvas
 * stream + a mixed Web Audio stream through MediaRecorder. This is the
 * pragmatic engine that runs entirely in-browser with zero extra downloads;
 * see README for how to swap in a WebCodecs/ffmpeg.wasm encoder for
 * frame-accurate, non-realtime-limited export later.
 */
export function exportProject(
  project: Project,
  getMedia: (id: string) => MediaAsset | undefined,
  onProgress: (p: ExportProgress) => void,
): ExportHandle {
  let cancelled = false;
  const settings = project.exportSettings;

  const promise = (async (): Promise<Blob> => {
    onProgress({ phase: 'preparing', framesRendered: 0, totalFrames: 0, renderFps: 0, etaSeconds: null });

    const duration = projectDuration(project);
    const fps = settings.fps;
    const totalFrames = Math.max(1, Math.round(duration * fps));

    const canvas = document.createElement('canvas');
    canvas.width = settings.width;
    canvas.height = settings.height;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const scaledProject: Project = {
      ...project,
      canvas: { ...project.canvas, width: settings.width, height: settings.height },
    };

    const engine = new RenderEngine(getMedia);

    // Audio: reuse the shared pool's context via a MediaStreamAudioDestinationNode
    // tapped from the same graph used for live playback (per-clip gain nodes
    // already route there), so exported audio matches the preview mix.
    const audioCtx = (mediaPool as any)['ctx'] as AudioContext | undefined;
    let audioDestNode: MediaStreamAudioDestinationNode | null = null;
    if (audioCtx) {
      audioDestNode = audioCtx.createMediaStreamDestination();
    }

    const canvasStream = (canvas as HTMLCanvasElement).captureStream(0); // manual frame ticking
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (audioDestNode) tracks.push(...audioDestNode.stream.getAudioTracks());
    const mixedStream = new MediaStream(tracks);

    const mimeType = pickMimeType(settings);
    const recorder = new MediaRecorder(mixedStream, {
      mimeType,
      videoBitsPerSecond: settings.bitrateMbps * 1_000_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(250);

    const videoTrack = canvasStream.getVideoTracks()[0] as any;
    const startTime = performance.now();

    for (let f = 0; f < totalFrames; f++) {
      if (cancelled) break;
      const t = f / fps;

      engine.renderFrame(ctx, scaledProject, t);
      syncMediaElements(scaledProject, t, false, getMedia);
      // Let any currentTime seeks resolve before grabbing the frame.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 0));
      engine.renderFrame(ctx, scaledProject, t);

      if (typeof videoTrack.requestFrame === 'function') videoTrack.requestFrame();

      if (f % 5 === 0 || f === totalFrames - 1) {
        const elapsed = (performance.now() - startTime) / 1000;
        const renderFps = f / Math.max(0.001, elapsed);
        const remaining = totalFrames - f;
        onProgress({
          phase: 'rendering',
          framesRendered: f,
          totalFrames,
          renderFps,
          etaSeconds: renderFps > 0 ? remaining / renderFps : null,
        });
      }
    }

    onProgress({ phase: 'finalizing', framesRendered: totalFrames, totalFrames, renderFps: 0, etaSeconds: 0 });
    recorder.stop();
    await stopped;

    if (cancelled) {
      onProgress({ phase: 'cancelled', framesRendered: 0, totalFrames, renderFps: 0, etaSeconds: null });
      throw new Error('Export cancelled');
    }

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
    onProgress({ phase: 'done', framesRendered: totalFrames, totalFrames, renderFps: 0, etaSeconds: 0 });
    return blob;
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
    promise,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function estimateFileSizeMB(project: Project): number {
  const duration = projectDuration(project);
  const bitrateMbps = project.exportSettings.bitrateMbps;
  return (duration * bitrateMbps) / 8;
}
