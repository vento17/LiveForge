// Shared helpers for the "slave link" feature — right-click a control cell to
// slave it to another widget cell (or MIDI/OSC) via a Router row.
//
// A link is materialised as a RouterRow whose output targets the slave cell.
// Model: one router row per slave cell (source + a single output → slave cell).
// This keeps unlink / re-source trivial and robust.

import type { Project, Widget, RouterWidget, RouterRow, RouterInputType, TrigTrack } from '../../../shared/types/project';
import { cellCount, timelineTrigCells } from '../utils';

const BEAT_DIVS = [1, 2, 3, 4, 8, 16, 32, 64] as const;

// ─── Cell labelling ────────────────────────────────────────────────────────────
// Human label for the i-th cell of a widget (shared by RouterDesign + link menu).

export function cellLabel(w: Widget | undefined, cellIndex: number): string {
  if (!w) return `#${cellIndex + 1}`;
  if (w.kind === 'xyPad') return cellIndex === 0 ? 'X' : 'Y';
  if (w.kind === 'stepSequencer' || w.kind === 'graphWidget') return 'value';
  if (w.kind === 'lfoWidget') return 'output';
  if (w.kind === 'mathWidget') return 'result';
  if (w.kind === 'masterLevel') return 'level';
  if (w.kind === 'cues') {
    const cue = w.cues[cellIndex];
    return cue ? (cue.name || `cue ${cellIndex + 1}`) : `#${cellIndex + 1}`;
  }
  if (w.kind === 'autoBpm') {
    return cellIndex < 8
      ? `trig ×${BEAT_DIVS[cellIndex]}`
      : `ramp ×${BEAT_DIVS[cellIndex - 8]}`;
  }
  if (w.kind === 'timeline') {
    const track = w.tracks[cellIndex];
    if (track) return `${track.kind}: ${track.label}`;
    // Beyond the track cells: an individual trig marker
    const entry = timelineTrigCells(w)[cellIndex - w.tracks.length];
    if (!entry) return `#${cellIndex + 1}`;
    const trk = w.tracks[entry.trackIndex] as TrigTrack;
    const mk  = trk.keyframes[entry.markerIndex];
    const name = mk?.name || `#${mk?.num ?? entry.markerIndex + 1}`;
    return `${trk.label} · ${name}`;
  }
  if (w.kind === 'audioAnalyser') {
    if (cellIndex < 5) return ['kick', 'snare', 'bass', 'mid', 'high'][cellIndex] ?? `#${cellIndex + 1}`;
    if (cellIndex < 13) return `trig ×${BEAT_DIVS[cellIndex - 5] ?? '?'}`;
    return `ramp ×${BEAT_DIVS[cellIndex - 13] ?? '?'}`;
  }
  if (w.kind === 'soundPlayer') {
    const track = w.tracks[cellIndex];
    return track ? (track.label || track.fileName || `track ${cellIndex + 1}`) : `#${cellIndex + 1}`;
  }
  if ('cells' in w && Array.isArray(w.cells)) {
    const c = (w.cells as { label?: string }[])[cellIndex];
    return c?.label || `#${cellIndex + 1}`;
  }
  return `#${cellIndex + 1}`;
}

// ─── Source enumeration (for the link menu) ─────────────────────────────────────

export interface SourceCell {
  index: number;
  label: string;
}

// Cells of a widget that can be used as a link source.
export function sourceCells(widget: Widget): SourceCell[] {
  const n = cellCount(widget);
  return Array.from({ length: n }, (_, i) => ({ index: i, label: cellLabel(widget, i) }));
}

export interface SourcePageGroup {
  pageId: string;
  pageName: string;
  widgets: Widget[];
}

// All widgets across all pages that expose at least one cell (grouped by page).
// A widget is excluded as source only when it has no cells (router, image, text…).
export function listLinkableSources(project: Project): SourcePageGroup[] {
  const groups: SourcePageGroup[] = [];
  for (const page of project.pages) {
    const widgets = page.widgets.filter((w) => cellCount(w) > 0);
    if (widgets.length > 0) {
      groups.push({ pageId: page.id, pageName: page.name, widgets });
    }
  }
  return groups;
}

// ─── Router enumeration ─────────────────────────────────────────────────────────

export interface RouterRef {
  id: string;
  label: string;
  pageId: string;
  pageName: string;
}

export function listRouters(project: Project): RouterRef[] {
  const out: RouterRef[] = [];
  for (const page of project.pages) {
    for (const w of page.widgets) {
      if (w.kind === 'router') {
        out.push({ id: w.id, label: w.label, pageId: page.id, pageName: page.name });
      }
    }
  }
  return out;
}

// Page id a widget lives on (used to place a freshly-created router).
export function pageIdOfWidget(project: Project, widgetId: string): string | null {
  for (const page of project.pages) {
    if (page.widgets.some((w) => w.id === widgetId)) return page.id;
  }
  return null;
}

// ─── Slave link lookup ──────────────────────────────────────────────────────────

export interface SlaveLink {
  routerId: string;
  routerLabel: string;
  row: RouterRow;
  outputId: string;
  source: { primary: string; secondary: string };
}

function findWidgetById(project: Project, widgetId: string): Widget | undefined {
  for (const page of project.pages) {
    const w = page.widgets.find((x) => x.id === widgetId);
    if (w) return w;
  }
  return undefined;
}

// Describe a router row's input source for display.
export function describeRowSource(project: Project, row: RouterRow): { primary: string; secondary: string } {
  const t: RouterInputType = row.inputType ?? 'widget';
  if (t === 'midiCC')   return { primary: 'MIDI CC',   secondary: `ch${row.midiChannel ?? 1} #${row.midiNumber ?? 0}` };
  if (t === 'midiNote') return { primary: 'MIDI Note', secondary: `ch${row.midiChannel ?? 1} #${row.midiNumber ?? 0}` };
  if (t === 'osc')      return { primary: 'OSC',       secondary: row.oscAddress ?? '—' };
  const src = findWidgetById(project, row.widgetId);
  return { primary: src ? src.label : '—', secondary: cellLabel(src, row.cellIndex) };
}

// Find the router row whose output targets the given slave cell (first match).
export function findSlaveLink(project: Project, slaveWidgetId: string, slaveCellIndex: number): SlaveLink | null {
  for (const page of project.pages) {
    for (const w of page.widgets) {
      if (w.kind !== 'router') continue;
      const router = w as RouterWidget;
      for (const row of router.rows) {
        for (const out of row.outputs) {
          if (out.targetWidgetId === slaveWidgetId && (out.targetCellIndex ?? 0) === slaveCellIndex) {
            return {
              routerId: router.id,
              routerLabel: router.label,
              row,
              outputId: out.id,
              source: describeRowSource(project, row),
            };
          }
        }
      }
    }
  }
  return null;
}

// Set of cell indices of a widget that are currently slaved (targeted by a router).
export function computeSlavedCellSet(project: Project, slaveWidgetId: string): Set<number> {
  const set = new Set<number>();
  for (const page of project.pages) {
    for (const w of page.widgets) {
      if (w.kind !== 'router') continue;
      for (const row of (w as RouterWidget).rows) {
        for (const out of row.outputs) {
          if (out.targetWidgetId === slaveWidgetId) set.add(out.targetCellIndex ?? 0);
        }
      }
    }
  }
  return set;
}
