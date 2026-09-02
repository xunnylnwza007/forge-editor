import { useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import {
  AudioClip, BlendMode, CropMode, DEFAULT_COLOR, DEFAULT_TRANSFORM, ImageClip, SpeedCurvePreset,
  TextClip, TimelineClip, Transform2D, VideoClip, VisualClipCommon,
} from '@/types/models';
import { SliderField, SelectField, CheckboxField, ColorField, FieldGroup } from '@/components/Inspector/fields';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'colorDodge', 'colorBurn', 'softLight', 'hardLight', 'difference',
].map((v) => ({ value: v as BlendMode, label: v.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) }));

const CROP_PRESETS: CropMode[] = ['free', '16:9', '9:16', '1:1', '4:5', '4:3', '3:2', '21:9'];
const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const SPEED_CURVES: SpeedCurvePreset[] = ['none', 'montage', 'hero', 'bullet', 'jumpCut', 'flashIn', 'flashOut'];

function isVisual(c: TimelineClip): c is TimelineClip & VisualClipCommon {
  return c.kind === 'video' || c.kind === 'image' || c.kind === 'text' || c.kind === 'sticker';
}

export function InspectorPanel() {
  const project = useProjectStore((s) => s.project);
  const updateClip = useProjectStore((s) => s.updateClip);
  const setCanvasSettings = useProjectStore((s) => s.setCanvasSettings);
  const selectedClipIds = useUIStore((s) => s.selectedClipIds);

  const clip = useMemo(
    () => (selectedClipIds.length === 1 ? project.clips.find((c) => c.id === selectedClipIds[0]) : undefined),
    [project.clips, selectedClipIds],
  );

  const patch = (p: Partial<TimelineClip>, coalesceKey?: string) => clip && updateClip(clip.id, p, coalesceKey);

  return (
    <div className="panel inspector-panel">
      <div className="inspector-body">
        {!clip && selectedClipIds.length === 0 && <ProjectSettingsPanel />}
        {!clip && selectedClipIds.length > 1 && <div className="inspector-empty">{selectedClipIds.length} clips selected. Select a single clip to edit its properties.</div>}
        {clip && isVisual(clip) && (clip.kind === 'video' || clip.kind === 'image' || clip.kind === 'sticker') && (
          <VisualInspector clip={clip as VideoClip | ImageClip} patch={patch} />
        )}
        {clip && clip.kind === 'audio' && <AudioInspector clip={clip as AudioClip} patch={patch} />}
        {clip && clip.kind === 'text' && <TextInspector clip={clip as TextClip} patch={patch} />}
      </div>
    </div>
  );
}

function ProjectSettingsPanel() {
  const project = useProjectStore((s) => s.project);
  const setCanvasSettings = useProjectStore((s) => s.setCanvasSettings);
  const setExportSettings = useProjectStore((s) => s.setExportSettings);

  const presets: { label: string; w: number; h: number; ratio: any }[] = [
    { label: '1920×1080 (16:9)', w: 1920, h: 1080, ratio: '16:9' },
    { label: '1080×1920 (9:16)', w: 1080, h: 1920, ratio: '9:16' },
    { label: '1080×1080 (1:1)', w: 1080, h: 1080, ratio: '1:1' },
    { label: '1080×1350 (4:5)', w: 1080, h: 1350, ratio: '4:5' },
    { label: '3840×2160 (4K)', w: 3840, h: 2160, ratio: '16:9' },
  ];

  return (
    <>
      <FieldGroup title="Canvas">
        <SelectField
          label="Preset"
          value={`${project.canvas.width}x${project.canvas.height}`}
          options={presets.map((p) => ({ value: `${p.w}x${p.h}`, label: p.label }))}
          onChange={(v) => {
            const p = presets.find((x) => `${x.w}x${x.h}` === v);
            if (p) setCanvasSettings({ width: p.w, height: p.h, aspectRatio: p.ratio });
          }}
        />
        <div className="field-row-2">
          <div><label>Width</label><input type="number" value={project.canvas.width} onChange={(e) => setCanvasSettings({ width: Number(e.target.value) })} /></div>
          <div><label>Height</label><input type="number" value={project.canvas.height} onChange={(e) => setCanvasSettings({ height: Number(e.target.value) })} /></div>
        </div>
        <SelectField label="FPS" value={String(project.canvas.fps)} options={[24, 25, 30, 50, 60].map((f) => ({ value: String(f), label: String(f) }))} onChange={(v) => setCanvasSettings({ fps: Number(v) })} />
        <ColorField label="Background" value={project.canvas.background.value ?? '#000000'} onChange={(v) => setCanvasSettings({ background: { type: 'color', value: v } })} />
      </FieldGroup>
      <FieldGroup title="Export Defaults">
        <SelectField label="Format" value={project.exportSettings.format} options={[{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]} onChange={(v) => setExportSettings({ format: v as any })} />
        <SelectField label="Resolution" value={project.exportSettings.resolutionPreset} options={['480p', '720p', '1080p', '1440p', '2160p'].map((r) => ({ value: r, label: r }))} onChange={(v) => setExportSettings({ resolutionPreset: v as any })} />
      </FieldGroup>
      <div className="inspector-empty" style={{ paddingTop: 0 }}>Select a clip on the timeline to edit its properties.</div>
    </>
  );
}

function TransformFields({ transform, onChange }: { transform: Transform2D; onChange: (t: Transform2D) => void }) {
  return (
    <FieldGroup title="Transform" onReset={() => onChange({ ...DEFAULT_TRANSFORM })}>
      <SliderField label="Position X" value={transform.x} min={-1000} max={1000} onChange={(v) => onChange({ ...transform, x: v })} />
      <SliderField label="Position Y" value={transform.y} min={-1000} max={1000} onChange={(v) => onChange({ ...transform, y: v })} />
      <SliderField label="Scale" value={transform.scale} min={0.05} max={5} step={0.01} onChange={(v) => onChange({ ...transform, scale: v })} />
      <SliderField label="Rotation" value={transform.rotation} min={-180} max={180} onChange={(v) => onChange({ ...transform, rotation: v })} suffix="°" />
      <SliderField label="Opacity" value={transform.opacity} min={0} max={1} step={0.01} onChange={(v) => onChange({ ...transform, opacity: v })} />
      <div style={{ display: 'flex', gap: 8 }}>
        <CheckboxField label="Flip H" checked={transform.flipH} onChange={(v) => onChange({ ...transform, flipH: v })} />
        <CheckboxField label="Flip V" checked={transform.flipV} onChange={(v) => onChange({ ...transform, flipV: v })} />
      </div>
    </FieldGroup>
  );
}

function VisualInspector({ clip, patch }: { clip: VideoClip | ImageClip; patch: (p: Partial<TimelineClip>, k?: string) => void }) {
  const color = clip.color;

  return (
    <>
      <TransformFields transform={clip.transform} onChange={(t) => patch({ transform: t } as any, 'transform')} />

      <FieldGroup title="Crop">
        <SelectField
          label="Preset"
          value={clip.crop.mode}
          options={CROP_PRESETS.map((c) => ({ value: c, label: c }))}
          onChange={(v) => patch({ crop: { ...clip.crop, mode: v as CropMode, x: 0, y: 0, width: 1, height: 1 } } as any)}
        />
      </FieldGroup>

      <FieldGroup title="Color Adjustment" onReset={() => patch({ color: { ...DEFAULT_COLOR } } as any)}>
        <SliderField label="Exposure" value={color.exposure} min={-100} max={100} onChange={(v) => patch({ color: { ...color, exposure: v } } as any, 'color.exposure')} />
        <SliderField label="Brightness" value={color.brightness} min={-100} max={100} onChange={(v) => patch({ color: { ...color, brightness: v } } as any, 'color.brightness')} />
        <SliderField label="Contrast" value={color.contrast} min={-100} max={100} onChange={(v) => patch({ color: { ...color, contrast: v } } as any, 'color.contrast')} />
        <SliderField label="Highlights" value={color.highlights} min={-100} max={100} onChange={(v) => patch({ color: { ...color, highlights: v } } as any, 'color.highlights')} />
        <SliderField label="Shadows" value={color.shadows} min={-100} max={100} onChange={(v) => patch({ color: { ...color, shadows: v } } as any, 'color.shadows')} />
        <SliderField label="Temperature" value={color.temperature} min={-100} max={100} onChange={(v) => patch({ color: { ...color, temperature: v } } as any, 'color.temperature')} />
        <SliderField label="Tint" value={color.tint} min={-100} max={100} onChange={(v) => patch({ color: { ...color, tint: v } } as any, 'color.tint')} />
        <SliderField label="Saturation" value={color.saturation} min={-100} max={100} onChange={(v) => patch({ color: { ...color, saturation: v } } as any, 'color.saturation')} />
        <SliderField label="Vibrance" value={color.vibrance} min={-100} max={100} onChange={(v) => patch({ color: { ...color, vibrance: v } } as any, 'color.vibrance')} />
        <SliderField label="Hue" value={color.hue} min={-180} max={180} onChange={(v) => patch({ color: { ...color, hue: v } } as any, 'color.hue')} suffix="°" />
        <SliderField label="Vignette" value={color.vignette} min={0} max={100} onChange={(v) => patch({ color: { ...color, vignette: v } } as any, 'color.vignette')} />
      </FieldGroup>

      <FieldGroup title="Blend">
        <SelectField label="Mode" value={clip.blendMode} options={BLEND_MODES} onChange={(v) => patch({ blendMode: v as BlendMode } as any)} />
      </FieldGroup>

      <FieldGroup title="Chroma Key">
        <CheckboxField label="Enable green-screen removal" checked={clip.chromaKey.enabled} onChange={(v) => patch({ chromaKey: { ...clip.chromaKey, enabled: v } } as any)} />
        {clip.chromaKey.enabled && (
          <>
            <ColorField label="Key Color" value={clip.chromaKey.color} onChange={(v) => patch({ chromaKey: { ...clip.chromaKey, color: v } } as any)} />
            <SliderField label="Strength" value={clip.chromaKey.strength} min={0} max={100} onChange={(v) => patch({ chromaKey: { ...clip.chromaKey, strength: v } } as any)} />
            <SliderField label="Similarity" value={clip.chromaKey.similarity} min={0} max={100} onChange={(v) => patch({ chromaKey: { ...clip.chromaKey, similarity: v } } as any)} />
            <SliderField label="Edge Feather" value={clip.chromaKey.edgeFeather} min={0} max={50} onChange={(v) => patch({ chromaKey: { ...clip.chromaKey, edgeFeather: v } } as any)} />
            <div className="inspector-empty" style={{ padding: '4px 0', fontSize: 11 }}>
              Key parameters are saved with the clip; live GPU keying renders in Phase 3 (see README) — the canvas 2D pipeline today applies color grading and blend modes but not per-pixel keying yet.
            </div>
          </>
        )}
      </FieldGroup>

      {clip.kind === 'video' && <SpeedInspector clip={clip} patch={patch} />}

      <FieldGroup title="Animation">
        <SelectField
          label="Entrance"
          value={clip.animationIn?.kind ?? 'none'}
          options={['none', 'fade', 'slide', 'zoom', 'pop', 'bounce'].map((v) => ({ value: v, label: v }))}
          onChange={(v) => patch({ animationIn: { kind: v, duration: clip.animationIn?.duration ?? 0.4 } } as any)}
        />
        {clip.animationIn && clip.animationIn.kind !== 'none' && (
          <SliderField label="In Duration" value={clip.animationIn.duration} min={0.1} max={3} step={0.1} onChange={(v) => patch({ animationIn: { ...clip.animationIn!, duration: v } } as any)} suffix="s" />
        )}
        <SelectField
          label="Exit"
          value={clip.animationOut?.kind ?? 'none'}
          options={['none', 'fade', 'slide', 'zoom'].map((v) => ({ value: v, label: v }))}
          onChange={(v) => patch({ animationOut: { kind: v, duration: clip.animationOut?.duration ?? 0.4 } } as any)}
        />
        {clip.animationOut && clip.animationOut.kind !== 'none' && (
          <SliderField label="Out Duration" value={clip.animationOut.duration} min={0.1} max={3} step={0.1} onChange={(v) => patch({ animationOut: { ...clip.animationOut!, duration: v } } as any)} suffix="s" />
        )}
      </FieldGroup>
    </>
  );
}

function SpeedInspector({ clip, patch }: { clip: VideoClip; patch: (p: Partial<TimelineClip>, k?: string) => void }) {
  const speed = clip.speed;
  return (
    <FieldGroup title="Speed">
      <div className="field-row">
        <label>Presets</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {SPEED_PRESETS.map((p) => (
            <button key={p} className={`btn ${speed.rate === p ? 'active' : ''}`} style={{ padding: '3px 7px', fontSize: 11 }} onClick={() => patch({ speed: { ...speed, rate: p } } as any)}>
              {p}x
            </button>
          ))}
        </div>
      </div>
      <SliderField label="Rate" value={speed.rate} min={0.1} max={20} step={0.1} onChange={(v) => patch({ speed: { ...speed, rate: v } } as any, 'speed.rate')} suffix="x" />
      <SelectField label="Curve" value={speed.curve} options={SPEED_CURVES.map((c) => ({ value: c, label: c }))} onChange={(v) => patch({ speed: { ...speed, curve: v as SpeedCurvePreset } } as any)} />
      <CheckboxField label="Reverse" checked={speed.reversed} onChange={(v) => patch({ speed: { ...speed, reversed: v } } as any)} />
      <CheckboxField label="Preserve Pitch" checked={speed.preserveTune} onChange={(v) => patch({ speed: { ...speed, preserveTune: v } } as any)} />
    </FieldGroup>
  );
}

function AudioInspector({ clip, patch }: { clip: AudioClip; patch: (p: Partial<TimelineClip>, k?: string) => void }) {
  return (
    <>
      <FieldGroup title="Volume">
        <SliderField label="Volume" value={clip.volume} min={0} max={2} step={0.01} onChange={(v) => patch({ volume: v } as any, 'volume')} />
        <CheckboxField label="Mute" checked={clip.muted} onChange={(v) => patch({ muted: v } as any)} />
        <SliderField label="Pan" value={clip.pan} min={-1} max={1} step={0.01} onChange={(v) => patch({ pan: v } as any, 'pan')} />
      </FieldGroup>
      <FieldGroup title="Fade">
        <SliderField label="Fade In" value={clip.fadeIn} min={0} max={Math.min(5, clip.duration / 2)} step={0.05} onChange={(v) => patch({ fadeIn: v } as any, 'fadeIn')} suffix="s" />
        <SliderField label="Fade Out" value={clip.fadeOut} min={0} max={Math.min(5, clip.duration / 2)} step={0.05} onChange={(v) => patch({ fadeOut: v } as any, 'fadeOut')} suffix="s" />
      </FieldGroup>
      <FieldGroup title="Speed">
        <SliderField label="Rate" value={clip.speed.rate} min={0.25} max={4} step={0.05} onChange={(v) => patch({ speed: { ...clip.speed, rate: v } } as any, 'speed.rate')} suffix="x" />
        <CheckboxField label="Preserve Pitch" checked={clip.speed.preserveTune} onChange={(v) => patch({ speed: { ...clip.speed, preserveTune: v } } as any)} />
      </FieldGroup>
      <FieldGroup title="Equalizer">
        <SliderField label="Bass" value={clip.eq.bass} min={-24} max={24} onChange={(v) => patch({ eq: { ...clip.eq, bass: v } } as any, 'eq.bass')} suffix="dB" />
        <SliderField label="Mid" value={clip.eq.mid} min={-24} max={24} onChange={(v) => patch({ eq: { ...clip.eq, mid: v } } as any, 'eq.mid')} suffix="dB" />
        <SliderField label="Treble" value={clip.eq.treble} min={-24} max={24} onChange={(v) => patch({ eq: { ...clip.eq, treble: v } } as any, 'eq.treble')} suffix="dB" />
        <div className="inspector-empty" style={{ padding: '4px 0', fontSize: 11 }}>EQ values are saved with the clip; audible filtering via the Web Audio graph lands in Phase 2.</div>
      </FieldGroup>
    </>
  );
}

function TextInspector({ clip, patch }: { clip: TextClip; patch: (p: Partial<TimelineClip>, k?: string) => void }) {
  const style = clip.style;
  const setStyle = (s: Partial<typeof style>) => patch({ style: { ...style, ...s } } as any);

  return (
    <>
      <FieldGroup title="Text">
        <textarea value={clip.text} onChange={(e) => patch({ text: e.target.value, name: e.target.value.slice(0, 24) } as any)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
      </FieldGroup>
      <FieldGroup title="Style">
        <div className="field-row">
          <label>Font</label>
          <select value={style.fontFamily} onChange={(e) => setStyle({ fontFamily: e.target.value })} style={{ flex: 1 }}>
            {['Inter', 'Georgia', 'Arial', 'Courier New', 'Impact', 'Comic Sans MS'].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <SliderField label="Size" value={style.fontSize} min={8} max={200} onChange={(v) => setStyle({ fontSize: v })} />
        <SliderField label="Weight" value={style.fontWeight} min={100} max={900} step={100} onChange={(v) => setStyle({ fontWeight: v })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <CheckboxField label="Italic" checked={style.italic} onChange={(v) => setStyle({ italic: v })} />
          <CheckboxField label="Underline" checked={style.underline} onChange={(v) => setStyle({ underline: v })} />
        </div>
        <SelectField label="Align" value={style.align} options={['left', 'center', 'right', 'justify'].map((v) => ({ value: v, label: v }))} onChange={(v) => setStyle({ align: v as any })} />
        <SliderField label="Letter Sp." value={style.letterSpacing} min={-10} max={40} onChange={(v) => setStyle({ letterSpacing: v })} />
        <SliderField label="Line Height" value={style.lineHeight} min={0.8} max={2.5} step={0.05} onChange={(v) => setStyle({ lineHeight: v })} />
        <ColorField label="Color" value={style.color} onChange={(v) => setStyle({ color: v })} />
        <SliderField label="Opacity" value={style.opacity} min={0} max={1} step={0.01} onChange={(v) => setStyle({ opacity: v })} />
      </FieldGroup>
      <FieldGroup title="Stroke">
        <ColorField label="Color" value={style.stroke?.color ?? '#000000'} onChange={(v) => setStyle({ stroke: { color: v, width: style.stroke?.width ?? 2 } })} />
        <SliderField label="Width" value={style.stroke?.width ?? 0} min={0} max={20} onChange={(v) => setStyle({ stroke: { color: style.stroke?.color ?? '#000000', width: v } })} />
      </FieldGroup>
      <FieldGroup title="Shadow">
        <ColorField label="Color" value={style.shadow?.color ?? '#000000'} onChange={(v) => setStyle({ shadow: { color: v, opacity: style.shadow?.opacity ?? 0.6, blur: style.shadow?.blur ?? 4, distance: style.shadow?.distance ?? 2, angle: style.shadow?.angle ?? 90 } })} />
        <SliderField label="Blur" value={style.shadow?.blur ?? 0} min={0} max={40} onChange={(v) => setStyle({ shadow: { ...(style.shadow ?? { color: '#000', opacity: 0.6, distance: 2, angle: 90 }), blur: v } })} />
        <SliderField label="Distance" value={style.shadow?.distance ?? 0} min={0} max={40} onChange={(v) => setStyle({ shadow: { ...(style.shadow ?? { color: '#000', opacity: 0.6, blur: 4, angle: 90 }), distance: v } })} />
      </FieldGroup>
      <FieldGroup title="Animation">
        <SelectField label="Entrance" value={clip.animation.entrance} options={['none', 'fade', 'slide', 'pop', 'zoom', 'typewriter', 'bounce'].map((v) => ({ value: v, label: v }))} onChange={(v) => patch({ animation: { ...clip.animation, entrance: v as any } } as any)} />
        <SliderField label="In Duration" value={clip.animation.entranceDuration} min={0.1} max={3} step={0.1} onChange={(v) => patch({ animation: { ...clip.animation, entranceDuration: v } } as any)} suffix="s" />
        <SelectField label="Exit" value={clip.animation.exit} options={['none', 'fade', 'slide', 'zoom'].map((v) => ({ value: v, label: v }))} onChange={(v) => patch({ animation: { ...clip.animation, exit: v as any } } as any)} />
      </FieldGroup>
      <TransformFields transform={clip.transform} onChange={(t) => patch({ transform: t } as any, 'transform')} />
    </>
  );
}
