import React from 'react';
import type { CuesWidget } from '../../../shared/types/project';

export default function CuesDesign({ widget }: { widget: CuesWidget }): React.JSX.Element {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #252525', fontSize: 10, fontWeight: 600, color: '#606060', letterSpacing: '0.08em', flexShrink: 0 }}>
        CUES
      </div>
      <div style={{ flex: 1, overflowY: 'hidden', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {widget.cues.length === 0 && (
          <div style={{ fontSize: 10, color: '#333', textAlign: 'center', paddingTop: 8 }}>No cues saved</div>
        )}
        {widget.cues.slice(0, 8).map((cue) => (
          <div key={cue.id} style={{ height: 22, borderRadius: 2, background: cue.bgColor, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
            <span style={{ fontSize: 10, color: '#999', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{cue.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
