import type { StateCreator } from 'zustand';
import type { StoreState } from './index';
import type { RuntimeState, WidgetRuntime, CellRuntime } from '../../shared/types/runtime';
import type { Widget } from '../../shared/types/project';
import { cellCount } from '../widgets/utils';

export interface RuntimeSlice {
  runtime: RuntimeState;

  // Called when entering Live mode to initialize all widgets
  initRuntime: (widgets: Widget[]) => void;
  resetRuntime: () => void;

  // Value updates from touch input
  setCellValue: (widgetId: string, cellIndex: number, value: number) => void;
  setButtonActive: (widgetId: string, cellIndex: number, active: boolean) => void;
  // Batched write: sets values[i] into cells[startIndex + i] in one store update
  setRampCells: (widgetId: string, startIndex: number, values: number[]) => void;

  // Feedback from OSC
  applyFeedback: (widgetId: string, cellIndex: number, color: string | null, label: string | null) => void;
}

function makeCell(): CellRuntime {
  return { value: 0, active: false, feedbackColor: null, feedbackLabel: null };
}

function makeWidgetRuntime(widget: Widget): WidgetRuntime {
  const count = cellCount(widget);
  const cells = Array.from({ length: count }, makeCell);
  // A master starts at full (1) — 0 would mute everything on its protocol.
  if (widget.kind === 'masterLevel' && cells[0]) cells[0].value = 1;
  return { widgetId: widget.id, cells };
}

export const createRuntimeSlice: StateCreator<StoreState, [['zustand/immer', never]], [], RuntimeSlice> = (set) => ({
  runtime: { widgets: {} },

  initRuntime: (widgets) => set((s) => {
    const prev = s.runtime.widgets;
    s.runtime.widgets = {};
    for (const widget of widgets) {
      const existing = prev[widget.id];
      const count = cellCount(widget);
      if (existing) {
        s.runtime.widgets[widget.id] = {
          widgetId: widget.id,
          cells: Array.from({ length: count }, (_, i) => existing.cells[i] ?? makeCell()),
        };
      } else {
        s.runtime.widgets[widget.id] = makeWidgetRuntime(widget);
      }
    }
  }),

  resetRuntime: () => set((s) => {
    s.runtime = { widgets: {} };
  }),

  setCellValue: (widgetId, cellIndex, value) => set((s) => {
    const wr = s.runtime.widgets[widgetId];
    if (!wr || !wr.cells[cellIndex]) return;
    wr.cells[cellIndex].value = Math.max(0, Math.min(1, value));
  }),

  setButtonActive: (widgetId, cellIndex, active) => set((s) => {
    const wr = s.runtime.widgets[widgetId];
    if (!wr || !wr.cells[cellIndex]) return;
    wr.cells[cellIndex].active = active;
  }),

  setRampCells: (widgetId, startIndex, values) => set((s) => {
    const wr = s.runtime.widgets[widgetId];
    if (!wr) return;
    for (let i = 0; i < values.length; i++) {
      const cell = wr.cells[startIndex + i];
      if (cell) cell.value = Math.max(0, Math.min(1, values[i]));
    }
  }),

  applyFeedback: (widgetId, cellIndex, color, label) => set((s) => {
    const wr = s.runtime.widgets[widgetId];
    if (!wr || !wr.cells[cellIndex]) return;
    wr.cells[cellIndex].feedbackColor = color;
    wr.cells[cellIndex].feedbackLabel = label;
  }),
});
