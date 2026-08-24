// Corner marker so a grid mixing behaviours is readable without opening the
// cell editor. Lives outside the component file: exporting a non-component from
// one breaks React Fast Refresh for the whole module.
export const BEHAVIOR_BADGE: Record<string, string> = {
  momentary: 'M', pulse: 'P', toggle: 'T', radio: 'R',
};

import type { ButtonGridWidget } from '../../../shared/types/project';
import { useStore } from '../../store';
import { dispatchButton } from '../../ipc/dispatch';

// ─── Press / release, in one place ───────────────────────────────────────────
//
// Both the on-screen grid and the Router drive the same cells, and they must
// agree on what a press means: a physical controller sends note-on/note-off, so
// routing its raw value straight into the cell made every linked button behave
// as momentary no matter how it was configured. Instead the incoming edge is
// treated as a press, and the cell's own behaviour decides the resulting state.
//
// Everything here writes the state AND sends the cell's mapping, so a controller
// wired to the MIDI output sees the real state and lights its LED accordingly.

export function pressCell(widget: ButtonGridWidget, i: number): void {
  const store = useStore.getState();
  const cell = widget.cells[i];
  const rt = store.runtime.widgets[widget.id]?.cells[i];
  const mapping = cell?.mapping ?? widget.mapping;
  const on  = cell?.onValue ?? 127;
  const off = cell?.offValue ?? 0;
  const behavior = cell?.behavior ?? 'momentary';

  const set = (idx: number, active: boolean, m = mapping, onV = on, offV = off) => {
    store.setButtonActive(widget.id, idx, active);
    store.setCellValue(widget.id, idx, active ? 1 : 0);
    dispatchButton(m, active, onV, offV);
  };

  if (behavior === 'toggle') {
    set(i, !(rt?.active ?? false));
  } else if (behavior === 'pulse') {
    set(i, true);
    setTimeout(() => set(i, false), 100);
  } else if (behavior === 'radio') {
    widget.cells.forEach((c, idx) => {
      if (c?.behavior === 'radio' && idx !== i) {
        set(idx, false, c?.mapping ?? widget.mapping, c?.onValue ?? 127, c?.offValue ?? 0);
      }
    });
    set(i, true);
  } else {
    set(i, true);
  }
}

// Only momentary cells fall on release; the others hold whatever press decided.
export function releaseCell(widget: ButtonGridWidget, i: number): void {
  const cell = widget.cells[i];
  const behavior = cell?.behavior ?? 'momentary';
  if (behavior !== 'momentary') return;
  const store = useStore.getState();
  store.setButtonActive(widget.id, i, false);
  store.setCellValue(widget.id, i, 0);
  dispatchButton(cell?.mapping ?? widget.mapping, false, cell?.onValue ?? 127, cell?.offValue ?? 0);
}
