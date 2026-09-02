import { useMemo, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { VisualClipCommon, TimelineClip } from '@/types/models';
import { isClipActiveAt } from '@/engine/renderEngine';

function isVisualClip(c: TimelineClip): c is TimelineClip & VisualClipCommon {
  return c.kind === 'video' || c.kind === 'image' || c.kind === 'text' || c.kind === 'sticker';
}

export function PreviewOverlay({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) {
  const project = useProjectStore((s) => s.project);
  const updateClip = useProjectStore((s) => s.updateClip);
  const selectedClipIds = useUIStore((s) => s.selectedClipIds);
  const playheadTime = useUIStore((s) => s.playheadTime);
  const dragState = useRef<{ mode: 'move' | 'scale' | 'rotate'; startX: number; startY: number; orig: any } | null>(null);

  const clip = useMemo(() => {
    const c = project.clips.find((c) => selectedClipIds.includes(c.id) && isVisualClip(c) && isClipActiveAt(c, playheadTime));
    return c && isVisualClip(c) ? c : null;
  }, [project.clips, selectedClipIds, playheadTime]);

  const asset = clip && 'mediaId' in clip ? project.mediaAssets.find((a) => a.id === (clip as any).mediaId) : undefined;

  if (!clip) return null;

  const canvasW = project.canvas.width;
  const canvasH = project.canvas.height;

  // Approximate the clip's unscaled display box in canvas coordinates.
  let boxW: number;
  let boxH: number;
  if (asset?.metadata.width && asset?.metadata.height) {
    const scaleToFit = Math.min(canvasW / asset.metadata.width, canvasH / asset.metadata.height);
    boxW = asset.metadata.width * scaleToFit;
    boxH = asset.metadata.height * scaleToFit;
  } else if (clip.kind === 'text') {
    boxW = Math.min(canvasW * 0.7, 600);
    boxH = clip.style.fontSize * clip.style.lineHeight * 1.6;
  } else {
    boxW = canvasW * 0.4;
    boxH = canvasH * 0.4;
  }

  const t = clip.transform;
  const centerXPct = ((canvasW / 2 + t.x) / canvasW) * 100;
  const centerYPct = ((canvasH / 2 + t.y) / canvasH) * 100;
  const wPct = (boxW * t.scale / canvasW) * 100;
  const hPct = (boxH * t.scale / canvasH) * 100;

  const startDrag = (mode: 'move' | 'scale' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragState.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...t } };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;

    if (ds.mode === 'move') {
      const dx = (e.clientX - ds.startX) * scaleX;
      const dy = (e.clientY - ds.startY) * scaleY;
      updateClip(clip.id, { transform: { ...t, x: ds.orig.x + dx, y: ds.orig.y + dy } } as any, 'overlay-move');
    } else if (ds.mode === 'scale') {
      const dx = (e.clientX - ds.startX) * scaleX;
      const delta = dx / (boxW / 2);
      const newScale = Math.max(0.05, ds.orig.scale + delta);
      updateClip(clip.id, { transform: { ...t, scale: newScale } } as any, 'overlay-scale');
    } else if (ds.mode === 'rotate') {
      const cx = rect.left + (centerXPct / 100) * rect.width;
      const cy = rect.top + (centerYPct / 100) * rect.height;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      updateClip(clip.id, { transform: { ...t, rotation: Math.round(angle) } } as any, 'overlay-rotate');
    }
  };

  const endDrag = () => { dragState.current = null; };

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
    >
      <div
        style={{
          position: 'absolute',
          left: `${centerXPct}%`, top: `${centerYPct}%`,
          width: `${wPct}%`, height: `${hPct}%`,
          transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
          border: '1.5px solid var(--accent)',
          pointerEvents: 'auto',
          cursor: 'move',
        }}
        onPointerDown={startDrag('move')}
      >
        <div
          onPointerDown={startDrag('rotate')}
          title="Rotate"
          style={{
            position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)',
            width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', cursor: 'grab', pointerEvents: 'auto',
          }}
        />
        <div
          onPointerDown={startDrag('scale')}
          title="Scale"
          style={{
            position: 'absolute', right: -6, bottom: -6,
            width: 12, height: 12, background: 'var(--accent)', cursor: 'nwse-resize', pointerEvents: 'auto', borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}
