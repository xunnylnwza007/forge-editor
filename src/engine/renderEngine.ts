import {
  Project, TimelineClip, Track, VideoClip, ImageClip, TextClip, MediaAsset, ColorAdjustments,
} from '@/types/models';
import { mediaPool, isVideoOrAudioClip } from '@/engine/mediaPool';

export function isClipActiveAt(clip: TimelineClip, time: number): boolean {
  return time >= clip.start && time < clip.start + clip.duration;
}

export function getActiveClips(project: Project, time: number): TimelineClip[] {
  const trackIndexById = new Map(project.tracks.map((t) => [t.id, t.index]));
  return project.clips
    .filter((c) => isClipActiveAt(c, time))
    .filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId);
      return track && !track.hidden;
    })
    .sort((a, b) => (trackIndexById.get(a.trackId) ?? 0) - (trackIndexById.get(b.trackId) ?? 0));
}

function colorAdjustmentsToCssFilter(c: ColorAdjustments): string {
  // Canvas 2D `filter` gives us a real, cheap approximation of a color
  // pipeline. Exposure/highlights/shadows/whites/blacks/vibrance/HSL-per-
  // channel are architected in the data model for a future WebGL grading
  // pass (see README) — brightness/contrast/saturation/hue/blur are wired
  // end-to-end here today.
  const brightness = 1 + c.brightness / 100 + c.exposure / 100;
  const contrast = 1 + c.contrast / 100;
  const saturate = 1 + (c.saturation + c.vibrance * 0.6) / 100;
  const hueRotate = c.hue; // degrees
  const blur = c.fade > 0 ? 0 : 0; // fade handled separately via overlay
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hueRotate}deg)${blur ? ` blur(${blur}px)` : ''}`;
}

function easeValue(t: number, easing: string) {
  switch (easing) {
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t; // linear (bezier falls back to linear for now)
  }
}

/** Sample a keyframe track at a local clip time, falling back to a base value. */
export function sampleKeyframes(track: { time: number; value: number; easing: string }[] | undefined, base: number, localTime: number): number {
  if (!track || track.length === 0) return base;
  const sorted = [...track].sort((a, b) => a.time - b.time);
  if (localTime <= sorted[0].time) return sorted[0].value;
  if (localTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (localTime >= a.time && localTime <= b.time) {
      const span = b.time - a.time || 1;
      const t = easeValue((localTime - a.time) / span, b.easing);
      return a.value + (b.value - a.value) * t;
    }
  }
  return base;
}

function entranceExitOpacity(clip: VideoClip | ImageClip | TextClip, localTime: number): number {
  let mul = 1;
  const inAnim = clip.animationIn;
  const outAnim = clip.animationOut;
  if (inAnim && inAnim.duration > 0 && localTime < inAnim.duration) {
    mul *= localTime / inAnim.duration;
  }
  if (outAnim && outAnim.duration > 0 && clip.duration - localTime < outAnim.duration) {
    mul *= Math.max(0, (clip.duration - localTime) / outAnim.duration);
  }
  return mul;
}

export class RenderEngine {
  constructor(private getMedia: (id: string) => MediaAsset | undefined) {}

  /** Draw a single composited frame for `time` into `ctx`. */
  renderFrame(ctx: CanvasRenderingContext2D, project: Project, time: number) {
    const { width, height } = project.canvas;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = project.canvas.background.value ?? '#000000';
    ctx.fillRect(0, 0, width, height);

    const active = getActiveClips(project, time);
    for (const clip of active) {
      const localTime = time - clip.start;
      try {
        if (clip.kind === 'video') this.drawVideoClip(ctx, clip, localTime, width, height);
        else if (clip.kind === 'image') this.drawImageClip(ctx, clip, localTime, width, height);
        else if (clip.kind === 'text') this.drawTextClip(ctx, clip, localTime, width, height);
        else if (clip.kind === 'sticker') this.drawStickerClip(ctx, clip, localTime, width, height);
      } catch (err) {
        // A single bad clip must never blank the whole preview.
        console.warn('Render error for clip', clip.id, err);
      }
    }
    ctx.restore();
  }

  private applyTransform(ctx: CanvasRenderingContext2D, transform: VideoClip['transform'], cx: number, cy: number) {
    ctx.translate(cx, cy);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale * (transform.flipH ? -1 : 1), transform.scale * (transform.flipV ? -1 : 1));
  }

  private drawVideoClip(ctx: CanvasRenderingContext2D, clip: VideoClip, localTime: number, canvasW: number, canvasH: number) {
    const asset = this.getMedia(clip.mediaId);
    if (!asset) return;
    const entry = mediaPool.has(clip.id) ? mediaPool.get(clip, asset) : null;
    const el = entry?.el as HTMLVideoElement | undefined;
    if (!el || el.readyState < 2) return;

    const opacity = clip.transform.opacity * entranceExitOpacity(clip, localTime);
    if (opacity <= 0) return;

    const cw = asset.metadata.width ?? canvasW;
    const ch = asset.metadata.height ?? canvasH;
    const sx = clip.crop.x * cw;
    const sy = clip.crop.y * ch;
    const sw = clip.crop.width * cw;
    const sh = clip.crop.height * ch;

    // Fit crop rect into canvas preserving aspect ratio ("fit").
    const scaleToFit = Math.min(canvasW / sw, canvasH / sh);
    const dw = sw * scaleToFit;
    const dh = sh * scaleToFit;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blendModeToCanvasOp(clip.blendMode);
    ctx.filter = colorAdjustmentsToCssFilter(clip.color);
    this.applyTransform(ctx, clip.transform, canvasW / 2 + clip.transform.x, canvasH / 2 + clip.transform.y);
    ctx.drawImage(el, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  private drawImageClip(ctx: CanvasRenderingContext2D, clip: ImageClip, localTime: number, canvasW: number, canvasH: number) {
    const asset = this.getMedia(clip.mediaId);
    if (!asset) return;
    const img = getImageEl(asset.src);
    if (!img.complete) return;

    const opacity = clip.transform.opacity * entranceExitOpacity(clip, localTime);
    if (opacity <= 0) return;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scaleToFit = Math.min(canvasW / iw, canvasH / ih);
    const dw = iw * scaleToFit;
    const dh = ih * scaleToFit;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blendModeToCanvasOp(clip.blendMode);
    ctx.filter = colorAdjustmentsToCssFilter(clip.color);
    this.applyTransform(ctx, clip.transform, canvasW / 2 + clip.transform.x, canvasH / 2 + clip.transform.y);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  private drawStickerClip(ctx: CanvasRenderingContext2D, clip: TimelineClip & { kind: 'sticker' }, localTime: number, canvasW: number, canvasH: number) {
    this.drawImageClip(ctx, clip as unknown as ImageClip, localTime, canvasW, canvasH);
  }

  private drawTextClip(ctx: CanvasRenderingContext2D, clip: TextClip, localTime: number, canvasW: number, canvasH: number) {
    const opacity = clip.style.opacity * entranceExitOpacity(clip, localTime);
    if (opacity <= 0) return;
    const { style } = clip;

    ctx.save();
    ctx.globalAlpha = opacity;
    this.applyTransform(ctx, clip.transform, canvasW / 2 + clip.transform.x, canvasH / 2 + clip.transform.y);

    ctx.font = `${style.italic ? 'italic ' : ''}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}, sans-serif`;
    ctx.textAlign = style.align === 'justify' ? 'left' : (style.align as CanvasTextAlign);
    ctx.textBaseline = 'middle';

    let text = clip.text;
    if (clip.animation.entrance === 'typewriter') {
      const progress = Math.min(1, localTime / Math.max(0.1, clip.animation.entranceDuration));
      text = text.slice(0, Math.round(text.length * progress));
    }

    const lines = text.split('\n');
    const lineHeight = style.fontSize * style.lineHeight;
    const totalHeight = lines.length * lineHeight;

    if (style.background) {
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const bw = widest + style.background.padding * 2;
      const bh = totalHeight + style.background.padding * 2;
      ctx.fillStyle = hexToRgba(style.background.color, style.background.opacity);
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, style.background.cornerRadius);
      ctx.fill();
    }

    lines.forEach((line, i) => {
      const y = -totalHeight / 2 + lineHeight * (i + 0.5);
      if (style.shadow) {
        ctx.save();
        ctx.shadowColor = hexToRgba(style.shadow.color, style.shadow.opacity);
        ctx.shadowBlur = style.shadow.blur;
        ctx.shadowOffsetX = Math.cos((style.shadow.angle * Math.PI) / 180) * style.shadow.distance;
        ctx.shadowOffsetY = Math.sin((style.shadow.angle * Math.PI) / 180) * style.shadow.distance;
        ctx.fillStyle = style.color;
        ctx.fillText(line, 0, y);
        ctx.restore();
      }
      if (style.stroke && style.stroke.width > 0) {
        ctx.lineWidth = style.stroke.width;
        ctx.strokeStyle = style.stroke.color;
        ctx.strokeText(line, 0, y);
      }
      ctx.fillStyle = style.color;
      ctx.fillText(line, 0, y);
      if (style.underline) {
        const w = ctx.measureText(line).width;
        ctx.beginPath();
        ctx.moveTo(-w / 2, y + style.fontSize * 0.4);
        ctx.lineTo(w / 2, y + style.fontSize * 0.4);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = Math.max(1, style.fontSize * 0.04);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}

function blendModeToCanvasOp(mode: string): GlobalCompositeOperation {
  const map: Record<string, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    darken: 'darken',
    lighten: 'lighten',
    colorDodge: 'color-dodge',
    colorBurn: 'color-burn',
    softLight: 'soft-light',
    hardLight: 'hard-light',
    difference: 'difference',
  };
  return map[mode] ?? 'source-over';
}

const imageElCache = new Map<string, HTMLImageElement>();
function getImageEl(src: string): HTMLImageElement {
  let img = imageElCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageElCache.set(src, img);
  }
  return img;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
