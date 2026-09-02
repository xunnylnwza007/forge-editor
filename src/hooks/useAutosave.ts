import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { scheduleAutosave, persistMediaBlobs } from '@/engine/projectFile';

export function useAutosave() {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);

  useEffect(() => {
    if (!dirty) return;
    scheduleAutosave(project);
    if (project.mediaAssets.length > 0) {
      persistMediaBlobs(project.mediaAssets).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);
}
