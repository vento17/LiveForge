import React from 'react';
import type { NdiInputWidget } from '../../../shared/types/project';

export default function NdiInputDesign({ widget }: { widget: NdiInputWidget }): React.JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 6,
      color: 'var(--color-text-dim)',
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M2 8h4M18 8h4M12 3V1" />
        <circle cx="12" cy="10" r="2" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>NDI Input</span>
      <span style={{ fontSize: 10 }}>{widget.sourceName || 'no source set'}</span>
    </div>
  );
}
