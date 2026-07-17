import React from 'react';
import type { InstanceWidget } from '../../../shared/types/project';
import { useStore } from '../../store';

export default function InstanceDesign({ widget }: { widget: InstanceWidget }): React.JSX.Element {
  const sourceLabel = useStore((s) => {
    for (const p of s.project.pages) {
      const w = p.widgets.find((x) => x.id === widget.sourceWidgetId);
      if (w) return `${w.label} · ${w.kind}`;
    }
    return null;
  });

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      border: '1px dashed #3a3a3a', borderRadius: 4, boxSizing: 'border-box',
      color: '#777', fontFamily: 'monospace', textAlign: 'center', padding: 8,
    }}>
      <div style={{ fontSize: 18 }}>⧉</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888' }}>INSTANCE</div>
      <div style={{ fontSize: 11, color: sourceLabel ? '#9ab' : '#555' }}>
        {sourceLabel ? `→ ${sourceLabel}` : 'no source — set in inspector'}
      </div>
    </div>
  );
}
