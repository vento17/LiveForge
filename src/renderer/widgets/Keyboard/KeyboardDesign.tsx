import React from 'react';
import type { KeyboardWidget } from '../../../shared/types/project';
import { BEHAVIOR_BADGE } from '../ButtonGrid/behavior';
import { keyCapLabel } from './keyNames';

export default function KeyboardDesign({ widget }: { widget: KeyboardWidget }): React.JSX.Element {
  const { keys, countX, spacingX, spacingY, style } = widget;

  if (keys.length === 0) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#555', fontFamily: 'monospace',
        fontSize: 12, textAlign: 'center', padding: 12, boxSizing: 'border-box',
      }}>
        ⌨ keyboard — add keys in the Inspector
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(1, countX)}, 1fr)`,
      gridAutoRows: '1fr',
      columnGap: spacingX,
      rowGap: spacingY,
      padding: Math.max(spacingX, spacingY),
      boxSizing: 'border-box',
    }}>
      {keys.map((k) => (
        <div key={k.id} style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          border: `1px solid ${(k.color ?? style.foregroundColor)}33`,
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: 0, overflow: 'hidden',
        }}>
          <span style={{
            fontSize: style.fontSize, fontWeight: 700, fontFamily: 'monospace',
            color: k.color ?? style.foregroundColor, opacity: 0.85, lineHeight: 1.1,
          }}>
            {keyCapLabel(k.code)}
          </span>
          {style.showLabel && k.label && k.label !== keyCapLabel(k.code) && (
            <span style={{
              fontSize: Math.max(8, (style.fontSize ?? 12) * 0.72),
              color: style.labelColor, opacity: 0.8, marginTop: 2,
              maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {k.label}
            </span>
          )}
          <span style={{
            position: 'absolute', left: 3, bottom: 1,
            fontSize: Math.max(8, Math.round((style.fontSize ?? 12) * 0.62)),
            lineHeight: 1, fontWeight: 700, fontFamily: 'monospace',
            color: k.color ?? style.foregroundColor, opacity: 0.55,
          }}>
            {BEHAVIOR_BADGE[k.behavior ?? 'momentary']}
          </span>
        </div>
      ))}
    </div>
  );
}
