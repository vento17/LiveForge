import React, { useEffect, useRef } from 'react';
import type { MathWidget, MathOperation } from '../../../shared/types/project';
import { useStore } from '../../store';
import { dispatchValue } from '../../ipc/dispatch';
import { remapRange } from '../base/range';

function applyOp(a: number, b: number, op: MathOperation): number {
  switch (op) {
    case 'add':      return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'min':      return Math.min(a, b);
    case 'max':      return Math.max(a, b);
    case 'avg':      return (a + b) / 2;
    case 'invert':   return 1 - a;
    case 'abs':      return Math.abs(a);
  }
}

export default function MathWidgetLive({ widget }: { widget: MathWidget }): React.JSX.Element {
  const widgetRef = useRef(widget);
  widgetRef.current = widget;

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      const w = widgetRef.current;
      const a = state.runtime.widgets[w.sourceAWidgetId]?.cells[w.sourceACellIndex]?.value ?? 0;
      const b = state.runtime.widgets[w.sourceBWidgetId]?.cells[w.sourceBCellIndex]?.value ?? 0;
      let result = remapRange(applyOp(a, b, w.operation), w);
      if (w.clampOutput) result = Math.max(0, Math.min(1, result));

      const current = state.runtime.widgets[w.id]?.cells[0]?.value;
      if (current === result) return;

      useStore.getState().setCellValue(w.id, 0, result);
      if (w.mapping) dispatchValue(w.mapping, result);
    });
    return unsubscribe;
  }, [widget.id]);

  const color  = widget.style.foregroundColor;
  const result = useStore((s) => s.runtime.widgets[widget.id]?.cells[0]?.value ?? 0);
  const a      = useStore((s) => s.runtime.widgets[widget.sourceAWidgetId]?.cells[widget.sourceACellIndex]?.value ?? 0);
  const b      = useStore((s) => s.runtime.widgets[widget.sourceBWidgetId]?.cells[widget.sourceBCellIndex]?.value ?? 0);
  const usesB  = ['add', 'subtract', 'multiply', 'min', 'max', 'avg'].includes(widget.operation);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '6px 8px', boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase', marginBottom: 4 }}>
        ◈ math
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <SourceRow label="A" value={a} color={color} />
        {usesB && <SourceRow label="B" value={b} color={color} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: '#555', width: 14 }}>={opSymbol(widget.operation)}</span>
          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(1, result)) * 100}%`, height: '100%', background: color }} />
          </div>
          <span style={{ fontSize: 9, color, fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}>
            {result.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: '#444', width: 14 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: color, opacity: 0.5 }} />
      </div>
      <span style={{ fontSize: 9, color: '#555', fontVariantNumeric: 'tabular-nums', width: 32, textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function opSymbol(op: string): string {
  switch (op) {
    case 'add':      return '+';
    case 'subtract': return '−';
    case 'multiply': return '×';
    case 'min':      return 'min';
    case 'max':      return 'max';
    case 'avg':      return 'avg';
    case 'invert':   return '1−A';
    case 'abs':      return '|A|';
    default:         return '?';
  }
}
