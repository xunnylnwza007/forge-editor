import { useMemo, useRef, useState } from 'react';
import {
  Scissors, Trash2, Copy, ClipboardPaste, CopyPlus, ZoomIn, ZoomOut, Magnet, Plus,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { Ruler } from '@/components/Timeline/Ruler';
import { TrackHeader } from '@/components/Timeline/TrackHeader';
import { ClipView } from '@/components/Timeline/ClipView';
import { ContextMenu, MenuItem } from '@/components/Timeline/ContextMenu';
import { AudioClip, Track, TrackType, VideoClip, cryptoId } from '@/types/models';
import { projectDuration } from '@/hooks/usePlaybackEngine';

const TRACK_TYPE_LABEL: Record<TrackType, string> = {
  video: 'Video', overlayVideo: 'Overlay', image: 'Image', text: 'Text', subtitle: 'Subtitle',
  sticker: 'Sticker', effect: 'Effect', audio: 'Audio', music: 'Music', voiceover: 'Voice-over',
};

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeClips = useProjectStore((s) => s.removeClips);
  const splitClipAt = useProjectStore((s) => s.splitClipAt);
  const duplicateClips = useProjectStore((s) => s.duplicateClips);
  const addClip = useProjectStore((s) => s.addClip);

  const pixelsPerSecond = useUIStore((s) => s.pixelsPerSecond);
  const setPixelsPerSecond = useUIStore((s) => s.setPixelsPerSecond);
  const snappingEnabled = useUIStore((s) => s.snappingEnabled);
  const toggleSnapping = useUIStore((s) => s.toggleSnapping);
  const playheadTime = useUIStore((s) => s.playheadTime);
  const setPlayheadTime = useUIStore((s) => s.setPlayheadTime);
  const selectedClipIds = useUIStore((s) => s.selectedClipIds);
  const setSelectedClipIds = useUIStore((s) => s.setSelectedClipIds);
  const clipboard = useUIStore((s) => s.clipboard);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId?: string } | null>(null);
  const [addTrackMenu, setAddTrackMenu] = useState<{ x: number; y: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const tracksAreaRef = useRef<HTMLDivElement>(null);

  const duration = projectDuration(project.clips);
  const contentWidth = Math.max(1200, (duration + 30) * pixelsPerSecond);
  const sortedTracks = useMemo(() => [...project.tracks].sort((a, b) => b.index - a.index), [project.tracks]);

  const doSplit = () => {
    selectedClipIds.forEach((id) => splitClipAt(id, playheadTime));
  };
  const doDelete = () => removeClips(selectedClipIds);
  const doDuplicate = () => duplicateClips(selectedClipIds);
  const doCopy = () => useUIStore.setState({ clipboard: selectedClipIds });
  const doPaste = () => {
    if (clipboard.length === 0) return;
    duplicateClips(clipboard);
  };
  const doDetachAudio = (clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId) as VideoClip | undefined;
    if (!clip || clip.kind !== 'video') return;
    const audioTrack = project.tracks.filter((t) => t.type === 'audio' && !t.locked).sort((a, b) => a.index - b.index)[0];
    if (!audioTrack) { alert('No audio track available.'); return; }
    const audioClip: AudioClip = {
      id: cryptoId(), kind: 'audio', trackId: audioTrack.id, start: clip.start, duration: clip.duration,
      sourceIn: clip.sourceIn, sourceOut: clip.sourceOut, name: `${clip.name} (audio)`,
      mediaId: clip.mediaId, volume: clip.volume, muted: false, pan: 0, fadeIn: 0, fadeOut: 0,
      speed: { ...clip.speed }, eq: { bass: 0, mid: 0, treble: 0 },
    };
    addClip(audioClip);
  };
  const doReverse = (clipId: string) => {
    const clip = project.clips.find((c) => c.id === clipId);
    if (!clip || !('speed' in clip)) return;
    useProjectStore.getState().updateClip(clipId, { speed: { ...clip.speed, reversed: !clip.speed.reversed } } as any);
  };

  const handleAddTrack = (type: TrackType) => {
    const track: Track = {
      id: cryptoId(), type, name: `${TRACK_TYPE_LABEL[type]} ${project.tracks.filter((t) => t.type === type).length + 1}`,
      index: Math.max(-1, ...project.tracks.map((t) => t.index)) + 1,
      hidden: false, muted: false, solo: false, locked: false, height: type === 'audio' || type === 'music' || type === 'voiceover' ? 56 : type === 'text' || type === 'subtitle' ? 40 : 72,
    };
    addTrack(track);
    setAddTrackMenu(null);
  };

  const startMarquee = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-clip')) return;
    const rect = tracksAreaRef.current!.getBoundingClientRect();
    const x0 = e.clientX - rect.left + tracksAreaRef.current!.scrollLeft;
    const y0 = e.clientY - rect.top;
    setMarquee({ x0, y0, x1: x0, y1: y0 });
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) setSelectedClipIds([]);

    const onMove = (ev: PointerEvent) => {
      const x1 = ev.clientX - rect.left + tracksAreaRef.current!.scrollLeft;
      const y1 = ev.clientY - rect.top;
      setMarquee((m) => (m ? { ...m, x1, y1 } : null));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const x1 = ev.clientX - rect.left + tracksAreaRef.current!.scrollLeft;
      const y1 = ev.clientY - rect.top;
      const left = Math.min(x0, x1);
      const right = Math.max(x0, x1);
      const top = Math.min(y0, y1);
      const bottom = Math.max(y0, y1);

      // Determine which tracks fall in [top, bottom] by accumulated height (ruler is 24px)
      let cursorY = 24;
      const hitTrackIds = new Set<string>();
      for (const t of sortedTracks) {
        const trackTop = cursorY;
        const trackBottom = cursorY + t.height;
        if (trackBottom >= top && trackTop <= bottom) hitTrackIds.add(t.id);
        cursorY = trackBottom;
      }
      const hitClipIds = project.clips
        .filter((c) => hitTrackIds.has(c.trackId))
        .filter((c) => {
          const clipLeft = c.start * pixelsPerSecond;
          const clipRight = clipLeft + c.duration * pixelsPerSecond;
          return clipRight >= left && clipLeft <= right;
        })
        .map((c) => c.id);

      if (hitClipIds.length > 0) {
        setSelectedClipIds(Array.from(new Set([...(ev.shiftKey ? selectedClipIds : []), ...hitClipIds])));
      }
      setMarquee(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clipContextItems: MenuItem[] = contextMenu?.clipId
    ? [
        { label: 'Split at Playhead', onClick: doSplit, shortcut: '⌘K' },
        { label: 'Duplicate', onClick: doDuplicate, shortcut: '⌘D' },
        { label: 'Copy', onClick: doCopy, shortcut: '⌘C' },
        { label: 'Paste', onClick: doPaste, shortcut: '⌘V', disabled: clipboard.length === 0 },
        { divider: true, label: '' },
        { label: 'Reverse', onClick: () => doReverse(contextMenu.clipId!) },
        { label: 'Detach Audio', onClick: () => doDetachAudio(contextMenu.clipId!) },
        { divider: true, label: '' },
        { label: 'Delete', onClick: doDelete, shortcut: 'Del' },
        { label: 'Ripple Delete', onClick: doDelete },
      ]
    : [];

  return (
    <div className="panel timeline-panel">
      <div className="timeline-toolbar">
        <button className="btn icon" title="Split (Ctrl+K)" onClick={doSplit} disabled={selectedClipIds.length === 0}><Scissors size={14} /></button>
        <button className="btn icon" title="Duplicate (Ctrl+D)" onClick={doDuplicate} disabled={selectedClipIds.length === 0}><CopyPlus size={14} /></button>
        <button className="btn icon" title="Copy" onClick={doCopy} disabled={selectedClipIds.length === 0}><Copy size={14} /></button>
        <button className="btn icon" title="Paste" onClick={doPaste} disabled={clipboard.length === 0}><ClipboardPaste size={14} /></button>
        <button className="btn icon" title="Delete" onClick={doDelete} disabled={selectedClipIds.length === 0}><Trash2 size={14} /></button>
        <div className="topbar__divider" />
        <button className={`btn icon ${snappingEnabled ? 'active' : ''}`} title="Toggle Snapping" onClick={toggleSnapping}><Magnet size={14} /></button>
        <div style={{ position: 'relative' }}>
          <button className="btn" onClick={(e) => setAddTrackMenu({ x: e.clientX, y: e.clientY })}><Plus size={14} /> Track</button>
        </div>
        <div className="timeline-toolbar__spacer" />
        <div className="timeline-toolbar__zoom">
          <button className="btn icon" onClick={() => setPixelsPerSecond((v) => v / 1.4)}><ZoomOut size={14} /></button>
          <input type="range" min={4} max={2000} value={pixelsPerSecond} onChange={(e) => setPixelsPerSecond(Number(e.target.value))} style={{ width: 100 }} />
          <button className="btn icon" onClick={() => setPixelsPerSecond((v) => v * 1.4)}><ZoomIn size={14} /></button>
        </div>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-body">
          <div className="track-headers">
            <div style={{ height: 24, borderBottom: '1px solid var(--border)' }} />
            {sortedTracks.map((t) => <TrackHeader key={t.id} track={t} />)}
          </div>
          <div
            className="tracks-area"
            ref={tracksAreaRef}
            onPointerDown={startMarquee}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
          >
            <Ruler pixelsPerSecond={pixelsPerSecond} duration={duration} fps={project.canvas.fps} onSeek={setPlayheadTime} markers={project.markers} width={contentWidth} />
            {sortedTracks.map((t) => (
              <div key={t.id} className={`track-lane ${t.locked ? 'locked' : ''}`} data-track-id={t.id} style={{ ['--track-h' as any]: `${t.height}px`, width: contentWidth }}>
                {project.clips.filter((c) => c.trackId === t.id).map((c) => (
                  <div
                    key={c.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selectedClipIds.includes(c.id)) setSelectedClipIds([c.id]);
                      setContextMenu({ x: e.clientX, y: e.clientY, clipId: c.id });
                    }}
                  >
                    <ClipView clip={c} track={t} pixelsPerSecond={pixelsPerSecond} allClips={project.clips} allTracks={project.tracks} />
                  </div>
                ))}
              </div>
            ))}
            <div className="playhead" style={{ left: playheadTime * pixelsPerSecond, height: sortedTracks.reduce((s, t) => s + t.height, 24) }}>
              <div className="playhead__flag" />
            </div>
            {marquee && (
              <div
                className="selection-box"
                style={{
                  left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.clipId ? clipContextItems : [{ label: 'Add Track…', onClick: () => setAddTrackMenu({ x: contextMenu.x, y: contextMenu.y }) }]} onClose={() => setContextMenu(null)} />}
      {addTrackMenu && (
        <ContextMenu
          x={addTrackMenu.x}
          y={addTrackMenu.y}
          items={(Object.keys(TRACK_TYPE_LABEL) as TrackType[]).map((type) => ({ label: TRACK_TYPE_LABEL[type], onClick: () => handleAddTrack(type) }))}
          onClose={() => setAddTrackMenu(null)}
        />
      )}
    </div>
  );
}
