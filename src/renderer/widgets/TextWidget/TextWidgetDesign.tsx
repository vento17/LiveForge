import React from 'react';
import type { TextWidget } from '../../../shared/types/project';

export default function TextWidgetDesign({ widget }: { widget: TextWidget }): React.JSX.Element {
  return <TextContent widget={widget} />;
}

export function TextContent({ widget }: { widget: TextWidget }): React.JSX.Element {
  const borderStyle: React.CSSProperties = (() => {
    if (widget.frame === 'outline') return {
      border: `${widget.frameSize}px solid ${widget.frameColor}`,
      borderRadius: widget.style.borderRadius,
    };
    if (widget.frame === 'underline') return {
      borderBottom: `${widget.frameSize}px solid ${widget.frameColor}`,
    };
    return {};
  })();

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent:
        widget.textAlign === 'left' ? 'flex-start' :
        widget.textAlign === 'right' ? 'flex-end' : 'center',
      padding: '4px 8px',
      overflow: 'hidden',
      boxSizing: 'border-box',
      ...borderStyle,
    }}>
      <span style={{
        fontFamily: widget.fontFamily,
        fontSize: widget.style.fontSize,
        fontWeight: widget.fontWeight,
        fontStyle: widget.fontStyle,
        color: widget.textColor,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: widget.textAlign,
        width: '100%',
      }}>
        {widget.text || '…'}
      </span>
    </div>
  );
}
