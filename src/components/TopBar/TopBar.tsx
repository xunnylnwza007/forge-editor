import { useEffect, useState } from 'react';
import { Undo2, Redo2, Save, Upload, Download, Keyboard, FilePlus2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { history } from '@/engine/history';
import { downloadProjectFile, readProjectFile, deserializeProject, clearAutosave } from '@/engine/projectFile';
import { persistMediaBlobs } from '@/engine/projectFile';

export function TopBar({ onExportClick, onShortcutsClick }: { onExportClick: () => void; onShortcutsClick: () => void }) {
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const renameProject = useProjectStore((s) => s.renameProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const markSaved = useProjectStore((s) => s.markSaved);

  const [, forceUpdate] = useState(0);
  useEffect(() => history.subscribe(() => forceUpdate((n) => n + 1)), []);

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.nleproj.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const sp = await readProjectFile(file);
      const { project: p, missingAssetIds } = await deserializeProject(sp as any);
      loadProject(p);
      history.clear();
      if (missingAssetIds.length > 0) {
        alert(`${missingAssetIds.length} media file(s) could not be found in local storage and will need to be re-imported.`);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    await persistMediaBlobs(project.mediaAssets);
    downloadProjectFile(project);
    markSaved();
  };

  const handleNew = () => {
    if (dirty && !confirm('Start a new project? Unsaved changes will be lost.')) return;
    clearAutosave();
    newProject();
  };

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <span className="topbar__brand-mark" />
        Forge
      </div>
      <div className="topbar__divider" />
      <button className="btn ghost icon" title="New Project" onClick={handleNew}><FilePlus2 size={15} /></button>
      <button className="btn ghost icon" title="Open Project" onClick={handleOpen}><Upload size={15} /></button>
      <button className="btn ghost icon" title="Undo (Ctrl+Z)" disabled={!history.canUndo()} onClick={() => history.undo()}><Undo2 size={15} /></button>
      <button className="btn ghost icon" title="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo()} onClick={() => history.redo()}><Redo2 size={15} /></button>
      <div className="topbar__divider" />
      <input
        className="topbar__project-name"
        value={project.name}
        onChange={(e) => renameProject(e.target.value)}
        spellCheck={false}
      />
      <span className="topbar__autosave">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
      <div className="topbar__spacer" />
      <button className="btn ghost icon" title="Keyboard Shortcuts" onClick={onShortcutsClick}><Keyboard size={15} /></button>
      <button className="btn" onClick={handleSave}><Save size={14} /> Save Project</button>
      <button className="btn primary" onClick={onExportClick}><Download size={14} /> Export</button>
    </div>
  );
}
