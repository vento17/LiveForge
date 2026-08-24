// Runtime state is NEVER serialized to JSON.
// It lives only in memory for the duration of a live session.

// ─── Per-cell runtime value ───────────────────────────────────────────────────

export interface CellRuntime {
  value: number;         // normalized 0.0–1.0
  active: boolean;       // for buttons: current toggle/press state
  feedbackColor: string | null;  // null = use widget default style
  feedbackLabel: string | null;
}

// ─── Per-widget runtime ───────────────────────────────────────────────────────

// For sliderBank / knobBank / buttonGrid: cells[i] maps to the i-th cell.
// For xyPad: cells[0] = X axis, cells[1] = Y axis.
export interface WidgetRuntime {
  widgetId: string;
  cells: CellRuntime[];
  // Transport state of widgets that own one (LFO, Graph, Step Sequencer). It
  // lives here rather than inside the component so a Cue can snapshot it and
  // drive it back on recall. undefined = the widget has no transport.
  playing?: boolean;
}

// ─── Global runtime state ─────────────────────────────────────────────────────

export interface RuntimeState {
  widgets: Record<string, WidgetRuntime>; // keyed by widgetId
}

// ─── IPC feedback message (Main → Renderer) ───────────────────────────────────

export interface OscFeedbackMessage {
  address: string;
  args: (number | string | boolean)[];
  receivedAt: number;  // Date.now()
}

// ─── MIDI device info (Main → Renderer, on request) ──────────────────────────

export interface MidiPortInfo {
  index: number;
  name: string;
}
