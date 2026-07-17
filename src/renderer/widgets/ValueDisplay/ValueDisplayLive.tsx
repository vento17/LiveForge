import React from 'react';
import type { ValueDisplayWidget } from '../../../shared/types/project';
import { useStore } from '../../store';

function formatValue(v: number, fmt: string, decimals: number): string {
  switch (fmt) {
    case 'percent': return `${(v * 100).toFixed(Math.max(0, decimals - 2))}%`;
    case 'midi':    return String(Math.round(v * 127));
    default:        return v.toFixed(decimals);
  }
}

export default function ValueDisplayLive({ widget }: { widget: ValueDisplayWidget }): React.JSX.Element {
  const value = useStore((s) =>
    s.runtime.widgets[widget.sourceWidgetId]?.cells[widget.sourceCellIndex]?.value ?? 0
  );

  const color = widget.style.foregroundColor;
  const fs    = widget.style.fontSize;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '4px 8px',
      boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden',
    }}>
      {widget.style.showLabel && (
        <span style={{ fontSize: 9, color: widget.style.labelColor, marginBottom: 4, alignSelf: 'flex-start', letterSpacing: 1 }}>
          {widget.label}
        </span>
      )}
      <span style={{
        fontSize: fs,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.04em',
      }}>
        {formatValue(value, widget.displayFormat, widget.decimals)}
      </span>
      <div style={{ width: '80%', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', background: color, opacity: 0.6 }} />
      </div>
    </div>
  );
}
