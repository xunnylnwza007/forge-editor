const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / Pause'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Ctrl/Cmd + Shift + Z', 'Redo'],
  ['Ctrl/Cmd + K', 'Split at playhead'],
  ['Delete / Backspace', 'Delete selected clip(s)'],
  ['Ctrl/Cmd + C', 'Copy'],
  ['Ctrl/Cmd + V', 'Paste'],
  ['Ctrl/Cmd + D', 'Duplicate'],
  ['Left / Right Arrow', 'Step one frame'],
  ['Ctrl/Cmd + A', 'Select all clips'],
  ['Ctrl/Cmd + S', 'Save project'],
  ['Esc', 'Deselect'],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Keyboard Shortcuts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            {SHORTCUTS.map(([key, action]) => (
              <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '7px 4px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{key}</td>
                <td style={{ padding: '7px 4px', color: 'var(--text-mid)' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal__footer">
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
