import React, { useEffect } from 'react';
import { useMode, useProject } from '../store';
import { bridge } from '../ipc/bridge';
import type { MidiConnection, MidiInputConnection, OscConnection, ArtNetConnection, SacnConnection } from '../../shared/types/project';
import DesignMode from '../modes/design/DesignMode';
import LiveMode from '../modes/live/LiveMode';
import GlobalBar from '../modes/GlobalBar';
import LogConsole from '../modes/LogConsole';

export default function App(): React.JSX.Element {
  const mode    = useMode();
  const project = useProject();

  // Auto-connect all configured services whenever the saved connections change.
  // This fires on first render (project load) and any time the user updates connections.
  useEffect(() => {
    const conns = project.connections;

    const midi = conns.find((c) => c.type === 'midi') as MidiConnection | undefined;
    if (midi?.portName)
      bridge.invoke('tr:midi:openPort', { portName: midi.portName, virtual: midi.virtualPort }).catch(() => {});

    const midiIn = conns.find((c) => c.type === 'midiInput') as MidiInputConnection | undefined;
    if (midiIn?.portName)
      bridge.invoke('tr:midi:openInputPort', { portName: midiIn.portName }).catch(() => {});

    const osc = conns.find((c) => c.type === 'osc') as OscConnection | undefined;
    if (osc?.targetHost)
      bridge.invoke('tr:osc:configure', {
        targetHost: osc.targetHost,
        targetPort: osc.targetPort ?? 8000,
        listenPort: osc.listenPort ?? 9000,
      }).catch(() => {});

    const artnet = conns.find((c) => c.type === 'artnet') as ArtNetConnection | undefined;
    if (artnet?.targetHost)
      bridge.invoke('tr:artnet:configure', { targetHost: artnet.targetHost }).catch(() => {});

    const sacn = conns.find((c) => c.type === 'sacn') as SacnConnection | undefined;
    if (sacn)
      bridge.invoke('tr:sacn:configure', {
        mode:       sacn.mode ?? 'multicast',
        priority:   sacn.priority ?? 100,
        targetHost: sacn.targetHost,
      }).catch(() => {});
  }, [project.connections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GlobalBar />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'design' ? <DesignMode /> : <LiveMode />}
      </div>
      <LogConsole />
    </div>
  );
}
