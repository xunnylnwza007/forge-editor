import { MediaAsset, Project } from '@/types/models';
import { getBlob, putBlob } from '@/engine/mediaDB';

const AUTOSAVE_KEY = 'nle.autosave.v1';
const AUTOSAVE_DEBOUNCE_MS = 2000;

type SerializedMediaAsset = Omit<MediaAsset, 'file' | 'src' | 'waveformPeaks'> & {
  waveformPeaks?: number[];
};

export interface SerializedProject extends Omit<Project, 'mediaAssets'> {
  mediaAssets: SerializedMediaAsset[];
  formatVersion: 1;
}

export function serializeProject(project: Project): SerializedProject {
  return {
    ...project,
    formatVersion: 1,
    mediaAssets: project.mediaAssets.map(({ file, src, waveformPeaks, ...rest }) => ({
      ...rest,
      waveformPeaks: waveformPeaks ? Array.from(waveformPeaks) : undefined,
    })),
  };
}

/** Persist every media asset's underlying blob into IndexedDB, keyed by
 * asset id, so the project can be fully reopened after a reload/crash. */
export async function persistMediaBlobs(assets: MediaAsset[]): Promise<void> {
  await Promise.all(assets.map((a) => putBlob(a.id, a.file)));
}

export interface RehydrateResult {
  project: Project;
  missingAssetIds: string[];
}

/** Rebuild object URLs (and, where possible, File handles) from IndexedDB
 * for every media asset referenced by a serialized project. */
export async function deserializeProject(sp: SerializedProject): Promise<RehydrateResult> {
  const missingAssetIds: string[] = [];
  const mediaAssets: MediaAsset[] = await Promise.all(
    sp.mediaAssets.map(async (m) => {
      const blob = await getBlob(m.id);
      if (!blob) {
        missingAssetIds.push(m.id);
        return {
          ...m,
          file: new File([], m.name),
          src: '',
          waveformPeaks: m.waveformPeaks ? Float32Array.from(m.waveformPeaks) : undefined,
        } as MediaAsset;
      }
      const file = new File([blob], m.name, { type: m.metadata.mimeType });
      return {
        ...m,
        file,
        src: URL.createObjectURL(blob),
        waveformPeaks: m.waveformPeaks ? Float32Array.from(m.waveformPeaks) : undefined,
      } as MediaAsset;
    }),
  );

  const { formatVersion, ...rest } = sp;
  return { project: { ...rest, mediaAssets }, missingAssetIds };
}

export function downloadProjectFile(project: Project) {
  const serialized = serializeProject(project);
  const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^\w\-]+/g, '_')}.nleproj.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readProjectFile(file: File): Promise<SerializedProject> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutosave(project: Project) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      const serialized = serializeProject(project);
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialized));
      localStorage.setItem(AUTOSAVE_KEY + '.time', String(Date.now()));
    } catch (err) {
      // Quota exceeded or serialization failure — non-fatal, just skip this
      // autosave cycle rather than crashing the editor.
      console.warn('Autosave failed:', err);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}

export function loadAutosave(): SerializedProject | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
  localStorage.removeItem(AUTOSAVE_KEY + '.time');
}

export function getAutosaveTimestamp(): number | null {
  const t = localStorage.getItem(AUTOSAVE_KEY + '.time');
  return t ? Number(t) : null;
}
