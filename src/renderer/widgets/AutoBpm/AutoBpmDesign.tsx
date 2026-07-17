import React from 'react';
import type { AutoBpmWidget } from '../../../shared/types/project';
import { BEAT_DIVISORS } from '../../../shared/types/project';

export default function AutoBpmDesign({ widget }: { widget: AutoBpmWidget }): React.JSX.Element {
  const color = widget.style.foregroundColor;

  return (
    <div style={{
      width: '100%', height: '100%', padding: '6px 8px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      gap: 3, fontFamily: 'monospace', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 2,
        color: '#505050', textTransform: 'uppercase', marginBottom: 2, flexShrink: 0,
      }}>
        ◈ bpm clock
      </div>

      {BEAT_DIVISORS.map((D) => (
        <div key={D} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minHeight: 0 }}>
          <span style={{ fontSize: 9, color: '#404040', width: 22, textAlign: 'right', flexShrink: 0 }}>
            x{D}
          </span>
          <div style={{
            flex: 1, height: 4, maxHeight: 10, alignSelf: 'center',
            background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{ width: '40%', height: '100%', background: color + '35', borderRadius: 2 }} />
          </div>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: color + '20',
          }} />
        </div>
      ))}
    </div>
  );
}
