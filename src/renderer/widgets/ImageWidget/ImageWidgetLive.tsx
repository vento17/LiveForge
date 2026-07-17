import React from 'react';
import type { ImageWidget } from '../../../shared/types/project';

export default function ImageWidgetLive({ widget }: { widget: ImageWidget }): React.JSX.Element {
  if (!widget.src) return <></>;
  return (
    <img
      src={widget.src}
      style={{
        width: '100%', height: '100%',
        objectFit: 'contain',
        opacity: widget.opacity,
        mixBlendMode: widget.blendMode as React.CSSProperties['mixBlendMode'],
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      draggable={false}
    />
  );
}
