import React from 'react';
import type { TextWidget } from '../../../shared/types/project';
import { TextContent } from './TextWidgetDesign';

export default function TextWidgetLive({ widget }: { widget: TextWidget }): React.JSX.Element {
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none', userSelect: 'none' }}>
      <TextContent widget={widget} />
    </div>
  );
}
