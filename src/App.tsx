import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { TopBar } from '@/components/TopBar/TopBar';
import { MediaPanel } from '@/components/MediaPanel/MediaPanel';
import { PreviewPanel } from '@/components/Preview/PreviewPanel';
import { InspectorPanel } from '@/components/Inspector/InspectorPanel';
import { Timeline } from '@/components/Timeline/Timeline';
import { ExportModal } from '@/components/ExportModal';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { ResizableSplitter } from '@/components/common/ResizableSplitter';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAutosave } from '@/hooks/useAutosave';
import { loadAutosave, deserializeProject, getAutosaveTimestamp, clearAutosave } from '@/engine/projectFile';

export default function App() {
  useKeyboardShortcuts();
  useAutosave();

  const {
    mediaPanelWidth, inspectorWidth, timelineHeight,
    mediaPanelCollapsed, inspectorCollapsed,
    setMediaPanelWidth, setInspectorWidth, setTimelineHeight,
    toggleMediaPanel, toggleInspector,
  } = useUIStore();

  const loadProject = useProjectStore((s) => s.loadProject);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [recoveryPrompt, setRecoveryPrompt] = useState<{ timestamp: number } | null>(null);

  useEffect(() => {
    const sp = loadAutosave();
    const ts = getAutosaveTimestamp();
    if (sp && ts) setRecoveryPrompt({ timestamp: ts });
  }, []);

  const handleRecover = async () => {
    const sp = loadAutosave();
    if (!sp) return;
    const { project, missingAssetIds } = await deserializeProject(sp as any);
    loadProject(project);
    setRecoveryPrompt(null);
    if (missingAssetIds.length > 0) {
      alert(`${missingAssetIds.length} media file(s) from the autosave could not be recovered and will need to be re-imported.`);
    }
  };

  const handleDiscardRecovery = () => {
    clearAutosave();
    setRecoveryPrompt(null);
  };

  return (
    <div className="app-shell">
      <TopBar onExportClick={() => setExportOpen(true)} onShortcutsClick={() => setShortcutsOpen(true)} />
      <div className="editor-body">
        {mediaPanelCollapsed ? (
          <div className="collapse-strip" onClick={toggleMediaPanel} title="Show media panel"><ChevronRight size={14} /></div>
        ) : (
          <div style={{ width: mediaPanelWidth, display: 'flex', gridRow: 1, gridColumn: 1 }}>
            <MediaPanel />
            <ResizableSplitter orientation="vertical" onResize={(dx) => setMediaPanelWidth(Math.max(220, Math.min(600, mediaPanelWidth + dx)))} />
          </div>
        )}

        <PreviewPanel />

        {inspectorCollapsed ? (
          <div className="collapse-strip right" onClick={toggleInspector} title="Show inspector"><ChevronLeft size={14} /></div>
        ) : (
          <div style={{ width: inspectorWidth, display: 'flex', gridRow: 1, gridColumn: 3 }}>
            <ResizableSplitter orientation="vertical" onResize={(dx) => setInspectorWidth(Math.max(260, Math.min(560, inspectorWidth - dx)))} />
            <InspectorPanel />
          </div>
        )}

        <div style={{ gridRow: 2, gridColumn: '1 / span 3', display: 'flex', flexDirection: 'column' }}>
          <ResizableSplitter orientation="horizontal" onResize={(dy) => setTimelineHeight(Math.max(160, Math.min(700, timelineHeight - dy)))} />
          <div style={{ height: timelineHeight }}>
            <Timeline />
          </div>
        </div>
      </div>

      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {recoveryPrompt && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 420 }}>
            <h2>Recover unsaved project?</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              We found an autosaved project from {new Date(recoveryPrompt.timestamp).toLocaleString()}. Would you like to restore it?
            </p>
            <div className="modal__footer">
              <button className="btn" onClick={handleDiscardRecovery}>Discard</button>
              <button className="btn primary" onClick={handleRecover}>Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
