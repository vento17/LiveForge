import React from 'react';
import type { SoundPlayerWidget } from '../../../shared/types/project';

export default function SoundPlayerDesign({ widget }: { widget: SoundPlayerWidget }): React.JSX.Element {
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
        ◈ sound player
      </div>

      {widget.tracks.length === 0 ? (
        <div style={{ fontSize: 10, color: '#303030', fontStyle: 'italic', marginTop: 4 }}>
          no tracks — add in inspector
        </div>
      ) : widget.tracks.map((track, i) => (
        <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minHeight: 0 }}>
          <span style={{ fontSize: 9, color: '#404040', width: 16, textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{ fontSize: 9, color: color + '80', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track.label || track.fileName || '—'}
          </span>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color + '15', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
