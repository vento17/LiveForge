import React from 'react';
import type { InstanceWidget, Widget } from '../../../shared/types/project';
import { useStore } from '../../store';
import LiveWidgetInner from '../../modes/live/LiveWidgetInner';

function Placeholder({ text }: { text: string }): React.JSX.Element {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px dashed #333', borderRadius: 4, color: '#555', fontSize: 11, fontFamily: 'monospace',
      textAlign: 'center', padding: 8, boxSizing: 'border-box',
    }}>
      ⧉ {text}
    </div>
  );
}

// Renders the source widget's live UI wired to the SOURCE's runtime, so the
// instance and its source always share the exact same value.
export default function InstanceLive({ widget }: { widget: InstanceWidget }): React.JSX.Element {
  const source = useStore((s): Widget | null => {
    for (const p of s.project.pages) {
      const w = p.widgets.find((x) => x.id === widget.sourceWidgetId);
      if (w) return w;
    }
    return null;
  });

  if (!source) return <Placeholder text="no source — pick one in params" />;
  if (source.kind === 'instance') return <Placeholder text="cannot mirror an instance" />;
  return <LiveWidgetInner widget={source} />;
}
