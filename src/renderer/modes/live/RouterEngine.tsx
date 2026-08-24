import { useEffect, useRef } from 'react';
import type { RouterRow, RouterWidget, Widget } from '../../../shared/types/project';
import type { Mapping } from '../../../shared/types/mapping';
import { useStore } from '../../store';
import { cellCount } from '../../widgets/utils';
import { remapRange, isIdentityRange } from '../../widgets/base/range';
import { dispatchValue } from '../../ipc/dispatch';
import { pressCell, releaseCell } from '../../widgets/ButtonGrid/behavior';
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

function findWidget(widgetId: string): Widget | undefined {
  for (const page of useStore.getState().project.pages) {
    const w = page.widgets.find((x) => x.id === widgetId);
    if (w) return w;
  }
  return undefined;
}

// Last incoming value per driven button cell, so an edge can be told from a
// stream of the same value. Module-level: the engine is mounted once.
const lastButtonInput = new Map<string, number>();

function driveCell(widgetId: string, cellIdx: number, v: number, isButton: boolean): void {
  if (isButton) { driveButtonCell(widgetId, cellIdx, v); return; }
  useStore.getState().setCellValue(widgetId, cellIdx, v);
  const cellMapping = getWidgetCellMapping(widgetId, cellIdx);
  if (cellMapping) dispatchValue(cellMapping, v);
}

// A physical pad sends note-on then note-off. Writing that straight into the
// cell made every linked button momentary regardless of how it was configured,
// so the incoming EDGE is treated as a press/release and the cell's own
// behaviour decides the state — a toggle stays lit after the pad is released.
// pressCell also sends the cell's mapping, so a controller patched to the MIDI
// output gets the resulting state back and lights its LED.
function driveButtonCell(widgetId: string, cellIdx: number, v: number): void {
  const w = findWidget(widgetId);
  if (!w || w.kind !== 'buttonGrid') return;
  const key = `${widgetId}:${cellIdx}`;
  const prev = lastButtonInput.get(key) ?? 0;
  lastButtonInput.set(key, v);
  if (prev < 0.5 && v >= 0.5) pressCell(w, cellIdx);
  else if (prev >= 0.5 && v < 0.5) releaseCell(w, cellIdx);
}

// srcIndex is set when the row listens to a whole widget: the value then belongs
// to one specific source cell, and an ALL output mirrors it onto the SAME index
// (bank → bank, 1:1). Without it an ALL output fans one value out to every cell.
function routeValue(row: RouterRow, vIn: number, srcIndex?: number): void {
  // Publish what the row received so the router widget can show it. Widget-input
  // rows read their source cell directly and do not need this; MIDI and OSC rows
  // have no cell to read, which is why they used to display a permanent 0.
  if ((row.inputType ?? 'widget') !== 'widget') {
    useStore.getState().setRouterInput(row.id, vIn);
  }
  for (const out of row.outputs) {
    // Each output gets its own travel through the source's range.
    const v = isIdentityRange(out) ? vIn : remapRange(vIn, out);
    if (out.targetWidgetId) {
      const isButton = isButtonTarget(out.targetWidgetId);
      if (out.targetAllCells) {
        const w = findWidget(out.targetWidgetId);
        const n = w ? cellCount(w) : 0;
        if (srcIndex !== undefined) {
          if (srcIndex < n) driveCell(out.targetWidgetId, srcIndex, v, isButton);
        } else {
          for (let i = 0; i < n; i++) driveCell(out.targetWidgetId, i, v, isButton);
        }
      } else {
        // A single-cell output cannot follow an index, so it tracks the first
        // source cell only.
        if (srcIndex === undefined || srcIndex === 0) {
          driveCell(out.targetWidgetId, out.targetCellIndex ?? 0, v, isButton);
        }
      }
    } else if (out.mapping) {
      if (srcIndex === undefined || srcIndex === 0) dispatchValue(out.mapping, v);
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

        if (row.allCells) {
          // Every cell of the source is its own signal, tracked separately so a
          // bank mirrors onto another bank fader by fader.
          for (let i = 0; i < wRuntime.cells.length; i++) {
            const c = wRuntime.cells[i];
            if (!c) continue;
            const cv = c.value !== undefined ? c.value : (c.active ? 1 : 0);
            const key = `${row.id}:${i}`;
            if (prevValues.current[key] === cv) continue;
            prevValues.current[key] = cv;
            routeValue(row, cv, i);
          }
          continue;
        }

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
