import React from 'react';
import type { ButtonGridWidget } from '../../../shared/types/project';
import { BEHAVIOR_BADGE } from './behavior';

export default function ButtonGridDesign({ widget }: { widget: ButtonGridWidget }): React.JSX.Element {
  const { countX, countY, spacingX, spacingY, style, cells } = widget;
  const count = countX * countY;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `repeat(${countX}, 1fr)`,
      gridTemplateRows: `repeat(${countY}, 1fr)`,
      columnGap: spacingX,
      rowGap: spacingY,
      padding: Math.max(spacingX, spacingY),
      boxSizing: 'border-box',
    }}>
      {Array.from({ length: count }, (_, i) => {
        const cell = cells[i];
        return (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
            border: `1px solid ${(cell?.color ?? style.foregroundColor)}33`,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {style.showLabel && (
              <span style={{ fontSize: style.fontSize - 1, color: style.labelColor, opacity: 0.8 }}>
                {cell?.label ?? `B${i + 1}`}
              </span>
            )}
            <span style={{
              position: 'absolute', left: 3, bottom: 1,
              fontSize: Math.max(8, Math.round((style.fontSize ?? 12) * 0.62)),
              lineHeight: 1, fontWeight: 700, fontFamily: 'monospace',
              color: cell?.color ?? style.foregroundColor, opacity: 0.55,
            }}>
              {BEHAVIOR_BADGE[cell?.behavior ?? 'momentary']}
            </span>
          </div>
        );
      })}
    </div>
  );
}
