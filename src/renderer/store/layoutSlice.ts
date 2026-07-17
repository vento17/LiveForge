import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { StoreState } from './index';
import type { Project, Page, Widget, Rect, WidgetKind, Connection, OutputProtocol, RouterWidget, RouterRow } from '../../shared/types/project';
import type { Mapping } from '../../shared/types/mapping';
import { makeDefaultWidget, nextFreeCc, makeSliderCells, makeButtonCells, makeKnobCells, defaultMidiMapping, defaultOscMapping } from '../widgets/defaults';

const KIND_LABEL_PREFIX: Partial<Record<WidgetKind, string>> = {
  sliderBank: 'slider', buttonGrid: 'button', knobBank: 'knob', xyPad: 'xy',
  stepSequencer: 'seq', graphWidget: 'graph', cues: 'cues', timeline: 'timeline',
  spoutInput: 'spout', ndiInput: 'ndi', submasters: 'sub', router: 'router',
  imageWidget: 'image', textWidget: 'text', masterLevel: 'master', instance: 'instance',
};

function nextUniqueLabel(project: Project, kind: WidgetKind): string {
  const prefix = KIND_LABEL_PREFIX[kind] ?? kind;
  const used = new Set<number>();
  for (const page of project.pages) {
    for (const w of page.widgets) {
      const m = w.label.match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) used.add(Number(m[1]));
    }
  }
  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}${n}`;
}
import { SCHEMA_VERSION, CANVAS_DEFAULT_WIDTH, CANVAS_DEFAULT_HEIGHT } from '../../shared/constants';

export interface LayoutSlice {
  project: Project;
  projectHistory: Project[];
  clipboard: Widget[];
  clipboardMode: 'copy' | 'cut';  // cut → paste keeps original ids (a move); copy → new ids

  loadProject: (project: Project) => void;
  setProjectName: (name: string) => void;
  setPageSize: (pageId: string, width: number, height: number) => void;
  setPageLiveOffset: (pageId: string, x: number, y: number) => void;

  addPage: () => void;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;

  setConnection: (conn: Connection) => void;
  setTapTriggerMapping: (mapping: Mapping | null) => void;
  setResetTriggerMapping: (mapping: Mapping | null) => void;

  addWidget: (pageId: string, kind: WidgetKind) => string;
  removeWidget: (pageId: string, widgetId: string) => void;
  updateWidgetRect: (pageId: string, widgetId: string, rect: Partial<Rect>) => void;
  updateWidget: (pageId: string, widgetId: string, patch: Partial<Widget>) => void;
  bringWidgetToFront: (pageId: string, widgetId: string) => void;

  // Per-cell
  setOutputProtocol: (pageId: string, widgetId: string, protocol: OutputProtocol) => void;
  updateCell: (pageId: string, widgetId: string, cellIndex: number, patch: Record<string, unknown>) => void;
  updateWidgetCounts: (pageId: string, widgetId: string, countX: number, countY: number) => void;
  resetCellMappings: (pageId: string, widgetId: string) => void;
  resetCellNames: (pageId: string, widgetId: string) => void;
  resetCellColors: (pageId: string, widgetId: string) => void;

  // Slave links (right-click "link to source") — materialised as router rows.
  linkSlaveCell: (params: {
    slaveWidgetId: string; slaveCellIndex: number;
    sourceWidgetId: string; sourceCellIndex: number;
    routerId: string;
  }) => void;
  unlinkSlaveCell: (slaveWidgetId: string, slaveCellIndex: number) => void;
  applyLinksSnapshot: (links: Record<string, RouterRow[]>) => void;

  // History & clipboard
  captureHistory: () => void;
  undo: () => void;
  copyWidgets: (widgets: Widget[]) => void;
  cutWidgets: (pageId: string, widgetIds: string[]) => void;
  pasteWidgets: (pageId: string) => void;
}

function makeDefaultProject(): Project {
  const pageId = nanoid();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: nanoid(),
    name: 'Untitled Project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connections: [],
    tapTriggerMapping: null,
    resetTriggerMapping: null,
    activePageId: pageId,
    pages: [{
      id: pageId, name: 'Page 1', widgets: [],
      backgroundColor: '#000000',
      width: CANVAS_DEFAULT_WIDTH, height: CANVAS_DEFAULT_HEIGHT,
    }],
  };
}

function touchUpdatedAt(project: Project) {
  project.updatedAt = new Date().toISOString();
}

function getPage(project: Project, pageId: string): Page | undefined {
  return project.pages.find((p) => p.id === pageId);
}

function getWidget(page: Page, widgetId: string): Widget | undefined {
  return page.widgets.find((w) => w.id === widgetId);
}

function maxZIndex(page: Page): number {
  return page.widgets.reduce((max, w) => Math.max(max, w.zIndex), 0);
}

function defaultCellLabel(kind: string, index: number): string {
  const prefix: Record<string, string> = { sliderBank: 'S', buttonGrid: 'B', knobBank: 'K' };
  return `${prefix[kind] ?? ''}${index + 1}`;
}

// Reassign a copied widget's output "message values" to a free block so a copy
// doesn't collide with the original: MIDI CC/note numbers and DMX channels are
// bumped; OSC addresses are left as-is. Mutates the (already-cloned) widget.
function reassignOutputs(widget: Widget, base: number): void {
  let i = 0;
  const bump = (m: Mapping): Mapping => {
    const slot = base + i; i++;
    if (!m) return m;
    if (m.type === 'midi')   return { ...m, number: slot % 128 };
    if (m.type === 'artnet' || m.type === 'sacn' || m.type === 'enttec') return { ...m, channel: (slot % 512) + 1 };
    return m; // osc unchanged
  };
  const w = widget as { kind: string; cells?: { mapping: Mapping }[]; mapping?: Mapping; mappingX?: Mapping; mappingY?: Mapping };
  if (w.kind === 'xyPad') { w.mappingX = bump(w.mappingX ?? null); w.mappingY = bump(w.mappingY ?? null); return; }
  if (Array.isArray(w.cells)) { w.cells = w.cells.map((c) => ({ ...c, mapping: bump(c.mapping) })); return; }
  if ('mapping' in w && w.mapping !== undefined) { w.mapping = bump(w.mapping); }
}

// Remap a copied widget's internal references to other widgets so links follow
// a copy: if a referenced id is part of the copied set (in idMap) it's rewritten
// to the new id; references to widgets outside the copy are left unchanged.
function remapWidgetRefs(widget: Widget, idMap: Record<string, string>): void {
  const map = (id: string | undefined): string => (id && idMap[id]) ? idMap[id] : (id ?? '');
  const w = widget as {
    kind: string;
    rows?: { widgetId?: string; outputs?: { targetWidgetId?: string }[] }[];
    sourceAWidgetId?: string; sourceBWidgetId?: string; sourceWidgetId?: string;
    linkedWidgetIds?: string[];
  };
  if (w.kind === 'router' && Array.isArray(w.rows)) {
    for (const row of w.rows) {
      if (row.widgetId) row.widgetId = map(row.widgetId);
      if (Array.isArray(row.outputs)) for (const out of row.outputs) {
        if (out.targetWidgetId) out.targetWidgetId = map(out.targetWidgetId);
      }
    }
  } else if (w.kind === 'mathWidget') {
    w.sourceAWidgetId = map(w.sourceAWidgetId);
    w.sourceBWidgetId = map(w.sourceBWidgetId);
  } else if (w.kind === 'valueDisplay' || w.kind === 'instance') {
    w.sourceWidgetId = map(w.sourceWidgetId);
  } else if (w.kind === 'submasters' && Array.isArray(w.linkedWidgetIds)) {
    w.linkedWidgetIds = w.linkedWidgetIds.map((id) => map(id));
  }
}

function widgetRankByKind(page: Page, widgetId: string): number {
  const widget = getWidget(page, widgetId);
  if (!widget) return 0;
  return page.widgets.filter((w) => w.kind === widget.kind && w.id <= widgetId).length - 1;
}

export const createLayoutSlice: StateCreator<StoreState, [['zustand/immer', never]], [], LayoutSlice> = (set) => ({
  project: makeDefaultProject(),
  projectHistory: [],
  clipboard: [],
  clipboardMode: 'copy',

  loadProject: (project) => set((s) => {
    s.project = project;
    s.activePageId = project.activePageId;
    s.selectedWidgetId = null;
  }),

  setProjectName: (name) => set((s) => {
    s.project.name = name;
    touchUpdatedAt(s.project);
  }),

  setPageSize: (pageId, width, height) => set((s) => {
    const page = getPage(s.project, pageId);
    if (page) { page.width = width; page.height = height; }
    touchUpdatedAt(s.project);
  }),

  setPageLiveOffset: (pageId, x, y) => set((s) => {
    const page = getPage(s.project, pageId);
    if (page) { page.liveOffsetX = x; page.liveOffsetY = y; }
    touchUpdatedAt(s.project);
  }),

  setConnection: (conn) => set((s) => {
    const idx = s.project.connections.findIndex((c) => c.type === conn.type);
    if (idx === -1) s.project.connections.push(conn);
    else s.project.connections[idx] = conn;
    touchUpdatedAt(s.project);
  }),

  setTapTriggerMapping: (mapping) => set((s) => {
    s.project.tapTriggerMapping = mapping;
    touchUpdatedAt(s.project);
  }),

  setResetTriggerMapping: (mapping) => set((s) => {
    s.project.resetTriggerMapping = mapping;
    touchUpdatedAt(s.project);
  }),

  addPage: () => set((s) => {
    const id = nanoid();
    const src = s.project.pages.find((p) => p.id === s.activePageId);
    const width  = src?.width  ?? CANVAS_DEFAULT_WIDTH;
    const height = src?.height ?? CANVAS_DEFAULT_HEIGHT;
    const bgColor = src?.backgroundColor ?? '#000000';
    s.project.pages.push({ id, name: `Page ${s.project.pages.length + 1}`, widgets: [], backgroundColor: bgColor, width, height });
    s.activePageId = id;
    touchUpdatedAt(s.project);
  }),

  removePage: (pageId) => set((s) => {
    if (s.project.pages.length === 1) return;
    s.project.pages = s.project.pages.filter((p) => p.id !== pageId);
    if (s.activePageId === pageId) s.activePageId = s.project.pages[0].id;
    touchUpdatedAt(s.project);
  }),

  renamePage: (pageId, name) => set((s) => {
    const page = getPage(s.project, pageId);
    if (page) page.name = name;
    touchUpdatedAt(s.project);
  }),

  addWidget: (pageId, kind) => {
    const id = nanoid();
    set((s) => {
      const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
      s.projectHistory.push(snapshot);
      if (s.projectHistory.length > 50) s.projectHistory.shift();
      const page = getPage(s.project, pageId);
      if (!page) return;
      const baseCC = nextFreeCc(page.widgets);
      const widget = makeDefaultWidget(id, kind, maxZIndex(page) + 1, baseCC);
      widget.label = nextUniqueLabel(s.project, kind);
      page.widgets.push(widget as Widget);
      s.selectedWidgetId = id;
      touchUpdatedAt(s.project);
    });
    return id;
  },

  removeWidget: (pageId, widgetId) => set((s) => {
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();
    const page = getPage(s.project, pageId);
    if (!page) return;
    page.widgets = page.widgets.filter((w) => w.id !== widgetId);
    if (s.selectedWidgetId === widgetId) s.selectedWidgetId = null;
    touchUpdatedAt(s.project);
  }),

  updateWidgetRect: (pageId, widgetId, rect) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = page.widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    Object.assign(widget.rect, rect);
    touchUpdatedAt(s.project);
  }),

  updateWidget: (pageId, widgetId, patch) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const idx = page.widgets.findIndex((w) => w.id === widgetId);
    if (idx === -1) return;
    page.widgets[idx] = { ...page.widgets[idx], ...patch } as Widget;
    touchUpdatedAt(s.project);
  }),

  bringWidgetToFront: (pageId, widgetId) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = page.widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    widget.zIndex = maxZIndex(page) + 1;
  }),

  setOutputProtocol: (pageId, widgetId, protocol) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = getWidget(page, widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)
    widget.outputProtocol = protocol;
    const baseCC = nextFreeCc(page.widgets.filter((w) => w.id !== widgetId));
    const rank = widgetRankByKind(page, widgetId);
    (widget.cells as { mapping: unknown }[]).forEach((cell, i) => {
      if (protocol === 'midi') {
        cell.mapping = defaultMidiMapping(i, baseCC);
      } else if (protocol === 'osc') {
        cell.mapping = defaultOscMapping(widget.kind, rank, i);
      } else if (protocol === 'enttec') {
        cell.mapping = { type: 'enttec', channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255 };
      } else if (protocol === 'artnet') {
        cell.mapping = { type: 'artnet', universe: 0, channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255 };
      } else if (protocol === 'sacn') {
        cell.mapping = { type: 'sacn', universe: 1, channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255, priority: 100 };
      }
    });
    touchUpdatedAt(s.project);
  }),

  updateCell: (pageId, widgetId, cellIndex, patch) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = page.widgets.find((w) => w.id === widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)
    const cell = (widget.cells as unknown as Record<string, unknown>[])[cellIndex];
    if (!cell) return;
    Object.assign(cell, patch);
    touchUpdatedAt(s.project);
  }),

  updateWidgetCounts: (pageId, widgetId, countX, countY) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = getWidget(page, widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)

    const newCount = countX * countY;
    const oldCells = (widget as { cells: unknown[] }).cells;
    const baseCC = nextFreeCc(page.widgets.filter((w) => w.id !== widgetId));

    let newCells: unknown[];
    if (widget.kind === 'sliderBank') {
      newCells = makeSliderCells(newCount, baseCC, 'S').map((def, i) =>
        i < oldCells.length ? oldCells[i] : def
      );
    } else if (widget.kind === 'buttonGrid') {
      newCells = makeButtonCells(newCount, baseCC, 'B').map((def, i) =>
        i < oldCells.length ? oldCells[i] : def
      );
    } else {
      newCells = makeKnobCells(newCount, baseCC, 'K').map((def, i) =>
        i < oldCells.length ? oldCells[i] : def
      );
    }

    Object.assign(widget, { countX, countY, cells: newCells });
    touchUpdatedAt(s.project);
  }),

  resetCellMappings: (pageId, widgetId) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = getWidget(page, widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)
    const proto = widget.outputProtocol;
    const baseCC = nextFreeCc(page.widgets.filter((w) => w.id !== widgetId));
    const rank = widgetRankByKind(page, widgetId);
    (widget.cells as { mapping: unknown }[]).forEach((cell, i) => {
      if (proto === 'midi') {
        cell.mapping = defaultMidiMapping(i, baseCC);
      } else if (proto === 'osc') {
        cell.mapping = defaultOscMapping(widget.kind, rank, i);
      } else if (proto === 'enttec') {
        cell.mapping = { type: 'enttec', channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255 };
      } else if (proto === 'artnet') {
        cell.mapping = { type: 'artnet', universe: 0, channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255 };
      } else {
        cell.mapping = { type: 'sacn', universe: 1, channel: (baseCC + i) % 512 + 1, minValue: 0, maxValue: 255, priority: 100 };
      }
    });
    touchUpdatedAt(s.project);
  }),

  resetCellNames: (pageId, widgetId) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = getWidget(page, widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)
    (widget.cells as { label: string }[]).forEach((c, i) => {
      c.label = defaultCellLabel(widget.kind, i);
    });
    touchUpdatedAt(s.project);
  }),

  resetCellColors: (pageId, widgetId) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page) return;
    const widget = getWidget(page, widgetId);
    if (!widget || !('cells' in widget)) return;   // narrows to the cell banks (slider/button/knob)
    (widget.cells as { color?: string }[]).forEach((c) => { delete c.color; });
    touchUpdatedAt(s.project);
  }),

  linkSlaveCell: ({ slaveWidgetId, slaveCellIndex, sourceWidgetId, sourceCellIndex, routerId }) => set((s) => {
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();

    // Drop any existing link targeting this slave cell (across every router),
    // then remove rows left with no outputs — one-row-per-slave-cell model.
    let targetRouter: RouterWidget | undefined;
    for (const page of s.project.pages) {
      for (const w of page.widgets) {
        if (w.kind !== 'router') continue;
        const router = w as RouterWidget;
        for (const row of router.rows) {
          row.outputs = row.outputs.filter(
            (o) => !(o.targetWidgetId === slaveWidgetId && (o.targetCellIndex ?? 0) === slaveCellIndex)
          );
        }
        router.rows = router.rows.filter((r) => r.outputs.length > 0);
        if (router.id === routerId) targetRouter = router;
      }
    }
    if (!targetRouter) return;

    targetRouter.rows.push({
      id: nanoid(),
      inputType: 'widget',
      widgetId: sourceWidgetId,
      cellIndex: sourceCellIndex,
      outputs: [{
        id: nanoid(),
        mapping: null,
        targetWidgetId: slaveWidgetId,
        targetCellIndex: slaveCellIndex,
      }],
    });
    touchUpdatedAt(s.project);
  }),

  // Restore a saved link/routing state (used by Cues). For each router still
  // present, its rows are replaced with the deep-cloned saved rows. Routers not
  // in the snapshot are left untouched. Not history-tracked (live recall).
  applyLinksSnapshot: (links) => set((s) => {
    for (const page of s.project.pages) {
      for (const w of page.widgets) {
        if (w.kind !== 'router') continue;
        const saved = links[w.id];
        if (!saved) continue;
        (w as RouterWidget).rows = JSON.parse(JSON.stringify(saved)) as RouterRow[];
      }
    }
    touchUpdatedAt(s.project);
  }),

  unlinkSlaveCell: (slaveWidgetId, slaveCellIndex) => set((s) => {
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();

    for (const page of s.project.pages) {
      for (const w of page.widgets) {
        if (w.kind !== 'router') continue;
        const router = w as RouterWidget;
        for (const row of router.rows) {
          row.outputs = row.outputs.filter(
            (o) => !(o.targetWidgetId === slaveWidgetId && (o.targetCellIndex ?? 0) === slaveCellIndex)
          );
        }
        router.rows = router.rows.filter((r) => r.outputs.length > 0);
      }
    }
    touchUpdatedAt(s.project);
  }),

  captureHistory: () => set((s) => {
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();
  }),

  undo: () => set((s) => {
    const prev = s.projectHistory.pop();
    if (!prev) return;
    s.project = prev;
    s.activePageId = prev.activePageId;
    s.selectedWidgetId = null;
  }),

  copyWidgets: (widgets) => set((s) => {
    s.clipboard = JSON.parse(JSON.stringify(widgets)) as Widget[];
    s.clipboardMode = 'copy';
  }),

  cutWidgets: (pageId, widgetIds) => set((s) => {
    const page = getPage(s.project, pageId);
    if (!page || widgetIds.length === 0) return;
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();
    // Clone the cut widgets (preserving page order + their ORIGINAL ids) onto the
    // clipboard, then remove them. On paste the same ids are restored, so it's a
    // true move — router links referencing these widgets by id stay intact,
    // even when pasted on a different page.
    const cut = page.widgets.filter((w) => widgetIds.includes(w.id));
    if (cut.length === 0) return;
    s.clipboard = JSON.parse(JSON.stringify(cut)) as Widget[];
    s.clipboardMode = 'cut';
    page.widgets = page.widgets.filter((w) => !widgetIds.includes(w.id));
    s.selectedWidgetId = null;
    s.selectedWidgetIds = [];
    touchUpdatedAt(s.project);
  }),

  pasteWidgets: (pageId) => set((s) => {
    if (s.clipboard.length === 0) return;
    const page = getPage(s.project, pageId);
    if (!page) return;
    const snapshot = JSON.parse(JSON.stringify(s.project)) as Project;
    s.projectHistory.push(snapshot);
    if (s.projectHistory.length > 50) s.projectHistory.shift();

    const isCut = s.clipboardMode === 'cut';
    let z = maxZIndex(page);
    const newIds: string[] = [];

    if (isCut) {
      // Move: keep the original id, label, mappings and position (links follow).
      for (const src of s.clipboard) {
        const w = JSON.parse(JSON.stringify(src)) as Widget;
        w.zIndex = ++z;
        page.widgets.push(w);
        newIds.push(w.id);
      }
      // A cut can be pasted (moved) once; downgrade so a second paste duplicates.
      s.clipboardMode = 'copy';
    } else {
      // Duplicate: fresh ids, unique labels, free CC/DMX blocks. Internal links
      // (references between copied widgets) are remapped so they follow the copy.
      const clones = s.clipboard.map((src) => JSON.parse(JSON.stringify(src)) as Widget);
      const idMap: Record<string, string> = {};
      for (const c of clones) { const nid = nanoid(); idMap[c.id] = nid; c.id = nid; }
      for (const c of clones) {
        c.rect = { ...c.rect, x: c.rect.x + 24, y: c.rect.y + 24 };
        c.zIndex = ++z;
        c.label = nextUniqueLabel(s.project, c.kind);
        reassignOutputs(c, nextFreeCc(page.widgets));
        remapWidgetRefs(c, idMap);
        page.widgets.push(c);
        newIds.push(c.id);
      }
    }

    if (newIds.length === 1) {
      s.selectedWidgetId = newIds[0];
      s.selectedWidgetIds = [];
    } else {
      s.selectedWidgetId = null;
      s.selectedWidgetIds = newIds;
    }
    touchUpdatedAt(s.project);
  }),
});
