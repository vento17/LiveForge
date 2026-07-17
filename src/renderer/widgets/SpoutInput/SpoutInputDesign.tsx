import React from 'react';
import type { SpoutInputWidget } from '../../../shared/types/project';

export default function SpoutInputDesign({ widget }: { widget: SpoutInputWidget }): React.JSX.Element {
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
        <circle cx="12" cy="10" r="3" />
        <path d="M7 10a5 5 0 0 1 10 0" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>Spout</span>
      <span style={{ fontSize: 10 }}>{widget.senderName || 'no sender set'}</span>
    </div>
  );
}
