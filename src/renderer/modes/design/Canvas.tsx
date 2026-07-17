import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useStore, useActivePage } from '../../store';
import { GRID_SNAP_PX } from '../../../shared/constants';
import WidgetPicker from './WidgetPicker';
import WidgetPreview from '../../widgets/base/WidgetPreview';
import CellEditModal from '../../widgets/base/CellEditModal';

export default function Canvas(): React.JSX.Element {
  const page = useActivePage();
  const {
    selectedWidgetId, setSelectedWidgetId,
    selectedWidgetIds, toggleWidgetSelection, clearMultiSelection,
    isWidgetPickerOpen,
    updateWidgetRect, bringWidgetToFront, removeWidget, activePageId,
    captureHistory, undo, copyWidgets, cutWidgets, pasteWidgets,
  } = useStore((s) => ({
    selectedWidgetId:      s.selectedWidgetId,
    setSelectedWidgetId:   s.setSelectedWidgetId,
    selectedWidgetIds:     s.selectedWidgetIds,
    toggleWidgetSelection: s.toggleWidgetSelection,
    clearMultiSelection:   s.clearMultiSelection,
    isWidgetPickerOpen:    s.isWidgetPickerOpen,
    updateWidgetRect:      s.updateWidgetRect,
    bringWidgetToFront:    s.bringWidgetToFront,
    removeWidget:          s.removeWidget,
    activePageId:          s.activePageId,
    captureHistory:        s.captureHistory,
    undo:                  s.undo,
    copyWidgets:           s.copyWidgets,
    cutWidgets:            s.cutWidgets,
    pasteWidgets:          s.pasteWidgets,
  }));

  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  // Track shift key as state so Rnd re-renders with disableDragging
  const [shiftHeld, setShiftHeld] = useState(false);

  // Tracks start positions of all multi-selected widgets at drag start
  const multiDragStartPositions = useRef<Record<string, { x: number; y: number }>>({});
  // Snapshot for group resize: origin + each selected widget's rect + dragged base size
  const multiResizeStart = useRef<{
    origin: { x: number; y: number };
    rects: Record<string, { x: number; y: number; width: number; height: number }>;
    base: { w: number; h: number };
  } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const computeScale = useCallback(() => {
    if (!outerRef.current || !page) return;
    const { width, height } = outerRef.current.getBoundingClientRect();
    const padding = 32;
    const sx = (width  - padding) / page.width;
    const sy = (height - padding) / page.height;
    setScale(Math.min(sx, sy, 1));
  }, [page?.width, page?.height]);

  useEffect(() => {
    computeScale();
    const ro = new ResizeObserver(computeScale);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, [computeScale]);

  const pageWidth  = page?.width  ?? 1920;
  const pageHeight = page?.height ?? 1080;

  const allSelectedIds = selectedWidgetId
    ? [selectedWidgetId]
    : selectedWidgetIds;

  return (
    <div
      ref={outerRef}
      style={styles.outer}
      onClick={(e) => {
        if (e.shiftKey) return;
        setSelectedWidgetId(null);
        clearMultiSelection();
      }}
      onDoubleClick={() => useStore.getState().openWidgetPicker()}
      onKeyDown={(e) => {
        if (editingWidgetId) return;
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
        if (tag === 'input' || tag === 'textarea') return;
        if ((e.key === 'Delete' || e.key === 'Backspace')) {
          if (allSelectedIds.length > 0 && activePageId) {
            captureHistory();
            allSelectedIds.forEach((id) => removeWidget(activePageId, id));
            setSelectedWidgetId(null);
            clearMultiSelection();
          }
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'z') {
            undo();
            e.preventDefault();
          } else if (e.key === 'c' && allSelectedIds.length > 0) {
            const ws = (page?.widgets ?? []).filter((w) => allSelectedIds.includes(w.id));
            if (ws.length > 0) copyWidgets(ws);
            e.preventDefault();
          } else if (e.key === 'x' && allSelectedIds.length > 0 && activePageId) {
            cutWidgets(activePageId, allSelectedIds);
            e.preventDefault();
          } else if (e.key === 'v' && activePageId) {
            pasteWidgets(activePageId);
            e.preventDefault();
          }
        }
      }}
      tabIndex={0}
    >
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: pageWidth * scale,
        height: pageHeight * scale,
        transform: 'translate(-50%, -50%)',
      }}>
        <div style={{
          width: pageWidth,
          height: pageHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          background: page?.backgroundColor ?? '#000000',
          boxShadow: '0 0 0 1px var(--color-border), 0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {/* Cross grid */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><line x1="12" y1="9" x2="12" y2="15" stroke="#1d1d1d" stroke-width="1"/><line x1="9" y1="12" x2="15" y2="12" stroke="#1d1d1d" stroke-width="1"/></svg>')}")`,
            backgroundSize: '24px 24px',
          }} />

          {page?.widgets
            .slice()
            .sort((a, b) => {
              const layerOrder = { under: 0, normal: 1, over: 2 } as Record<string, number>;
              const la = (a.kind === 'imageWidget' || a.kind === 'textWidget') ? layerOrder[a.layer] : 1;
              const lb = (b.kind === 'imageWidget' || b.kind === 'textWidget') ? layerOrder[b.layer] : 1;
              return la !== lb ? la - lb : a.zIndex - b.zIndex;
            })
            .map((widget) => {
              const isSingleSelected = widget.id === selectedWidgetId;
              const isMultiSelected  = selectedWidgetIds.includes(widget.id);

              return (
                <Rnd
                  key={widget.id}
                  position={{ x: widget.rect.x, y: widget.rect.y }}
                  size={{ width: widget.rect.width, height: widget.rect.height }}
                  scale={scale}
                  dragGrid={[GRID_SNAP_PX, GRID_SNAP_PX]}
                  resizeGrid={[GRID_SNAP_PX, GRID_SNAP_PX]}
                  minWidth={80}
                  minHeight={60}
                  bounds="parent"
                  disableDragging={shiftHeld}
                  onDragStart={() => {
                    captureHistory();
                    if (!isSingleSelected && !isMultiSelected) {
                      setSelectedWidgetId(widget.id);
                      clearMultiSelection();
                    }
                    if (activePageId) bringWidgetToFront(activePageId, widget.id);
                    // Snapshot all selected widget positions for group move
                    const currentIds = useStore.getState().selectedWidgetIds;
                    const ids = currentIds.includes(widget.id) ? currentIds : [widget.id];
                    const snap: Record<string, { x: number; y: number }> = {};
                    page?.widgets.forEach((w) => {
                      if (ids.includes(w.id)) snap[w.id] = { x: w.rect.x, y: w.rect.y };
                    });
                    multiDragStartPositions.current = snap;
                  }}
                  onResizeStart={() => {
                    captureHistory();
                    const liveIds = useStore.getState().selectedWidgetIds;
                    if (liveIds.includes(widget.id) && liveIds.length > 1) {
                      // Group resize — snapshot all selected rects + group origin
                      const rects: Record<string, { x: number; y: number; width: number; height: number }> = {};
                      let ox = Infinity, oy = Infinity;
                      page?.widgets.forEach((w) => {
                        if (liveIds.includes(w.id)) {
                          rects[w.id] = { ...w.rect };
                          ox = Math.min(ox, w.rect.x);
                          oy = Math.min(oy, w.rect.y);
                        }
                      });
                      multiResizeStart.current = { origin: { x: ox, y: oy }, rects, base: { w: widget.rect.width, h: widget.rect.height } };
                    } else {
                      multiResizeStart.current = null;
                      setSelectedWidgetId(widget.id);
                      clearMultiSelection();
                    }
                  }}
                  onDragStop={(_e, d) => {
                    if (!activePageId) return;
                    const liveIds = useStore.getState().selectedWidgetIds;
                    const isCurrentMulti = liveIds.includes(widget.id);
                    if (isCurrentMulti && liveIds.length > 1) {
                      const origPos = multiDragStartPositions.current[widget.id];
                      if (origPos) {
                        const dx = Math.round((d.x - origPos.x) / GRID_SNAP_PX) * GRID_SNAP_PX;
                        const dy = Math.round((d.y - origPos.y) / GRID_SNAP_PX) * GRID_SNAP_PX;
                        liveIds.forEach((id) => {
                          const startPos = multiDragStartPositions.current[id];
                          if (startPos) {
                            updateWidgetRect(activePageId, id, {
                              x: Math.max(0, startPos.x + dx),
                              y: Math.max(0, startPos.y + dy),
                            });
                          }
                        });
                      }
                    } else {
                      updateWidgetRect(activePageId, widget.id, { x: d.x, y: d.y });
                    }
                  }}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => {
                    if (!activePageId) return;
                    const grp = multiResizeStart.current;
                    if (grp) {
                      // Scale every selected widget by the dragged widget's ratio,
                      // keeping their relative layout around the group's top-left.
                      const rx = ref.offsetWidth  / grp.base.w;
                      const ry = ref.offsetHeight / grp.base.h;
                      for (const [id, r] of Object.entries(grp.rects)) {
                        updateWidgetRect(activePageId, id, {
                          x: Math.max(0, Math.round(grp.origin.x + (r.x - grp.origin.x) * rx)),
                          y: Math.max(0, Math.round(grp.origin.y + (r.y - grp.origin.y) * ry)),
                          width:  Math.max(40, Math.round(r.width  * rx)),
                          height: Math.max(30, Math.round(r.height * ry)),
                        });
                      }
                      multiResizeStart.current = null;
                    } else {
                      updateWidgetRect(activePageId, widget.id, {
                        x: pos.x, y: pos.y,
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                      });
                    }
                  }}
                  style={{
                    outline: isSingleSelected
                      ? '2px solid var(--color-accent)'
                      : isMultiSelected
                        ? '2px solid #64c8ff'
                        : '1px solid rgba(255,255,255,0.5)',
                    borderRadius: widget.style.borderRadius,
                  }}
                >
                  <div
                    style={{ width: '100%', height: '100%', position: 'relative' }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        // Include previously single-selected widget in multi-select.
                        // NOTE: don't call setSelectedWidgetId(null) here — that action
                        // also clears selectedWidgetIds, wiping the multi-selection.
                        // toggleWidgetSelection already nulls the single selection.
                        const prevSingle = useStore.getState().selectedWidgetId;
                        if (prevSingle && prevSingle !== widget.id) {
                          toggleWidgetSelection(prevSingle);
                        }
                        toggleWidgetSelection(widget.id);
                      } else {
                        setSelectedWidgetId(widget.id);
                        clearMultiSelection();
                      }
                    }}
                  >
                    <WidgetPreview widget={widget} />
                    {isSingleSelected && (widget.kind === 'sliderBank' || widget.kind === 'buttonGrid' || widget.kind === 'knobBank') && (
                      <button
                        style={styles.editBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWidgetId(widget.id);
                        }}
                      >
                        ✏ Cells
                      </button>
                    )}
                    {isMultiSelected && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(100,200,255,0.05)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                </Rnd>
              );
            })}
        </div>
      </div>

      <div style={styles.scaleHint}>
        {pageWidth}×{pageHeight} — {Math.round(scale * 100)}%
        {selectedWidgetIds.length > 1 && (
          <span style={{ marginLeft: 8, color: '#64c8ff' }}>{selectedWidgetIds.length} selected</span>
        )}
      </div>

      {isWidgetPickerOpen && <WidgetPicker />}
      {editingWidgetId && activePageId && (
        <CellEditModal
          widgetId={editingWidgetId}
          pageId={activePageId}
          onClose={() => setEditingWidgetId(null)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    flex: 1, position: 'relative', overflow: 'hidden', outline: 'none',
    background: 'var(--color-bg)',
  },
  editBtn: {
    position: 'absolute', top: 4, right: 4,
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid var(--color-accent)',
    color: 'var(--color-accent)',
    borderRadius: 4, padding: '2px 7px',
    fontSize: 11, cursor: 'pointer', zIndex: 10,
  },
  scaleHint: {
    position: 'absolute', bottom: 8, right: 10,
    fontSize: 10, color: 'var(--color-text-dim)',
    pointerEvents: 'none',
  },
};
