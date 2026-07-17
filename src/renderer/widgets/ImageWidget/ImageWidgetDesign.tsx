import React from 'react';
import type { ImageWidget } from '../../../shared/types/project';

export default function ImageWidgetDesign({ widget }: { widget: ImageWidget }): React.JSX.Element {
  const layerLabel = widget.layer === 'under' ? 'UNDER' : 'OVER';
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {widget.src ? (
        <img
          src={widget.src}
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            opacity: widget.opacity,
            mixBlendMode: widget.blendMode as React.CSSProperties['mixBlendMode'],
            display: 'block',
          }}
          draggable={false}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-dim)', fontSize: 12, gap: 6,
          border: '1px dashed var(--color-border)',
          borderRadius: 4,
        }}>
          <span style={{ fontSize: 28 }}>🖼</span>
          <span>Click ⚙ to pick image</span>
        </div>
      )}
      <span style={{
        position: 'absolute', top: 3, left: 5,
        fontSize: 9, color: 'rgba(255,255,255,0.45)',
        pointerEvents: 'none',
      }}>
        {layerLabel} · {widget.blendMode}
      </span>
    </div>
  );
}
