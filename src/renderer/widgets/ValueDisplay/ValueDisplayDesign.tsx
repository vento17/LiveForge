import React from 'react';
import type { ValueDisplayWidget } from '../../../shared/types/project';

export default function ValueDisplayDesign({ widget }: { widget: ValueDisplayWidget }): React.JSX.Element {
  const color = widget.style.foregroundColor;
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 8,
      boxSizing: 'border-box', fontFamily: 'monospace',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 4 }}>
        ◈ display
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {formatValue(0, widget.displayFormat, widget.decimals)}
      </span>
      <span style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
        {widget.displayFormat}
      </span>
    </div>
  );
}

function formatValue(v: number, fmt: string, decimals: number): string {
  switch (fmt) {
    case 'percent': return `${(v * 100).toFixed(Math.max(0, decimals - 2))}%`;
    case 'midi':    return String(Math.round(v * 127));
    default:        return v.toFixed(decimals);
  }
}
