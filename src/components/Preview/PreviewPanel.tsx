import { useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Maximize2,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { usePlaybackEngine } from '@/hooks/usePlaybackEngine';
import { formatTimecode } from '@/utils/time';
import { PreviewOverlay } from '@/components/Preview/PreviewOverlay';

export function PreviewPanel() {
  const project = useProjectStore((s) => s.project);
  const playheadTime = useUIStore((s) => s.playheadTime);
  const isPlaying = useUIStore((s) => s.isPlaying);
  const previewQuality = useUIStore((s) => s.previewQuality);
  const setPreviewQuality = useUIStore((s) => s.setPreviewQuality);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = usePlaybackEngine(canvasRef);
  const [zoom, setZoom] = useState<'fit' | 25 | 50 | 75 | 100>('fit');

  const aspect = project.canvas.width / project.canvas.height;
  const fitStyle: React.CSSProperties =
    zoom === 'fit'
      ? { width: '100%', height: '100%', objectFit: 'contain' as const }
      : { width: project.canvas.width * (zoom / 100), height: project.canvas.height * (zoom / 100) };

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current.requestFullscreen();
  };

  return (
    <div className="panel preview-panel">
      <div className="preview-panel__stage" ref={stageRef}>
        <div
          className="preview-panel__canvas-wrap"
          style={{ aspectRatio: `${project.canvas.width} / ${project.canvas.height}`, ...(zoom === 'fit' ? { width: '86%', height: '80%' } : {}) }}
        >
          <canvas ref={canvasRef} width={project.canvas.width} height={project.canvas.height} style={fitStyle} onClick={() => engine.togglePlay()} />
          <PreviewOverlay canvasRef={canvasRef} />
        </div>
      </div>
      <div className="preview-controls">
        <button className="btn ghost icon" title="Jump to Start" onClick={() => engine.seek(0)}><SkipBack size={15} /></button>
        <button className="btn ghost icon" title="Previous Frame (Left Arrow)" onClick={() => engine.stepFrame(-1)}><ChevronLeft size={15} /></button>
        <button className="btn primary icon" title="Play/Pause (Space)" onClick={() => engine.togglePlay()}>
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button className="btn ghost icon" title="Next Frame (Right Arrow)" onClick={() => engine.stepFrame(1)}><ChevronRight size={15} /></button>
        <button className="btn ghost icon" title="Jump to End" onClick={() => engine.seek(engine.duration)}><SkipForward size={15} /></button>
        <span className="preview-controls__timecode">{formatTimecode(playheadTime, project.canvas.fps)}</span>
        <div className="preview-controls__spacer" />
        <select value={previewQuality} onChange={(e) => setPreviewQuality(e.target.value as any)} title="Preview quality">
          <option value="full">Preview: Full</option>
          <option value="half">Preview: 1/2</option>
          <option value="quarter">Preview: 1/4</option>
        </select>
        <select value={zoom} onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : (Number(e.target.value) as any))} title="Zoom">
          <option value="fit">Fit</option>
          <option value="25">25%</option>
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
        </select>
        <button className="btn ghost icon" title="Fullscreen" onClick={toggleFullscreen}><Maximize2 size={15} /></button>
      </div>
    </div>
  );
}
