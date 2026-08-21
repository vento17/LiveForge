import React from 'react';
import type { ManualWidget } from '../../../shared/types/project';
import ManualView from './ManualView';

// Same view, but the tabs do not respond: in Design mode a click on the widget
// belongs to selecting and dragging it. Read it in Live mode.
export default function ManualDesign({ widget }: { widget: ManualWidget }): React.JSX.Element {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
      <ManualView widget={widget} interactive={false} />
    </div>
  );
}
