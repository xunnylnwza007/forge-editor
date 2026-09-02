import { create } from 'zustand';

export type LeftTab =
  | 'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions'
  | 'captions' | 'filters' | 'templates' | 'adjustment' | 'ai';

export type InspectorTab = 'video' | 'audio' | 'speed' | 'animation' | 'adjustment' | 'text' | 'transition';

const LAYOUT_KEY = 'nle.layout.v1';

interface PanelLayout {
  mediaPanelWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
  mediaPanelCollapsed: boolean;
  inspectorCollapsed: boolean;
}

const defaultLayout: PanelLayout = {
  mediaPanelWidth: 300,
  inspectorWidth: 320,
  timelineHeight: 300,
  mediaPanelCollapsed: false,
  inspectorCollapsed: false,
};

function loadLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...defaultLayout, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultLayout;
}

function saveLayout(layout: PanelLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

interface UIStore extends PanelLayout {
  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;

  inspectorTab: InspectorTab;
  setInspectorTab: (t: InspectorTab) => void;

  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;
  toggleClipSelection: (id: string, additive: boolean) => void;

  selectedMediaId: string | null;
  setSelectedMediaId: (id: string | null) => void;

  playheadTime: number;
  setPlayheadTime: (t: number) => void;

  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;

  pixelsPerSecond: number;
  setPixelsPerSecond: (v: number | ((v: number) => number)) => void;

  snappingEnabled: boolean;
  toggleSnapping: () => void;

  previewQuality: 'full' | 'half' | 'quarter';
  setPreviewQuality: (q: 'full' | 'half' | 'quarter') => void;

  timelineScrollLeft: number;
  setTimelineScrollLeft: (v: number) => void;

  setMediaPanelWidth: (w: number) => void;
  setInspectorWidth: (w: number) => void;
  setTimelineHeight: (h: number) => void;
  toggleMediaPanel: () => void;
  toggleInspector: () => void;

  clipboard: string[]; // clip ids "copied", cut vs copy tracked separately
}

export const useUIStore = create<UIStore>((set, get) => ({
  ...loadLayout(),

  leftTab: 'media',
  setLeftTab: (t) => set({ leftTab: t }),

  inspectorTab: 'video',
  setInspectorTab: (t) => set({ inspectorTab: t }),

  selectedClipIds: [],
  setSelectedClipIds: (ids) => set({ selectedClipIds: ids }),
  toggleClipSelection: (id, additive) =>
    set((s) => {
      if (!additive) return { selectedClipIds: [id] };
      const has = s.selectedClipIds.includes(id);
      return { selectedClipIds: has ? s.selectedClipIds.filter((x) => x !== id) : [...s.selectedClipIds, id] };
    }),

  selectedMediaId: null,
  setSelectedMediaId: (id) => set({ selectedMediaId: id }),

  playheadTime: 0,
  setPlayheadTime: (t) => set({ playheadTime: Math.max(0, t) }),

  isPlaying: false,
  setIsPlaying: (p) => set({ isPlaying: p }),

  pixelsPerSecond: 60,
  setPixelsPerSecond: (v) =>
    set((s) => ({ pixelsPerSecond: Math.min(2000, Math.max(4, typeof v === 'function' ? v(s.pixelsPerSecond) : v)) })),

  snappingEnabled: true,
  toggleSnapping: () => set((s) => ({ snappingEnabled: !s.snappingEnabled })),

  previewQuality: 'full',
  setPreviewQuality: (q) => set({ previewQuality: q }),

  timelineScrollLeft: 0,
  setTimelineScrollLeft: (v) => set({ timelineScrollLeft: v }),

  setMediaPanelWidth: (w) => {
    set({ mediaPanelWidth: w });
    saveLayout({ ...get(), mediaPanelWidth: w });
  },
  setInspectorWidth: (w) => {
    set({ inspectorWidth: w });
    saveLayout({ ...get(), inspectorWidth: w });
  },
  setTimelineHeight: (h) => {
    set({ timelineHeight: h });
    saveLayout({ ...get(), timelineHeight: h });
  },
  toggleMediaPanel: () => {
    const v = !get().mediaPanelCollapsed;
    set({ mediaPanelCollapsed: v });
    saveLayout({ ...get(), mediaPanelCollapsed: v });
  },
  toggleInspector: () => {
    const v = !get().inspectorCollapsed;
    set({ inspectorCollapsed: v });
    saveLayout({ ...get(), inspectorCollapsed: v });
  },

  clipboard: [],
}));
