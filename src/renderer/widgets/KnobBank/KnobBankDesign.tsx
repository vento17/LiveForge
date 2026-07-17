import React from 'react';
import type { KnobBankWidget } from '../../../shared/types/project';

const VB = 60;
const CX = 30, CY = 30, R = 21, TRACK_R = 26, STROKE = 5.5, DOT_R = 3.8;

function describeArc(startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d - 90) * (Math.PI / 180);
  const x1 = CX + TRACK_R * Math.cos(toRad(startDeg));
  const y1 = CY + TRACK_R * Math.sin(toRad(startDeg));
  const x2 = CX + TRACK_R * Math.cos(toRad(endDeg));
  const y2 = CY + TRACK_R * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${TRACK_R} ${TRACK_R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function Knob({ label, value, fg, labelColor, fontSize, minAngle, maxAngle, size }: {
  label: string; value: number; fg: string; labelColor: string; fontSize: number;
  minAngle: number; maxAngle: number; size: number;
}) {
  const deg = minAngle + value * (maxAngle - minAngle);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        <path d={describeArc(minAngle, maxAngle)}
          fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={STROKE} strokeLinecap="round" />
        <path d={describeArc(minAngle, deg)}
          fill="none" stroke={fg} strokeWidth={STROKE} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={R} fill="rgba(0,0,0,0.5)" />
        <circle
          cx={CX + R * 0.65 * Math.cos((deg - 90) * Math.PI / 180)}
          cy={CY + R * 0.65 * Math.sin((deg - 90) * Math.PI / 180)}
          r={DOT_R} fill={fg}
        />
      </svg>
      <span style={{ fontSize: fontSize - 2, color: labelColor, opacity: 0.8 }}>{label}</span>
    </div>
  );
}

export default function KnobBankDesign({ widget }: { widget: KnobBankWidget }): React.JSX.Element {
  const { countX, countY, spacingX, spacingY, style, cells } = widget;
  const count = countX * countY;
  const size = widget.knobSize ?? 56;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: `repeat(${countX}, 1fr)`,
      gridTemplateRows: `repeat(${countY}, 1fr)`,
      columnGap: spacingX, rowGap: spacingY,
      padding: Math.max(spacingX, spacingY), boxSizing: 'border-box',
    }}>
      {Array.from({ length: count }, (_, i) => {
        const cell = cells[i];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Knob
              label={cell?.label ?? `K${i + 1}`}
              value={0.5}
              fg={cell?.color ?? style.foregroundColor}
              labelColor={style.labelColor}
              fontSize={style.fontSize}
              minAngle={cell?.minAngle ?? -135}
              maxAngle={cell?.maxAngle ?? 135}
              size={size}
            />
          </div>
        );
      })}
    </div>
  );
}
