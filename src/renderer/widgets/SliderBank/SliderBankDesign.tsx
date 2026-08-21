import React from 'react';
import type { SliderBankWidget } from '../../../shared/types/project';

export default function SliderBankDesign({ widget }: { widget: SliderBankWidget }): React.JSX.Element {
  const { countX, countY, spacingX, spacingY, orientation, style, cells } = widget;
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
        const cellColor = cell?.color ?? style.foregroundColor;
        const isVertical = (orientation ?? 'vertical') === 'vertical';
        return (
          <div key={i} style={{
            position: 'relative',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
          }}>
            <div style={{
              position: 'absolute',
              ...(isVertical
                ? { bottom: 0, left: 0, right: 0, height: '50%' }
                : { left: 0, top: 0, bottom: 0, width: '50%' }),
              background: cellColor,
              opacity: 0.4,
            }} />
            <div style={{
              position: 'absolute',
              ...(isVertical
                ? { bottom: 'calc(50% - 6px)', left: '15%', right: '15%', height: 12 }
                : { left: 'calc(50% - 6px)', top: '15%', bottom: '15%', width: 12 }),
              background: cellColor,
              borderRadius: 3,
              zIndex: 1,
            }} />
            {style.showLabel && (
              <div style={{
                position: 'absolute', bottom: 4, left: 0, right: 0,
                textAlign: 'center', fontSize: style.fontSize - 2,
                color: style.labelColor, opacity: 0.9, zIndex: 2,
              }}>
                {cell?.label ?? `S${i + 1}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
