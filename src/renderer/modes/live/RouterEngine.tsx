import { useEffect, useRef } from 'react';
import type { RouterRow, RouterWidget } from '../../../shared/types/project';
import type { Mapping } from '../../../shared/types/mapping';
import { useStore } from '../../store';
import { dispatchValue } from '../../ipc/dispatch';
import { bridge } from '../../ipc/bridge';

// Headless engine that runs ALL router rows across ALL pages, regardless of
// which page is currently shown. This is what makes cross-page links work:
// a router only routes while its own page is mounted otherwise, but here the
// engine is mounted once for the whole Live session.
//
// Note: generator sources (LFO, timeline, autoBpm, audioAnalyser, stepSequencer,
// graph) only tick while their page is active — their animation loops live in
// their Live components. When their page is not shown, their runtime value
// freezes at the last emitted value and the engine keeps forwarding that.

function getWidgetCellMapping(widgetId: string, cellIndex: number): Mapping {
  const state = useStore.getState();
  for (const page of state.project.pages) {
    const w = page.widgets.find((x) => x.id === widgetId);
    if (!w) continue;
    if (w.kind === 'xyPad') return cellIndex === 0 ? w.mappingX : w.mappingY;
    if (w.kind === 'autoBpm') {
      return cellIndex < 8
        ? (w.beatOutputs[cellIndex]?.triggerMapping ?? null)
        : (w.beatOutputs[cellIndex - 8]?.rampMapping ?? null);
    }
    if (w.kind === 'timeline') {
      const track = w.tracks[cellIndex];
      if (!track) return null;
      if (track.kind === 'value' || track.kind === 'trig') return (track as { mapping: Mapping }).mapping;
      return null;
    }
    if (w.kind === 'audioAnalyser') {
      const audioKeys = ['kickMapping', 'snareMapping', 'bassMapping', 'midMapping', 'highMapping'] as const;
      if (cellIndex < 5) return (w[audioKeys[cellIndex]] ?? null) as Mapping;
      if (cellIndex < 13) return (w.beatOutputs?.[cellIndex - 5]?.triggerMapping ?? null);
      return (w.beatOutputs?.[cellIndex - 13]?.rampMapping ?? null);
    }
    if (w.kind === 'soundPlayer') {
      return (w.tracks[cellIndex]?.playMapping ?? null) as Mapping;
    }
    if ('cells' in w && Array.isArray(w.cells)) {
      return ((w.cells as { mapping?: Mapping }[])[cellIndex]?.mapping ?? null);
    }
    if ('mapping' in w) return (w as { mapping: Mapping }).mapping;
    return null;
  }
  return null;
}

function isButtonTarget(widgetId: string): boolean {
  for (const page of useStore.getState().project.pages) {
    const w = page.widgets.find((x) => x.id === widgetId);
    if (w) return w.kind === 'buttonGrid';
  }
  return false;
}

function routeValue(row: RouterRow, v: number): void {
  for (const out of row.outputs) {
    if (out.targetWidgetId) {
      const cellIdx = out.targetCellIndex ?? 0;
      useStore.getState().setCellValue(out.targetWidgetId, cellIdx, v);
      // Buttons show their lit state via `active`, not `value` — keep it in sync.
      if (isButtonTarget(out.targetWidgetId)) {
        useStore.getState().setButtonActive(out.targetWidgetId, cellIdx, v >= 0.5);
      }
      const cellMapping = getWidgetCellMapping(out.targetWidgetId, cellIdx);
      if (cellMapping) dispatchValue(cellMapping, v);
    } else if (out.mapping) {
      dispatchValue(out.mapping, v);
    }
  }
}

// All router rows currently in the project (across every page).
function allRouterRows(): RouterRow[] {
  const rows: RouterRow[] = [];
  for (const page of useStore.getState().project.pages) {
    for (const w of page.widgets) {
      if (w.kind === 'router') rows.push(...(w as RouterWidget).rows);
    }
  }
  return rows;
}

export default function RouterEngine(): null {
  const prevValues = useRef<Record<string, number>>({});

  // Widget-cell sources — react to runtime store changes.
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (state.runtime.widgets === prevState.runtime.widgets) return;

      for (const row of allRouterRows()) {
        if (row.outputs.length === 0) continue;
        const inputType = row.inputType ?? 'widget';
        if (inputType !== 'widget' || !row.widgetId) continue;

        const wRuntime = state.runtime.widgets[row.widgetId];
        if (!wRuntime) continue;
        const cell = wRuntime.cells[row.cellIndex];
        if (!cell) continue;

        const v = cell.value !== undefined ? cell.value : (cell.active ? 1 : 0);
        if (prevValues.current[row.id] === v) continue;
        prevValues.current[row.id] = v;
        routeValue(row, v);
      }
    });
    return unsubscribe;
  }, []);

  // MIDI input sources.
  useEffect(() => {
    const unsubscribe = bridge.on('tr:midi:inputEvent', (evt) => {
      for (const row of allRouterRows()) {
        if (row.outputs.length === 0) continue;
        const inputType = row.inputType ?? 'widget';
        if (inputType !== 'midiCC' && inputType !== 'midiNote') continue;

        const ch = row.midiChannel ?? 0;
        if (ch !== 0 && ch !== evt.channel) continue;

        let v: number;
        if (inputType === 'midiCC') {
          if (evt.messageType !== 'controlChange') continue;
          if (row.midiNumber !== undefined && row.midiNumber !== evt.number) continue;
          v = evt.value / 127;
        } else {
          if (evt.messageType !== 'noteOn' && evt.messageType !== 'noteOff') continue;
          if (row.midiNumber !== undefined && row.midiNumber !== evt.number) continue;
          v = evt.messageType === 'noteOn' ? evt.value / 127 : 0;
        }

        if (prevValues.current[row.id] === v) continue;
        prevValues.current[row.id] = v;
        routeValue(row, v);
      }
    });
    return unsubscribe;
  }, []);

  // OSC input sources.
  useEffect(() => {
    const unsubscribe = bridge.on('tr:osc:feedback', (msg) => {
      for (const row of allRouterRows()) {
        if (row.outputs.length === 0) continue;
        const inputType = row.inputType ?? 'widget';
        if (inputType !== 'osc') continue;
        if (!row.oscAddress || msg.address !== row.oscAddress) continue;

        const firstArg = msg.args[0];
        let v: number;
        if (typeof firstArg === 'number') {
          v = Math.max(0, Math.min(1, firstArg));
        } else if (typeof firstArg === 'boolean') {
          v = firstArg ? 1 : 0;
        } else {
          continue;
        }

        if (prevValues.current[row.id] === v) continue;
        prevValues.current[row.id] = v;
        routeValue(row, v);
      }
    });
    return unsubscribe;
  }, []);

  return null;
}
