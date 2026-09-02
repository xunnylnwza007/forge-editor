export function formatTimecode(seconds: number, fps = 30): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds - Math.floor(seconds)) * fps);
  const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}` : `${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function parseTimecodeToSeconds(tc: string, fps = 30): number {
  const parts = tc.split(':').map((p) => parseInt(p, 10) || 0);
  let h = 0, m = 0, s = 0, f = 0;
  if (parts.length === 4) [h, m, s, f] = parts;
  else if (parts.length === 3) [m, s, f] = parts;
  else if (parts.length === 2) [s, f] = parts;
  return h * 3600 + m * 60 + s + f / fps;
}

/** Snap a candidate time to the nearest of a set of guide times, within a
 * pixel-derived tolerance. Returns the snapped time and whether it snapped. */
export function snapTime(candidate: number, guides: number[], toleranceSeconds: number): { time: number; snapped: boolean; guide?: number } {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const g of guides) {
    const d = Math.abs(g - candidate);
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  if (best !== null && bestDist <= toleranceSeconds) {
    return { time: best, snapped: true, guide: best };
  }
  return { time: candidate, snapped: false };
}
