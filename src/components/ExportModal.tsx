import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { exportProject, ExportProgress, downloadBlob, estimateFileSizeMB, ExportHandle } from '@/engine/exportEngine';
import { projectDuration } from '@/hooks/usePlaybackEngine';
import { formatTimecode } from '@/utils/time';
import { MediaAsset, ExportSettings } from '@/types/models';

const RESOLUTION_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '480p': { w: 854, h: 480 },
  '720p': { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
  '1440p': { w: 2560, h: 1440 },
  '2160p': { w: 3840, h: 2160 },
};

const SOCIAL_PRESETS = [
  { label: 'TikTok', w: 1080, h: 1920, fps: 30, bitrate: 10 },
  { label: 'Instagram Reel', w: 1080, h: 1920, fps: 30, bitrate: 10 },
  { label: 'YouTube Shorts', w: 1080, h: 1920, fps: 30, bitrate: 12 },
  { label: 'YouTube', w: 1920, h: 1080, fps: 30, bitrate: 16 },
  { label: 'Instagram Feed', w: 1080, h: 1080, fps: 30, bitrate: 10 },
];

export function ExportModal({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const setExportSettings = useProjectStore((s) => s.setExportSettings);
  const settings = project.exportSettings;

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [handle, setHandle] = useState<ExportHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const duration = projectDuration(project.clips);
  const sizeMB = estimateFileSizeMB(project);

  const applyResolution = (preset: keyof typeof RESOLUTION_DIMENSIONS) => {
    const dims = RESOLUTION_DIMENSIONS[preset];
    setExportSettings({ resolutionPreset: preset as any, width: dims.w, height: dims.h });
  };

  const applySocialPreset = (p: typeof SOCIAL_PRESETS[number]) => {
    setExportSettings({ width: p.w, height: p.h, fps: p.fps, bitrateMbps: p.bitrate, resolutionPreset: 'custom' });
  };

  const getMedia = (id: string): MediaAsset | undefined => project.mediaAssets.find((a) => a.id === id);

  const startExport = () => {
    setError(null);
    if (duration <= 0) {
      setError('Timeline is empty — add clips before exporting.');
      return;
    }
    const h = exportProject(project, getMedia, setProgress);
    setHandle(h);
    h.promise
      .then((blob) => {
        const ext = settings.format === 'webm' ? 'webm' : blob.type.includes('webm') ? 'webm' : 'mp4';
        downloadBlob(blob, `${project.name.replace(/[^\w-]+/g, '_')}.${ext}`);
      })
      .catch((e) => {
        if (e?.message !== 'Export cancelled') setError(e?.message ?? 'Export failed.');
      });
  };

  const busy = progress && progress.phase !== 'done' && progress.phase !== 'error' && progress.phase !== 'cancelled';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal">
        <h2>Export Video</h2>

        {!progress || !busy ? (
          <>
            <div className="field-group">
              <div className="field-group__title">Social Presets</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SOCIAL_PRESETS.map((p) => (
                  <button key={p.label} className="btn" style={{ fontSize: 11.5 }} onClick={() => applySocialPreset(p)}>{p.label}</button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <div className="field-group__title">Format</div>
              <div className="field-row">
                <label>Container</label>
                <select value={settings.format} onChange={(e) => setExportSettings({ format: e.target.value as any })} style={{ flex: 1 }}>
                  <option value="mp4">MP4</option>
                  <option value="webm">WebM</option>
                </select>
              </div>
              <div className="field-row">
                <label>Resolution</label>
                <select value={settings.resolutionPreset} onChange={(e) => applyResolution(e.target.value as any)} style={{ flex: 1 }}>
                  {Object.keys(RESOLUTION_DIMENSIONS).map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="field-row-2">
                <div><label>Width</label><input type="number" value={settings.width} onChange={(e) => setExportSettings({ width: Number(e.target.value), resolutionPreset: 'custom' })} /></div>
                <div><label>Height</label><input type="number" value={settings.height} onChange={(e) => setExportSettings({ height: Number(e.target.value), resolutionPreset: 'custom' })} /></div>
              </div>
              <div className="field-row">
                <label>Frame Rate</label>
                <select value={settings.fps} onChange={(e) => setExportSettings({ fps: Number(e.target.value) })} style={{ flex: 1 }}>
                  {[24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{f} fps</option>)}
                </select>
              </div>
              <div className="field-row">
                <label>Bitrate</label>
                <input type="range" min={2} max={60} value={settings.bitrateMbps} onChange={(e) => setExportSettings({ bitrateMbps: Number(e.target.value) })} />
                <span className="field-value">{settings.bitrateMbps} Mbps</span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-group__title">Estimate</div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.8 }}>
                Duration: {formatTimecode(duration, settings.fps)}<br />
                Estimated size: ~{sizeMB.toFixed(1)} MB
              </div>
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

            <div className="modal__footer">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={startExport}>Start Export</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              {progress.phase === 'preparing' && 'Preparing…'}
              {progress.phase === 'rendering' && `Rendering frame ${progress.framesRendered} / ${progress.totalFrames}`}
              {progress.phase === 'finalizing' && 'Finalizing file…'}
            </div>
            <div className="progress-bar"><div className="progress-bar__fill" style={{ width: `${(progress.framesRendered / Math.max(1, progress.totalFrames)) * 100}%` }} /></div>
            <div style={{ fontSize: 11.5, color: 'var(--text-low)' }}>
              {progress.renderFps > 0 && `${progress.renderFps.toFixed(1)} fps render speed`}
              {progress.etaSeconds !== null && progress.etaSeconds > 0 && ` · ~${Math.ceil(progress.etaSeconds)}s remaining`}
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => handle?.cancel()}>Cancel Export</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
