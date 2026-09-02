// ============================================================================
// Command-based undo/redo history.
// Every mutating editor action is expressed as a Command with do()/undo().
// The history keeps up to MAX_HISTORY commands in each direction.
// ============================================================================

export interface Command {
  label: string;
  do: () => void;
  undo: () => void;
  /** Commands created within this window (ms) of the previous one and with
   * the same coalesceKey get merged into a single undo step (e.g. dragging a
   * slider fires many updates but should undo in one step). */
  coalesceKey?: string;
}

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 400;

type Listener = () => void;

class HistoryManager {
  private past: Command[] = [];
  private future: Command[] = [];
  private lastPushTime = 0;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Execute a command's do() and record it. */
  execute(cmd: Command) {
    cmd.do();
    const now = Date.now();
    const top = this.past[this.past.length - 1];
    const canCoalesce =
      top &&
      cmd.coalesceKey &&
      top.coalesceKey === cmd.coalesceKey &&
      now - this.lastPushTime < COALESCE_WINDOW_MS;

    if (canCoalesce) {
      // Replace the top command's do/undo with the merged version, but keep
      // the ORIGINAL undo (state before the whole coalesced sequence).
      this.past[this.past.length - 1] = { ...cmd, undo: top.undo };
    } else {
      this.past.push(cmd);
      if (this.past.length > MAX_HISTORY) this.past.shift();
    }
    this.lastPushTime = now;
    this.future = [];
    this.emit();
  }

  undo() {
    const cmd = this.past.pop();
    if (!cmd) return;
    cmd.undo();
    this.future.push(cmd);
    this.emit();
  }

  redo() {
    const cmd = this.future.pop();
    if (!cmd) return;
    cmd.do();
    this.past.push(cmd);
    this.emit();
  }

  canUndo() {
    return this.past.length > 0;
  }
  canRedo() {
    return this.future.length > 0;
  }
  clear() {
    this.past = [];
    this.future = [];
    this.emit();
  }
  get undoLabel() {
    return this.past[this.past.length - 1]?.label;
  }
  get redoLabel() {
    return this.future[this.future.length - 1]?.label;
  }
}

export const history = new HistoryManager();
