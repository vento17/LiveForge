import React, { useRef, useEffect, useState } from 'react';
import type { ButtonGridWidget } from '../../../shared/types/project';
import { useStore, useWidgetRuntime } from '../../store';
import { dispatchButton } from '../../ipc/dispatch';
import { bridge } from '../../ipc/bridge';
import CellLinkMenu from '../base/CellLinkMenu';
import { useSlavedCells, SLAVE_OUTLINE } from '../base/useSlavedCells';

function apcVelocityToColor(v: number): string {
  if (v === 1) return '#006600';
  if (v === 2) return '#00cc00';
  if (v === 3) return '#660000';
  if (v === 4) return '#cc0000';
  if (v === 5) return '#666600';
  if (v === 6) return '#cccc00';
  const h = Math.round((v / 127) * 270);
  return `hsl(${h}, 100%, 45%)`;
}

const PAGE = 8;

function NavArrow({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 40, height: 34, fontSize: 16, padding: 0,
        background: 'transparent',
        border: `1px solid ${disabled ? 'var(--color-border)' : 'var(--color-border-bright)'}`,
        color: disabled ? 'var(--color-text-dim)' : 'var(--color-text)',
        borderRadius: 2,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function ButtonGridLive({ widget }: { widget: ButtonGridWidget }): React.JSX.Element {
  const { countX, countY, spacingX, spacingY, style, cells } = widget;
  const runtime = useWidgetRuntime(widget.id);
  const { setCellValue, setButtonActive, applyFeedback } = useStore((s) => ({
    setCellValue: s.setCellValue,
    setButtonActive: s.setButtonActive,
    applyFeedback: s.applyFeedback,
  }));

  const widgetRef = useRef(widget);
  useEffect(() => { widgetRef.current = widget; });

  const slavedCells = useSlavedCells(widget.id);
  const [contextMenu, setContextMenu] = useState<{ cellIndex: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [contextMenu]);

  // ─── MIDI feedback from MadMapper (LED colors) ─────────────────────────────
  useEffect(() => bridge.on('tr:midi:inputEvent', (evt) => {
    if (evt.messageType !== 'noteOn' && evt.messageType !== 'noteOff') return;
    const w = widgetRef.current;
    const note = evt.number;
    const ch = evt.channel;
    const vel = evt.value;
    w.cells.forEach((cell, i) => {
      const m = cell?.mapping ?? w.mapping;
      if (!m || m.type !== 'midi') return;
      if ((m.messageType !== 'noteOn' && m.messageType !== 'noteOff') || m.channel !== ch || m.number !== note) return;
      const on = vel > 0;
      applyFeedback(w.id, i, on ? apcVelocityToColor(vel) : null, null);
      setButtonActive(w.id, i, on);
      setCellValue(w.id, i, on ? 1 : 0);
    });
  }), []);

  // ─── Page navigation ───────────────────────────────────────────────────────
  const [pageX, setPageX] = useState(0);
  const [pageY, setPageY] = useState(0);

  const showNav = countX > PAGE || countY > PAGE;
  const maxPageX = Math.max(0, Math.ceil(countX / PAGE) - 1);
  const maxPageY = Math.max(0, Math.ceil(countY / PAGE) - 1);

  useEffect(() => {
    if (pageX > maxPageX) setPageX(maxPageX);
    if (pageY > maxPageY) setPageY(maxPageY);
  }, [maxPageX, maxPageY]);

  const visCols = showNav ? PAGE : countX;
  const visRows = showNav ? PAGE : countY;

  function getActualIndex(visIdx: number): number {
    const r = Math.floor(visIdx / visCols);
    const c = visIdx % visCols;
    const ar = pageY * PAGE + r;
    const ac = pageX * PAGE + c;
    if (ar >= countY || ac >= countX) return -1;
    return ar * countX + ac;
  }

  // ─── Button logic ──────────────────────────────────────────────────────────
  function activate(i: number) {
    const cell = cells[i];
    const rt = runtime?.cells[i];
    const mapping = cell?.mapping ?? widget.mapping;
    const on = cell?.onValue ?? 127;
    const off = cell?.offValue ?? 0;

    if (cell?.behavior === 'toggle') {
      const next = !(rt?.active ?? false);
      setButtonActive(widget.id, i, next);
      setCellValue(widget.id, i, next ? 1 : 0);
      dispatchButton(mapping, next, on, off);
    } else if (cell?.behavior === 'pulse') {
      setButtonActive(widget.id, i, true);
      setCellValue(widget.id, i, 1);
      dispatchButton(mapping, true, on, off);
      setTimeout(() => {
        setButtonActive(widget.id, i, false);
        setCellValue(widget.id, i, 0);
        dispatchButton(mapping, false, on, off);
      }, 100);
    } else if (cell?.behavior === 'radio') {
      cells.forEach((c, idx) => {
        if (c?.behavior === 'radio' && idx !== i) {
          const m = c?.mapping ?? widget.mapping;
          setButtonActive(widget.id, idx, false);
          setCellValue(widget.id, idx, 0);
          dispatchButton(m, false, c?.onValue ?? 127, c?.offValue ?? 0);
        }
      });
      setButtonActive(widget.id, i, true);
      setCellValue(widget.id, i, 1);
      dispatchButton(mapping, true, on, off);
    } else {
      setButtonActive(widget.id, i, true);
      setCellValue(widget.id, i, 1);
      dispatchButton(mapping, true, on, off);
    }
  }

  function deactivate(i: number) {
    const cell = cells[i];
    const behavior = cell?.behavior ?? 'momentary';
    if (behavior === 'toggle' || behavior === 'pulse' || behavior === 'radio') return;
    const mapping = cell?.mapping ?? widget.mapping;
    setButtonActive(widget.id, i, false);
    setCellValue(widget.id, i, 0);
    dispatchButton(mapping, false, cell?.onValue ?? 127, cell?.offValue ?? 0);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const pad = Math.max(spacingX, spacingY);

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}
      onPointerDown={() => setContextMenu(null)}
    >

      {showNav && (
        <div style={{
          height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: `0 ${pad}px`,
          borderBottom: '1px solid var(--color-border)',
        }}>
          <NavArrow onClick={() => setPageX(p => Math.max(0, p - 1))} disabled={pageX === 0}>←</NavArrow>
          <NavArrow onClick={() => setPageY(p => Math.max(0, p - 1))} disabled={pageY === 0}>↑</NavArrow>
          <NavArrow onClick={() => setPageY(p => Math.min(maxPageY, p + 1))} disabled={pageY === maxPageY}>↓</NavArrow>
          <NavArrow onClick={() => setPageX(p => Math.min(maxPageX, p + 1))} disabled={pageX === maxPageX}>→</NavArrow>
          <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 4 }}>
            {pageX + 1}/{maxPageX + 1} · {pageY + 1}/{maxPageY + 1}
          </span>
        </div>
      )}

      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${visCols}, 1fr)`,
        gridTemplateRows: `repeat(${visRows}, 1fr)`,
        columnGap: spacingX,
        rowGap: spacingY,
        padding: pad,
        boxSizing: 'border-box',
      }}>
        {Array.from({ length: visCols * visRows }, (_, visIdx) => {
          const cellIdx = getActualIndex(visIdx);

          if (cellIdx === -1) {
            return (
              <div key={visIdx} style={{
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.06)',
              }} />
            );
          }

          const cell = cells[cellIdx];
          const rt = runtime?.cells[cellIdx];
          const isActive = rt?.active ?? false;
          const color = rt?.feedbackColor ?? cell?.color ?? style.foregroundColor;
          const isSlave = slavedCells.has(cellIdx);

          return (
            <div
              key={visIdx}
              style={{
                background: isActive ? color : 'rgba(0,0,0,0.35)',
                borderRadius: 4,
                border: `2px solid ${color}`,
                outline: isSlave ? SLAVE_OUTLINE : undefined,
                outlineOffset: isSlave ? -2 : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isSlave ? 'context-menu' : 'pointer',
                touchAction: 'none',
                transition: 'background 0.06s',
                userSelect: 'none',
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                if (e.button !== 0) return;   // right-click → context menu only
                // Slaved buttons are driven by the router — locked; right-click → Unlink.
                if (isSlave) return;
                activate(cellIdx);
              }}
              onPointerUp={() => { if (!isSlave) deactivate(cellIdx); }}
              onPointerLeave={() => { if (!isSlave) deactivate(cellIdx); }}
              onPointerCancel={() => { if (!isSlave) deactivate(cellIdx); }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ cellIndex: cellIdx, x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => {
                e.stopPropagation();
                useStore.getState().setHoverInfo(widget.label + ' · ' + (cell?.label ?? ('B' + (cellIdx + 1))));
              }}
            >
              {style.showLabel && (
                <span style={{
                  fontSize: style.fontSize,
                  color: isActive ? style.backgroundColor : (rt?.feedbackLabel ? color : style.labelColor),
                  pointerEvents: 'none',
                }}>
                  {rt?.feedbackLabel ?? cell?.label ?? `B${cellIdx + 1}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <CellLinkMenu
          x={contextMenu.x}
          y={contextMenu.y}
          widgetId={widget.id}
          cellIndex={contextMenu.cellIndex}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
