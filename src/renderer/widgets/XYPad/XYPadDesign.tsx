import React from 'react';
import type { XYPadWidget } from '../../../shared/types/project';

export default function XYPadDesign({ widget }: { widget: XYPadWidget }): React.JSX.Element {
  const { style } = widget;

  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Grid lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${style.foregroundColor}22 1px, transparent 1px), linear-gradient(90deg, ${style.foregroundColor}22 1px, transparent 1px)`,
        backgroundSize: '25% 25%',
      }} />
      {/* Center crosshair */}
      {widget.showCrosshair && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: `${style.foregroundColor}55` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: `${style.foregroundColor}55` }} />
        </>
      )}
      {/* Dot at center */}
      <div style={{
        width: 14, height: 14,
        borderRadius: '50%',
        background: style.foregroundColor,
        boxShadow: `0 0 10px ${style.foregroundColor}`,
        zIndex: 1,
      }} />
      {style.showLabel && (
        <div style={{
          position: 'absolute', bottom: 6, left: 0, right: 0,
          textAlign: 'center', fontSize: style.fontSize,
          color: style.labelColor, opacity: 0.7,
        }}>
          {widget.label}
        </div>
      )}
    </div>
  );
}
