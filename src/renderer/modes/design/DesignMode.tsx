import React from 'react';
import Canvas from './Canvas';
import Inspector from './inspector/Inspector';

export default function DesignMode(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--color-bg)', overflow: 'hidden' }}>
      <Canvas />
      <Inspector />
    </div>
  );
}
