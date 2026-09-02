import { useCallback } from 'react';
import { formatTimecode } from '@/utils/time';
import { Marker } from '@/types/models';

function pickTickInterval(pps: number): number {
  // seconds per major tick, chosen so ticks stay readably spaced regardless of zoom
  const targetPx = 90;
  const rawSeconds = targetPx / pps;
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600];
  return steps.find((s) => s >= rawSeconds) ?? 900;
}

export function Ruler({
  pixelsPerSecond, duration, fps, onSeek, markers, width,
}: {
  pixelsPerSecond: number;
  duration: number;
  fps: number;
  onSeek: (t: number) => void;
  markers: Marker[];
  width: number;
}) {
  const interval = pickTickInterval(pixelsPerSecond);
  const totalSeconds = Math.max(duration + 10, width / pixelsPerSecond);
  const tickCount = Math.ceil(totalSeconds / interval) + 1;

  const handlePointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, (e.clientX - rect.left) / pixelsPerSecond);
    onSeek(t);
  }, [pixelsPerSecond, onSeek]);

  return (
    <div
      className="ruler"
      style={{ width }}
      onPointerDown={(e) => {
        handlePointer(e);
        (e.target as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => { if (e.buttons === 1) handlePointer(e); }}
    >
      {Array.from({ length: tickCount }, (_, i) => {
        const t = i * interval;
        return (
          <div key={i}>
            <div className="ruler__tick" style={{ left: t * pixelsPerSecond }} />
            <div className="ruler__label" style={{ left: t * pixelsPerSecond }}>{formatTimecode(t, fps).replace(/:\d{2}$/, '')}</div>
          </div>
        );
      })}
      {markers.map((m) => (
        <div key={m.id} className="marker" style={{ left: m.time * pixelsPerSecond }} title={m.label}>
          <div className="marker__flag" style={{ background: m.color }} />
        </div>
      ))}
    </div>
  );
}
