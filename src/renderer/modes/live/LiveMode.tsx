import React, { useEffect, useState, useCallback } from 'react';
import { useStore, useActivePage, useProject } from '../../store';
import { GLOBAL_BAR_HEIGHT } from '../GlobalBar';
import LiveCanvas from './LiveCanvas';
import LiveSidebar from './LiveSidebar';
import RouterEngine from './RouterEngine';
import MasterEngine from './MasterEngine';
import { bridge } from '../../ipc/bridge';

const SIDEBAR_WIDTH = 248;

export default function LiveMode(): React.JSX.Element {
  const setMode              = useStore((s) => s.setMode);
  const initRuntime          = useStore((s) => s.initRuntime);
  const liveSidebarOpen      = useStore((s) => s.liveSidebarOpen);
  const setLiveSidebarOpen   = useStore((s) => s.setLiveSidebarOpen);
  const setLiveSelectedWidgetId = useStore((s) => s.setLiveSelectedWidgetId);
  const hoverInfo            = useStore((s) => s.hoverInfo);
  const page                 = useActivePage();
  const project              = useProject();
  const [scale, setScale]    = useState(1);

  // Enter fullscreen on mount, exit on unmount
  useEffect(() => {
    bridge.invoke('tr:window:fullscreen', true).catch(() => {});
    return () => { bridge.invoke('tr:window:fullscreen', false).catch(() => {}); };
  }, []);

  // Initialize runtime + auto-configure all connections when entering Live mode.
  // Runtime covers EVERY page's widgets (not just the active one) so cross-page
  // router links have their source/slave cells available regardless of which
  // page is shown. initRuntime merges existing values, so re-running is safe.
  useEffect(() => {
    initRuntime(project.pages.flatMap((p) => p.widgets));

    const conns = project.connections;
    const midi   = conns.find((c) => c.type === 'midi');
    const osc    = conns.find((c) => c.type === 'osc');
    const artnet = conns.find((c) => c.type === 'artnet');
    const sacn   = conns.find((c) => c.type === 'sacn');

    if (midi && midi.type === 'midi' && midi.portName) {
      bridge.invoke('tr:midi:openPort', { portName: midi.portName, virtual: midi.virtualPort ?? false }).catch(() => {});
    }

    if (osc && osc.type === 'osc' && osc.targetHost) {
      bridge.invoke('tr:osc:configure', {
        targetHost: osc.targetHost,
        targetPort: osc.targetPort ?? 8000,
        listenPort: osc.listenPort ?? 9000,
      }).catch(() => {});
    }
    if (artnet && artnet.type === 'artnet' && artnet.targetHost) {
      bridge.invoke('tr:artnet:configure', { targetHost: artnet.targetHost }).catch(() => {});
    }
    if (sacn && sacn.type === 'sacn') {
      bridge.invoke('tr:sacn:configure', {
        mode: sacn.mode ?? 'multicast',
        priority: sacn.priority ?? 100,
        targetHost: sacn.targetHost,
      }).catch(() => {});
    }
  }, [page?.id]);

  // Compute scale to fit design canvas into the available space
  const computeScale = useCallback(() => {
    if (!page) return;
    const availWidth = liveSidebarOpen
      ? window.innerWidth - SIDEBAR_WIDTH
      : window.innerWidth;
    const scaleX = availWidth / page.width;
    const scaleY = (window.innerHeight - GLOBAL_BAR_HEIGHT) / page.height;
    setScale(Math.min(scaleX, scaleY));
  }, [page, liveSidebarOpen]);

  useEffect(() => {
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [computeScale]);

  // ESC exits Live mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('design');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  if (!page) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)' }}>
        No page available
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex',
      overflow: 'hidden',
      background: '#000',
      position: 'relative',
    }}>
      {/* Global engines — run across all pages (cross-page links & master gains) */}
      <RouterEngine />
      <MasterEngine />

      {/* Sidebar toggle arrow — always visible at top-left */}
      <button
        title={liveSidebarOpen ? 'Close live params' : 'Open live params'}
        onClick={() => setLiveSidebarOpen(!liveSidebarOpen)}
        style={{
          position: 'absolute',
          top: 8,
          left: liveSidebarOpen ? SIDEBAR_WIDTH + 8 : 8,
          zIndex: 200,
          width: 22, height: 22,
          padding: 0,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid #2a2a2a',
          color: '#555',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'left 0.2s ease',
          lineHeight: 1,
        }}
      >
        {liveSidebarOpen ? '◀' : '▶'}
      </button>

      {/* Collapsible sidebar */}
      {liveSidebarOpen && <LiveSidebar />}

      {/* Canvas fills remaining space */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <LiveCanvas page={page} scale={scale} onSelectWidget={setLiveSelectedWidgetId} />
      </div>

      {/* Hover info bar — shows the widget/cell under the cursor so per-cell
          labels can be turned off to keep widgets compact. */}
      {hoverInfo && (
        <div style={{
          position: 'fixed', bottom: 6, left: 38, right: 38, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 180,
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.72)', border: '1px solid #2a2a2a', borderRadius: 11,
            padding: '2px 12px', fontSize: 11, color: '#cfcfcf', fontFamily: 'monospace',
            maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {hoverInfo}
          </div>
        </div>
      )}
    </div>
  );
}
