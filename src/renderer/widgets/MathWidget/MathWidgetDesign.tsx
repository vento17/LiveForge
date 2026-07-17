import React from 'react';
import type { MathWidget } from '../../../shared/types/project';

export default function MathWidgetDesign({ widget }: { widget: MathWidget }): React.JSX.Element {
  const color = widget.style.foregroundColor;
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: 8, boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase', marginBottom: 6 }}>
        ◈ math
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{ fontSize: 11, color: '#555' }}>A</span>
        <span style={{ fontSize: 18, color, fontWeight: 700 }}>{opSymbol(widget.operation)}</span>
        <span style={{ fontSize: 11, color: '#555' }}>{needsB(widget.operation) ? 'B' : ''}</span>
      </div>
      <div style={{ fontSize: 9, color: '#444' }}>
        {widget.operation} · ×{widget.scale} +{widget.offset}
      </div>
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

function needsB(op: string): boolean {
  return ['add', 'subtract', 'multiply', 'min', 'max', 'avg'].includes(op);
}
