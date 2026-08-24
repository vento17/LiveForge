import React, { useState, useRef, useLayoutEffect } from 'react';
import { useStore } from '../../store';
import {
  findSlaveLink, listLinkableSources, sourceCells, listRouters, pageIdOfWidget,
  cellLabel,
} from './links';

interface Props {
  x: number;
  y: number;
  widgetId: string;      // the slave widget (the cell you right-clicked)
  cellIndex: number;     // the slave cell index
  onClose: () => void;
}

type View = 'root' | 'sources' | 'cells' | 'routers';



export default function CellLinkMenu({ x, y, widgetId, cellIndex, onClose }: Props): React.JSX.Element {
  const project = useStore((s) => s.project);
  const connectedProtocols = useStore((s) => s.connectedProtocols);
  const connections = project.connections;
  // Offer Learn when the protocol is either configured in Settings OR actually
  // connected. MIDI learn listens on the INPUT port, so accept either midi entry.
  const hasMidi = !!connectedProtocols['midiInput'] || !!connectedProtocols['midi'] ||
                  connections.some((c) => c.type === 'midiInput' || c.type === 'midi');
  const hasOsc  = !!connectedProtocols['osc'] || connections.some((c) => c.type === 'osc');

  const learnTarget = useStore((s) => s.midiLearnTarget);
  const isLearning = learnTarget?.widgetId === widgetId && learnTarget?.cellIndex === cellIndex;

  const [view, setView] = useState<View>('root');
  const [srcWidgetId, setSrcWidgetId] = useState<string>('');
  const [srcCellIndex, setSrcCellIndex] = useState<number>(0);

  const slaveLink = findSlaveLink(project, widgetId, cellIndex);
  const routers = listRouters(project);
  const srcWidget = project.pages.flatMap((p) => p.widgets).find((w) => w.id === srcWidgetId);

  const startLearn = (protocol: 'midi' | 'osc'): void => {
    const activePageId = useStore.getState().activePageId;
    if (!activePageId) { onClose(); return; }
    useStore.getState().setMidiLearnTarget({ pageId: activePageId, widgetId, cellIndex, protocol });
    onClose();
  };

  const commitLink = (routerId: string): void => {
    useStore.getState().linkSlaveCell({
      slaveWidgetId: widgetId, slaveCellIndex: cellIndex,
      sourceWidgetId: srcWidgetId, sourceCellIndex: srcCellIndex,
      routerId,
    });
    onClose();
  };

  const commitLinkNewRouter = (): void => {
    const store = useStore.getState();
    const slavePageId = pageIdOfWidget(store.project, widgetId) ?? store.activePageId;
    if (!slavePageId) { onClose(); return; }
    const routerId = store.addWidget(slavePageId, 'router');

    // Auto-created routers open in the bottom-right corner of their page.
    const fresh = useStore.getState();
    const page = fresh.project.pages.find((p) => p.id === slavePageId);
    const created = page?.widgets.find((w) => w.id === routerId);
    if (page && created) {
      const margin = 16;
      const x = Math.max(0, page.width - created.rect.width - margin);
      const y = Math.max(0, page.height - created.rect.height - margin);
      fresh.updateWidgetRect(slavePageId, routerId, { x, y });
    }

    store.linkSlaveCell({
      slaveWidgetId: widgetId, slaveCellIndex: cellIndex,
      sourceWidgetId: srcWidgetId, sourceCellIndex: srcCellIndex,
      routerId,
    });
    onClose();
  };

  const goPickCell = (wid: string): void => {
    setSrcWidgetId(wid);
    setView('cells');
  };

  const goPickRouter = (idx: number): void => {
    setSrcCellIndex(idx);
    setView('routers');
  };

  // The menu is big enough now that opening it near an edge would push it off
  // screen, so measure and pull it back in. Re-runs per view: each view is a
  // different height.
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPos({
      left: Math.max(margin, Math.min(x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - height - margin)),
    });
  }, [x, y, view]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999,
        background: '#1a1a1a', border: '1px solid #3a3a3a',
        borderRadius: 6, padding: '6px 0', minWidth: 300, maxWidth: 420,
        maxHeight: '75vh', overflowY: 'auto',
        boxShadow: '0 6px 28px rgba(0,0,0,0.75)', fontFamily: 'monospace',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {view === 'root' && (
        <>
          {slaveLink ? (
            <>
              <div style={headerStyle}>
                ▶ slaved to <span style={{ color: '#ff5555' }}>{slaveLink.source.primary}</span>
                <span style={{ color: '#777' }}> · {slaveLink.source.secondary}</span>
              </div>
              <div style={dividerStyle} />
              <button style={itemStyle('#ff6666')} onClick={() => { useStore.getState().unlinkSlaveCell(widgetId, cellIndex); onClose(); }}>
                ✕ Unlink
              </button>
              <button style={itemStyle()} onClick={() => setView('sources')}>
                ↻ Select new source ▸
              </button>
            </>
          ) : (
            <button style={itemStyle()} onClick={() => setView('sources')}>
              ⇢ Link to source ▸
            </button>
          )}

          {(hasMidi || hasOsc) && <div style={dividerStyle} />}
          {isLearning ? (
            <button style={itemStyle('#ff6600')} onClick={() => { useStore.getState().setMidiLearnTarget(null); onClose(); }}>
              ⬤ Cancel Learn ({learnTarget?.protocol?.toUpperCase() ?? 'MIDI'})
            </button>
          ) : (
            <>
              {hasMidi && <button style={itemStyle()} onClick={() => startLearn('midi')}>⬤ Learn MIDI CC</button>}
              {hasOsc  && <button style={itemStyle()} onClick={() => startLearn('osc')}>⬤ Learn OSC</button>}
              {!hasMidi && !hasOsc && (
                <div style={emptyStyle}>
                  no MIDI/OSC connection — add one in Settings
                </div>
              )}
            </>
          )}
        </>
      )}

      {view === 'sources' && (
        <>
          <button style={backStyle} onClick={() => setView('root')}>‹ back</button>
          <div style={dividerStyle} />
          {listLinkableSources(project).length === 0 && (
            <div style={emptyStyle}>no source widgets</div>
          )}
          {listLinkableSources(project).map((group, gi) => (
            <div key={group.pageId}>
              {/* Rule between pages so a long source list reads as groups. */}
              {gi > 0 && <div style={dividerStyle} />}
              {project.pages.length > 1 && <div style={headerStyle}>{group.pageName}</div>}
              {group.widgets.map((w) => (
                <button key={w.id} style={itemStyle()} onClick={() => goPickCell(w.id)}>
                  {w.label} <span style={{ color: '#666' }}>· {w.kind}</span>
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {view === 'cells' && srcWidget && (
        <>
          <button style={backStyle} onClick={() => setView('sources')}>‹ {srcWidget.label}</button>
          <div style={dividerStyle} />
          {sourceCells(srcWidget).map((c) => {
            const isSelf = srcWidget.id === widgetId && c.index === cellIndex;
            return (
              <button
                key={c.index}
                style={itemStyle(isSelf ? '#555' : undefined)}
                disabled={isSelf}
                onClick={() => { if (!isSelf) goPickRouter(c.index); }}
              >
                {c.label}{isSelf ? ' (this cell)' : ''}
              </button>
            );
          })}
        </>
      )}

      {view === 'routers' && (
        <>
          <button style={backStyle} onClick={() => setView('cells')}>
            ‹ {srcWidget?.label} · {cellLabel(srcWidget, srcCellIndex)}
          </button>
          <div style={dividerStyle} />
          <div style={headerStyle}>create link in</div>
          {routers.map((r) => (
            <button key={r.id} style={itemStyle()} onClick={() => commitLink(r.id)}>
              {r.label}
              {project.pages.length > 1 && <span style={{ color: '#666' }}> · {r.pageName}</span>}
            </button>
          ))}
          <div style={dividerStyle} />
          <button style={itemStyle('#66cc99')} onClick={commitLinkNewRouter}>
            ＋ New router
          </button>
        </>
      )}
    </div>
  );
}

// Sized to stay readable standing over a monitor lying flat on a table.
const itemStyle = (color?: string): React.CSSProperties => ({
  display: 'block', width: '100%', minHeight: 40, padding: '10px 16px',
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 15, color: color ?? '#ccc', textAlign: 'left', fontFamily: 'inherit',
});

const backStyle: React.CSSProperties = {
  ...itemStyle('#888'),
  fontSize: 13,
};

const headerStyle: React.CSSProperties = {
  padding: '8px 16px', color: '#8a8a8a', fontSize: 12,
  textTransform: 'uppercase', letterSpacing: 1,
};

const dividerStyle: React.CSSProperties = {
  height: 1, background: '#3a3a3a', margin: '6px 0',
};

const emptyStyle: React.CSSProperties = {
  padding: '10px 16px', color: '#555', fontSize: 14,
};
