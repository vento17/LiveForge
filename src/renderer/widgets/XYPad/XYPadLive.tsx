import React, { useRef, useCallback, useState, useEffect } from 'react';
import type { XYPadWidget } from '../../../shared/types/project';
import { useStore, useWidgetRuntime } from '../../store';
import { dispatchValue } from '../../ipc/dispatch';
import { clamp } from '../utils';
import CellLinkMenu from '../base/CellLinkMenu';
import { useSlavedCells, SLAVE_OUTLINE } from '../base/useSlavedCells';

export default function XYPadLive({ widget }: { widget: XYPadWidget }): React.JSX.Element {
  const { style, mappingX, mappingY, showCrosshair, invertX, invertY } = widget;
  const runtime = useWidgetRuntime(widget.id);
  const setCellValue = useStore((s) => s.setCellValue);
  const padRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const slaved = useSlavedCells(widget.id);       // 0 = X axis, 1 = Y axis
  const slavedRef = useRef(slaved); slavedRef.current = slaved;
  const isSlaved = slaved.has(0) || slaved.has(1);

  // Right-click: pick which axis to link, then show the link menu for that cell.
  const [menu, setMenu] = useState<{ x: number; y: number; axis: 0 | 1 | null } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [menu]);

  const xVal = runtime?.cells[0]?.value ?? 0.5;
  const yVal = runtime?.cells[1]?.value ?? 0.5;
  const xColor = runtime?.cells[0]?.feedbackColor ?? style.foregroundColor;

  const updateFromPoint = useCallback((clientX: number, clientY: number) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    let nx = clamp((clientX - rect.left) / rect.width, 0, 1);
    let ny = clamp((clientY - rect.top) / rect.height, 0, 1);
    if (invertX) nx = 1 - nx;
    if (!invertY) ny = 1 - ny;

    // A slaved axis is driven by the router — leave it untouched (right-click → Unlink).
    if (!slavedRef.current.has(0)) { setCellValue(widget.id, 0, nx); dispatchValue(mappingX, nx); }
    if (!slavedRef.current.has(1)) { setCellValue(widget.id, 1, ny); dispatchValue(mappingY, ny); }
  }, [widget.id, mappingX, mappingY, invertX, invertY, setCellValue]);

  return (
    <div
      ref={padRef}
      style={{
        width: '100%', height: '100%',
        position: 'relative',
        touchAction: 'none',
        cursor: 'crosshair',
        overflow: 'hidden',
        outline: isSlaved ? SLAVE_OUTLINE : undefined,
        outlineOffset: isSlaved ? -2 : undefined,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, axis: null });
      }}
      onPointerDown={(e) => {
        setMenu(null);
        if (e.button !== 0) return;   // right-click → context menu only
        if (activePointer.current !== null) return;
        activePointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== activePointer.current) return;
        updateFromPoint(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === activePointer.current) activePointer.current = null;
      }}
      onPointerCancel={(e) => {
        if (e.pointerId === activePointer.current) activePointer.current = null;
      }}
    >
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${style.foregroundColor}18 1px, transparent 1px), linear-gradient(90deg, ${style.foregroundColor}18 1px, transparent 1px)`,
        backgroundSize: '20% 20%',
        pointerEvents: 'none',
      }} />

      {/* Crosshair lines */}
      {showCrosshair && (
        <>
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: `${(1 - yVal) * 100}%`, height: 1,
            background: `${xColor}44`, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${xVal * 100}%`, width: 1,
            background: `${xColor}44`, pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Dot */}
      <div style={{
        position: 'absolute',
        left: `${xVal * 100}%`,
        top: `${(1 - yVal) * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 20, height: 20,
        borderRadius: '50%',
        background: xColor,
        boxShadow: `0 0 12px ${xColor}`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {style.showLabel && (
        <div style={{
          position: 'absolute', bottom: 6, left: 0, right: 0,
          textAlign: 'center', fontSize: style.fontSize,
          color: style.labelColor, opacity: 0.6, pointerEvents: 'none',
        }}>
          {widget.label}
        </div>
      )}

      {/* Right-click: axis picker → link menu */}
      {menu && menu.axis === null && (
        <div
          style={{
            position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999,
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
            padding: '4px 0', minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            fontFamily: 'monospace',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '4px 12px', color: '#777', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            link axis
          </div>
          {([['X axis', 0], ['Y axis', 1]] as [string, 0 | 1][]).map(([label, axis]) => (
            <button
              key={axis}
              style={{
                display: 'block', width: '100%', padding: '5px 12px', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: 11,
                color: slaved.has(axis) ? '#ff6666' : '#ccc', textAlign: 'left', fontFamily: 'inherit',
              }}
              onClick={() => setMenu({ ...menu, axis })}
            >
              {label}{slaved.has(axis) ? ' · slaved' : ''}
            </button>
          ))}
        </div>
      )}
      {menu && menu.axis !== null && (
        <CellLinkMenu
          x={menu.x}
          y={menu.y}
          widgetId={widget.id}
          cellIndex={menu.axis}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
