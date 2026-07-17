import React from 'react';
import type { LfoWidget } from '../../../shared/types/project';

export default function LfoWidgetDesign({ widget }: { widget: LfoWidget }): React.JSX.Element {
  const color = widget.style.foregroundColor;
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'monospace', padding: 8, boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
        ◈ lfo
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28, color }}>{waveformIcon(widget.waveform)}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color, fontWeight: 600 }}>{widget.waveform}</span>
          <span style={{ fontSize: 9, color: '#555' }}>
            {widget.rateMode === 'bpm' ? `×${widget.rateMultiplier} beats` : `${widget.rateHz} Hz`}
          </span>
        </div>
      </div>
    </div>
  );
}

function waveformIcon(wf: string): string {
  switch (wf) {
    case 'sine':     return '∿';
    case 'square':   return '⊓';
    case 'saw':      return '⊿';
    case 'triangle': return '△';
    case 'random':   return '⌇';
    default:         return '∿';
  }
}
