import React from 'react';
import type { AudioAnalyserWidget } from '../../../shared/types/project';

const CELLS = [
  { label: 'KICK',  kind: 'trig' },
  { label: 'SNARE', kind: 'trig' },
  { label: 'BASS',  kind: 'band' },
  { label: 'MID',   kind: 'band' },
  { label: 'HIGH',  kind: 'band' },
] as const;

export default function AudioAnalyserDesign({ widget }: { widget: AudioAnalyserWidget }): React.JSX.Element {
  const color = widget.style.foregroundColor;

  return (
    <div style={{
      width: '100%', height: '100%', padding: '6px 8px',
      boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      gap: 4, fontFamily: 'monospace', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 2,
        color: '#505050', textTransform: 'uppercase', marginBottom: 2, flexShrink: 0,
      }}>
        ◈ audio analyser
      </div>

      {CELLS.map(({ label, kind }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minHeight: 0 }}>
          <span style={{ fontSize: 9, color: '#404040', width: 38, flexShrink: 0 }}>{label}</span>
          {kind === 'trig' ? (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color + '20', flexShrink: 0 }} />
          ) : (
            <div style={{
              flex: 1, height: 5, background: 'rgba(255,255,255,0.04)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{ width: '30%', height: '100%', background: color + '30', borderRadius: 2 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
