import React from 'react';
import type { StepSequencerWidget } from '../../../shared/types/project';

function speedLabel(m: number): string {
  if (m === 0.125) return '1/8';
  if (m === 0.25)  return '1/4';
  if (m === 0.5)   return '1/2';
  if (m === 1)     return '1x';
  if (m === 2)     return '2x';
  if (m === 4)     return '4x';
  return '8x';
}

export default function StepSequencerDesign({ widget }: { widget: StepSequencerWidget }): React.JSX.Element {
  const { stepCount, speedMultiplier, steps, style } = widget;
  const color = style.foregroundColor;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 8, gap: 6 }}>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <div style={{ ...pill, background: 'rgba(0,0,0,0.4)', color }}>▶</div>
        <div style={{ ...pill, background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: '0.1em' }}>
          MASTER BPM
        </div>
        <div style={{ flex: 1 }} />
        {([0.125, 0.25, 0.5, 1, 2, 4, 8] as const).map((m) => (
          <div key={m} style={{
            ...pill, fontSize: 9,
            background: speedMultiplier === m ? color + '33' : 'rgba(0,0,0,0.25)',
            color:      speedMultiplier === m ? color         : 'rgba(255,255,255,0.3)',
          }}>
            {speedLabel(m)}
          </div>
        ))}
      </div>

      {/* Steps as sliders */}
      <div style={{ flex: 1, display: 'flex', gap: 3, alignItems: 'stretch', minHeight: 0 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            flex: 1, position: 'relative', borderRadius: 2, overflow: 'hidden',
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${step.active ? color + '44' : 'rgba(255,255,255,0.07)'}`,
            boxSizing: 'border-box',
          }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: `${Math.round(step.value * 100)}%`,
              background: step.active ? color + '55' : 'rgba(255,255,255,0.06)',
            }} />
            {style.showLabel && (
              <div style={{
                position: 'absolute', bottom: 2, width: '100%', textAlign: 'center',
                fontSize: 8, pointerEvents: 'none', color: 'rgba(255,255,255,0.18)',
              }}>
                {i + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {style.showLabel && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', flexShrink: 0, letterSpacing: '0.08em' }}>
          {stepCount} steps · {speedLabel(speedMultiplier)}
        </div>
      )}
    </div>
  );
}

const pill: React.CSSProperties = {
  padding: '5px 9px', borderRadius: 3, fontSize: 12, fontWeight: 600,
  userSelect: 'none', whiteSpace: 'nowrap',
};
