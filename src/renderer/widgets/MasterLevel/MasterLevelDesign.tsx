import React from 'react';
import type { MasterLevelWidget } from '../../../shared/types/project';
import { PROTOCOL_LABEL } from './MasterLevelLive';

// Static design-mode preview: a full fader labelled with its target protocol.
export default function MasterLevelDesign({ widget }: { widget: MasterLevelWidget }): React.JSX.Element {
  const { style, protocol } = widget;
  const isVertical = (widget.orientation ?? 'vertical') === 'vertical';
  const color = style.foregroundColor;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 8, boxSizing: 'border-box', gap: 6 }}>
      <div style={{
        flexShrink: 0, textAlign: 'center', fontWeight: 700, letterSpacing: 2,
        fontSize: Math.max(9, (style.fontSize || 16) - 6), color: '#8a8a8a', textTransform: 'uppercase',
      }}>
        {PROTOCOL_LABEL[protocol] ?? protocol} master
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          ...(isVertical ? { bottom: 0, left: 0, right: 0, height: '100%' } : { left: 0, top: 0, bottom: 0, width: '100%' }),
          background: color, opacity: 0.4,
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff', pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}>
          100%
        </div>
      </div>
    </div>
  );
}
