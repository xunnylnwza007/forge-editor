import { create } from 'zustand';
import {
  Project, TimelineClip, Track, MediaAsset, Marker, TransitionInstance,
  createEmptyProject, cryptoId, CanvasSettings, ExportSettings, ClipKind,
} from '@/types/models';
import { history, Command } from '@/engine/history';

interface ProjectStore {
  project: Project;
  dirty: boolean;

  // Non-history-tracked (bulk load/replace)
  loadProject: (p: Project) => void;
  newProject: (name?: string) => void;
  markSaved: () => void;

  // Media
  addMediaAssets: (assets: MediaAsset[]) => void;
  removeMediaAsset: (id: string) => void;

  // Tracks
  addTrack: (track: Track) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  reorderTracks: (orderedIds: string[]) => void;

  // Clips
  addClip: (clip: TimelineClip, coalesceKey?: string) => void;
  updateClip: (id: string, patch: Partial<TimelineClip>, coalesceKey?: string) => void;
  updateClips: (patches: { id: string; patch: Partial<TimelineClip> }[], coalesceKey?: string) => void;
  removeClips: (ids: string[]) => void;
  splitClipAt: (id: string, time: number) => void;
  duplicateClips: (ids: string[]) => void;

  // Transitions
  addTransition: (t: TransitionInstance) => void;
  removeTransition: (id: string) => void;

  // Markers
  addMarker: (m: Marker) => void;
  removeMarker: (id: string) => void;

  // Settings
  setCanvasSettings: (patch: Partial<CanvasSettings>) => void;
  setExportSettings: (patch: Partial<ExportSettings>) => void;
  renameProject: (name: string) => void;
}

function touch(p: Project): Project {
  return { ...p, updatedAt: Date.now() };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: createEmptyProject(),
  dirty: false,

  loadProject: (p) => set({ project: p, dirty: false }),
  newProject: (name) => {
    history.clear();
    set({ project: createEmptyProject(name), dirty: false });
  },
  markSaved: () => set({ dirty: false }),

  addMediaAssets: (assets) => {
    set((s) => ({
      project: touch({ ...s.project, mediaAssets: [...s.project.mediaAssets, ...assets] }),
      dirty: true,
    }));
  },

  removeMediaAsset: (id) => {
    set((s) => ({
      project: touch({
        ...s.project,
        mediaAssets: s.project.mediaAssets.filter((m) => m.id !== id),
      }),
      dirty: true,
    }));
  },

  addTrack: (track) => {
    const cmd: Command = {
      label: 'Add Track',
      do: () => set((s) => ({ project: touch({ ...s.project, tracks: [...s.project.tracks, track] }), dirty: true })),
      undo: () => set((s) => ({ project: touch({ ...s.project, tracks: s.project.tracks.filter((t) => t.id !== track.id) }), dirty: true })),
    };
    history.execute(cmd);
  },

  updateTrack: (id, patch) => {
    const before = get().project.tracks.find((t) => t.id === id);
    if (!before) return;
    const cmd: Command = {
      label: 'Update Track',
      coalesceKey: `track:${id}:${Object.keys(patch).join(',')}`,
      do: () => set((s) => ({
        project: touch({ ...s.project, tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
        dirty: true,
      })),
      undo: () => set((s) => ({
        project: touch({ ...s.project, tracks: s.project.tracks.map((t) => (t.id === id ? before : t)) }),
        dirty: true,
      })),
    };
    history.execute(cmd);
  },

  removeTrack: (id) => {
    const p = get().project;
    const track = p.tracks.find((t) => t.id === id);
    const clipsOnTrack = p.clips.filter((c) => c.trackId === id);
    if (!track) return;
    const cmd: Command = {
      label: 'Delete Track',
      do: () => set((s) => ({
        project: touch({
          ...s.project,
          tracks: s.project.tracks.filter((t) => t.id !== id),
          clips: s.project.clips.filter((c) => c.trackId !== id),
        }),
        dirty: true,
      })),
      undo: () => set((s) => ({
        project: touch({ ...s.project, tracks: [...s.project.tracks, track], clips: [...s.project.clips, ...clipsOnTrack] }),
        dirty: true,
      })),
    };
    history.execute(cmd);
  },

  reorderTracks: (orderedIds) => {
    const before = get().project.tracks;
    const cmd: Command = {
      label: 'Reorder Tracks',
      do: () => set((s) => ({
        project: touch({
          ...s.project,
          tracks: orderedIds.map((id, i) => {
            const t = s.project.tracks.find((tr) => tr.id === id)!;
            return { ...t, index: i };
          }),
        }),
        dirty: true,
      })),
      undo: () => set((s) => ({ project: touch({ ...s.project, tracks: before }), dirty: true })),
    };
    history.execute(cmd);
  },

  addClip: (clip, coalesceKey) => {
    const cmd: Command = {
      label: 'Add Clip',
      coalesceKey,
      do: () => set((s) => ({ project: touch({ ...s.project, clips: [...s.project.clips, clip] }), dirty: true })),
      undo: () => set((s) => ({ project: touch({ ...s.project, clips: s.project.clips.filter((c) => c.id !== clip.id) }), dirty: true })),
    };
    history.execute(cmd);
  },

  updateClip: (id, patch, coalesceKey) => {
    const before = get().project.clips.find((c) => c.id === id);
    if (!before) return;
    const cmd: Command = {
      label: 'Edit Clip',
      coalesceKey: coalesceKey ?? `clip:${id}:${Object.keys(patch).join(',')}`,
      do: () => set((s) => ({
        project: touch({ ...s.project, clips: s.project.clips.map((c) => (c.id === id ? ({ ...c, ...patch } as TimelineClip) : c)) }),
        dirty: true,
      })),
      undo: () => set((s) => ({
        project: touch({ ...s.project, clips: s.project.clips.map((c) => (c.id === id ? before : c)) }),
        dirty: true,
      })),
    };
    history.execute(cmd);
  },

  updateClips: (patches, coalesceKey) => {
    const p = get().project;
    const beforeMap = new Map(patches.map(({ id }) => [id, p.clips.find((c) => c.id === id)]));
    const cmd: Command = {
      label: 'Edit Clips',
      coalesceKey,
      do: () => set((s) => {
        const patchMap = new Map(patches.map((x) => [x.id, x.patch]));
        return {
          project: touch({
            ...s.project,
            clips: s.project.clips.map((c) => (patchMap.has(c.id) ? ({ ...c, ...patchMap.get(c.id) } as TimelineClip) : c)),
          }),
          dirty: true,
        };
      }),
      undo: () => set((s) => ({
        project: touch({
          ...s.project,
          clips: s.project.clips.map((c) => (beforeMap.has(c.id) ? (beforeMap.get(c.id) as TimelineClip) : c)),
        }),
        dirty: true,
      })),
    };
    history.execute(cmd);
  },

  removeClips: (ids) => {
    const idSet = new Set(ids);
    const removed = get().project.clips.filter((c) => idSet.has(c.id));
    if (removed.length === 0) return;
    const cmd: Command = {
      label: removed.length > 1 ? 'Delete Clips' : 'Delete Clip',
      do: () => set((s) => ({ project: touch({ ...s.project, clips: s.project.clips.filter((c) => !idSet.has(c.id)) }), dirty: true })),
      undo: () => set((s) => ({ project: touch({ ...s.project, clips: [...s.project.clips, ...removed] }), dirty: true })),
    };
    history.execute(cmd);
  },

  splitClipAt: (id, time) => {
    const clip = get().project.clips.find((c) => c.id === id);
    if (!clip) return;
    const localTime = time - clip.start;
    if (localTime <= 0.01 || localTime >= clip.duration - 0.01) return;

    const speed = 'speed' in clip ? clip.speed.rate : 1;
    const rightSourceIn = clip.sourceIn + localTime * speed;

    const left: TimelineClip = { ...clip, id: clip.id, duration: localTime };
    const right: TimelineClip = {
      ...clip,
      id: cryptoId(),
      start: clip.start + localTime,
      duration: clip.duration - localTime,
      sourceIn: rightSourceIn,
    };

    const cmd: Command = {
      label: 'Split Clip',
      do: () => set((s) => ({
        project: touch({ ...s.project, clips: s.project.clips.map((c) => (c.id === id ? left : c)).concat(right) }),
        dirty: true,
      })),
      undo: () => set((s) => ({
        project: touch({ ...s.project, clips: s.project.clips.filter((c) => c.id !== right.id).map((c) => (c.id === id ? clip : c)) }),
        dirty: true,
      })),
    };
    history.execute(cmd);
  },

  duplicateClips: (ids) => {
    const idSet = new Set(ids);
    const originals = get().project.clips.filter((c) => idSet.has(c.id));
    if (originals.length === 0) return;
    const copies = originals.map((c) => ({ ...c, id: cryptoId(), start: c.start + c.duration }));
    const cmd: Command = {
      label: 'Duplicate Clips',
      do: () => set((s) => ({ project: touch({ ...s.project, clips: [...s.project.clips, ...copies] }), dirty: true })),
      undo: () => {
        const copyIds = new Set(copies.map((c) => c.id));
        set((s) => ({ project: touch({ ...s.project, clips: s.project.clips.filter((c) => !copyIds.has(c.id)) }), dirty: true }));
      },
    };
    history.execute(cmd);
  },

  addTransition: (t) => {
    const cmd: Command = {
      label: 'Add Transition',
      do: () => set((s) => ({ project: touch({ ...s.project, transitions: [...s.project.transitions, t] }), dirty: true })),
      undo: () => set((s) => ({ project: touch({ ...s.project, transitions: s.project.transitions.filter((x) => x.id !== t.id) }), dirty: true })),
    };
    history.execute(cmd);
  },

  removeTransition: (id) => {
    const t = get().project.transitions.find((x) => x.id === id);
    if (!t) return;
    const cmd: Command = {
      label: 'Remove Transition',
      do: () => set((s) => ({ project: touch({ ...s.project, transitions: s.project.transitions.filter((x) => x.id !== id) }), dirty: true })),
      undo: () => set((s) => ({ project: touch({ ...s.project, transitions: [...s.project.transitions, t] }), dirty: true })),
    };
    history.execute(cmd);
  },

  addMarker: (m) => {
    set((s) => ({ project: touch({ ...s.project, markers: [...s.project.markers, m] }), dirty: true }));
  },
  removeMarker: (id) => {
    set((s) => ({ project: touch({ ...s.project, markers: s.project.markers.filter((m) => m.id !== id) }), dirty: true }));
  },

  setCanvasSettings: (patch) => {
    set((s) => ({ project: touch({ ...s.project, canvas: { ...s.project.canvas, ...patch } }), dirty: true }));
  },
  setExportSettings: (patch) => {
    set((s) => ({ project: touch({ ...s.project, exportSettings: { ...s.project.exportSettings, ...patch } }), dirty: true }));
  },
  renameProject: (name) => set((s) => ({ project: touch({ ...s.project, name }), dirty: true })),
}));

export function clipKindFromMediaType(mediaType: MediaAsset['type']): ClipKind {
  switch (mediaType) {
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'image': return 'image';
    case 'gif': return 'image';
    case 'subtitle': return 'subtitle';
    default: return 'video';
  }
}
