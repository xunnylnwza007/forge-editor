import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { history } from '@/engine/history';
import { playbackClock } from '@/engine/playbackClock';
import { mediaPool } from '@/engine/mediaPool';
import { downloadProjectFile, persistMediaBlobs } from '@/engine/projectFile';

function isTypingTarget(el: EventTarget | null) {
  const tag = (el as HTMLElement)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement)?.isContentEditable;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const cmdKey = e.ctrlKey || e.metaKey;
      const ui = useUIStore.getState();
      const proj = useProjectStore.getState();

      if (e.code === 'Space') {
        e.preventDefault();
        mediaPool.resumeAudioContext();
        playbackClock.togglePlay();
        return;
      }
      if (cmdKey && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); history.redo(); return; }
      if (cmdKey && e.key.toLowerCase() === 'z') { e.preventDefault(); history.undo(); return; }
      if (cmdKey && e.key.toLowerCase() === 'y') { e.preventDefault(); history.redo(); return; }
      if (cmdKey && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.selectedClipIds.forEach((id) => proj.splitClipAt(id, ui.playheadTime)); return; }
      if (cmdKey && e.key.toLowerCase() === 'd') { e.preventDefault(); if (ui.selectedClipIds.length) proj.duplicateClips(ui.selectedClipIds); return; }
      if (cmdKey && e.key.toLowerCase() === 'c') { e.preventDefault(); useUIStore.setState({ clipboard: ui.selectedClipIds }); return; }
      if (cmdKey && e.key.toLowerCase() === 'v') { e.preventDefault(); if (ui.clipboard.length) proj.duplicateClips(ui.clipboard); return; }
      if (cmdKey && e.key.toLowerCase() === 'a') { e.preventDefault(); ui.setSelectedClipIds(proj.project.clips.map((c) => c.id)); return; }
      if (cmdKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        persistMediaBlobs(proj.project.mediaAssets).then(() => downloadProjectFile(proj.project));
        proj.markSaved();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedClipIds.length) {
        e.preventDefault();
        proj.removeClips(ui.selectedClipIds);
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); playbackClock.stepFrame(proj.project.canvas.fps, -1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); playbackClock.stepFrame(proj.project.canvas.fps, 1); return; }
      if (e.key === 'Escape') { ui.setSelectedClipIds([]); return; }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
