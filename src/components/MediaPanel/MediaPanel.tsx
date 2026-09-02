import { useMemo, useRef, useState } from 'react';
import {
  Film, Music2, Type, Sticker, Sparkles, Shuffle, Captions, SlidersHorizontal,
  LayoutTemplate, Wand2, Bot, Search, FolderPlus, Upload,
} from 'lucide-react';
import { useUIStore, LeftTab } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { importFiles } from '@/engine/mediaImport';
import { persistMediaBlobs } from '@/engine/projectFile';
import { MediaAsset } from '@/types/models';
import { findTargetTrack, trackEndTime, buildClipFromAsset, buildTextClip } from '@/utils/timelineOps';

const TABS: { id: LeftTab; label: string; icon: any }[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Sticker },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'transitions', label: 'Transitions', icon: Shuffle },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'filters', label: 'Filters', icon: SlidersHorizontal },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'adjustment', label: 'Adjustment', icon: Wand2 },
  { id: 'ai', label: 'AI Tools', icon: Bot },
];

function fmtDuration(s?: number) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPanel() {
  const leftTab = useUIStore((s) => s.leftTab);
  const setLeftTab = useUIStore((s) => s.setLeftTab);

  return (
    <div className="panel media-panel">
      <div className="left-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={leftTab === t.id ? 'active' : ''} onClick={() => setLeftTab(t.id)} title={t.label}>
            <t.icon size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t.label}
          </button>
        ))}
      </div>
      {leftTab === 'media' && <MediaLibrary filter={null} />}
      {leftTab === 'audio' && <MediaLibrary filter="audio" />}
      {leftTab === 'stickers' && <MediaLibrary filter="image" stickerMode />}
      {leftTab === 'text' && <TextTab />}
      {leftTab === 'effects' && <RoadmapTab title="Effects" phase={2} items={['Blur', 'Glow', 'Glitch', 'Chromatic Aberration', 'VHS', 'Camera Shake', 'Light Leak']} />}
      {leftTab === 'transitions' && <RoadmapTab title="Transitions" phase={2} items={['Cross Dissolve', 'Slide', 'Push', 'Zoom', 'Whip Pan', 'Film Burn']} />}
      {leftTab === 'captions' && <RoadmapTab title="Auto Captions" phase={4} items={['Speech-to-text transcription', 'Word-level timing', 'Karaoke highlight style', 'SRT/VTT import & export']} note="Requires a speech-to-text provider — see AI Tools." />}
      {leftTab === 'filters' && <RoadmapTab title="Filters" phase={2} items={['Cinematic', 'Vintage / Film', 'Y2K Digicam', 'Black & White', 'Warm / Cool']} />}
      {leftTab === 'templates' && <RoadmapTab title="Templates" phase={3} items={['Social intro templates', 'Caption style presets', 'Transition packs']} />}
      {leftTab === 'adjustment' && <AdjustmentHint />}
      {leftTab === 'ai' && <RoadmapTab title="AI Tools" phase={4} items={['Auto captions', 'Background removal', 'Auto reframe', 'Scene detection', 'Silence removal', 'Text-to-speech']} note="These need an external model/API. The provider interface is in place in the architecture — plug in a key in Settings once available." />}
    </div>
  );
}

function AdjustmentHint() {
  return (
    <div className="media-empty" style={{ padding: 24 }}>
      Select a clip on the timeline, then use the <strong>Adjustment</strong> tab in the Inspector (right panel) for color grading.
    </div>
  );
}

function RoadmapTab({ title, phase, items, note }: { title: string; phase: number; items: string[]; note?: string }) {
  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-mid)', marginBottom: 10 }}>
        <strong style={{ color: 'var(--text-hi)' }}>{title}</strong> — planned for Phase {phase}, not yet implemented in this build.
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-low)', fontSize: 12, lineHeight: 1.8 }}>
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
      {note && <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-low)' }}>{note}</div>}
    </div>
  );
}

function TextTab() {
  const project = useProjectStore((s) => s.project);
  const addClip = useProjectStore((s) => s.addClip);
  const playheadTime = useUIStore((s) => s.playheadTime);

  const presets: { id: 'heading' | 'subtitle' | 'body' | 'caption'; label: string; sample: string; size: number }[] = [
    { id: 'heading', label: 'Heading', sample: 'Heading', size: 28 },
    { id: 'subtitle', label: 'Subtitle', sample: 'Subtitle text', size: 18 },
    { id: 'body', label: 'Body Text', sample: 'Body text', size: 14 },
    { id: 'caption', label: 'Caption', sample: 'Caption', size: 12 },
  ];

  const add = (id: typeof presets[number]['id']) => {
    const track = project.tracks.filter((t) => t.type === 'text' && !t.locked).sort((a, b) => a.index - b.index)[0];
    if (!track) { alert('No text track available. Add a text track first.'); return; }
    const clip = buildTextClip(track, playheadTime, id);
    addClip(clip);
  };

  return (
    <div style={{ padding: 12, overflowY: 'auto' }}>
      <div className="field-group__title">Add text at playhead</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {presets.map((p) => (
          <button key={p.id} className="btn" style={{ justifyContent: 'flex-start', fontWeight: p.id === 'heading' ? 700 : 400, fontSize: p.size }} onClick={() => add(p.id)}>
            {p.sample}
          </button>
        ))}
      </div>
    </div>
  );
}

function MediaLibrary({ filter, stickerMode }: { filter: MediaAsset['type'] | null; stickerMode?: boolean }) {
  const project = useProjectStore((s) => s.project);
  const addMediaAssets = useProjectStore((s) => s.addMediaAssets);
  const addClip = useProjectStore((s) => s.addClip);
  const selectedMediaId = useUIStore((s) => s.selectedMediaId);
  const setSelectedMediaId = useUIStore((s) => s.setSelectedMediaId);
  const playheadTime = useUIStore((s) => s.playheadTime);

  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const assets = useMemo(() => {
    let list = project.mediaAssets;
    if (filter) list = list.filter((a) => a.type === filter);
    if (query.trim()) list = list.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [project.mediaAssets, filter, query]);

  const doImport = async (files: FileList | File[]) => {
    setImporting(true);
    try {
      const imported = await importFiles(files);
      if (imported.length === 0) {
        alert('No supported files found. Supported: video, image, GIF, audio, subtitle files.');
        return;
      }
      addMediaAssets(imported);
      persistMediaBlobs(imported).catch(() => {});
    } finally {
      setImporting(false);
    }
  };

  const addToTimeline = (asset: MediaAsset) => {
    const track = findTargetTrack(project, asset.type);
    if (!track) { alert(`No suitable track for ${asset.type}. Add a track first.`); return; }
    const start = Math.max(playheadTime, 0);
    const clip = buildClipFromAsset(asset, track, start);
    if (clip) addClip(clip);
  };

  return (
    <>
      <div className="panel-toolbar">
        <Search size={14} color="var(--text-low)" />
        <input type="text" placeholder="Search media…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn icon" title="Import files" onClick={() => inputRef.current?.click()}><Upload size={14} /></button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="video/*,image/*,audio/*,.srt,.vtt,.gif"
          onChange={(e) => e.target.files && doImport(e.target.files)}
        />
      </div>
      <div
        className={`media-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) doImport(e.dataTransfer.files);
        }}
      >
        {assets.length === 0 ? (
          <div className="media-empty">
            <FolderPlus size={22} style={{ marginBottom: 8, opacity: 0.5 }} /><br />
            {importing ? 'Importing…' : `Drag & drop ${stickerMode ? 'sticker images' : 'files'} here, or click Import.`}
          </div>
        ) : (
          <div className="media-grid">
            {assets.map((a) => (
              <MediaCard
                key={a.id}
                asset={a}
                selected={selectedMediaId === a.id}
                onClick={() => setSelectedMediaId(a.id)}
                onDoubleClick={() => addToTimeline(a)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MediaCard({ asset, selected, onClick, onDoubleClick }: { asset: MediaAsset; selected: boolean; onClick: () => void; onDoubleClick: () => void }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-nle-media-id', asset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <div
      className={`media-card ${selected ? 'selected' : ''}`}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title="Double-click to add to timeline, or drag onto a track"
    >
      <div className="media-card__thumb">
        {asset.thumbnailUrl ? <img src={asset.thumbnailUrl} alt="" /> : <Film size={20} color="var(--text-low)" />}
        {asset.metadata.duration ? <span className="media-card__duration">{fmtDuration(asset.metadata.duration)}</span> : null}
      </div>
      <div className="media-card__body">
        <div className="media-card__name">{asset.name}</div>
        <div className="media-card__meta">
          {asset.metadata.width ? `${asset.metadata.width}×${asset.metadata.height} · ` : ''}
          {fmtSize(asset.metadata.fileSize)}
        </div>
      </div>
    </div>
  );
}
