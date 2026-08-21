import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { MidiService } from '../services/MidiService';

const svc = new MidiService();

export function registerMidiHandlers(win: BrowserWindow): void {
  // ─── Output ───────────────────────────────────────────────────────────────
  ipcMain.handle('tr:midi:listPorts',  () => svc.listPorts());
  ipcMain.handle('tr:midi:openPort',   (_e, { portName, virtual, extraOutputs }) => svc.openPort(portName, virtual, extraOutputs ?? []));
  ipcMain.handle('tr:midi:closePort',  () => svc.closePort());

  ipcMain.on('tr:midi:sendCC',   (_e, p) => svc.sendCC(p.channel, p.cc, p.value, p.outputId));
  ipcMain.on('tr:midi:sendNote', (_e, p) => svc.sendNote(p.channel, p.note, p.velocity, p.on, p.outputId));
  ipcMain.on('tr:midi:sendPB',   (_e, p) => svc.sendPitchBend(p.channel, p.value, p.outputId));
  ipcMain.on('tr:midi:clockStart', (_e, { bpm }) => svc.startClock(bpm));
  ipcMain.on('tr:midi:clockStop',  () => svc.stopClock());

  // ─── Input ────────────────────────────────────────────────────────────────
  ipcMain.handle('tr:midi:listInputPorts', () => svc.listInputPorts());
  ipcMain.handle('tr:midi:openInputPort',  (_e, { portName, extraPorts }) => svc.openInputPort(portName, extraPorts ?? []));

  svc.onInputMessage((evt) => {
    if (!win.isDestroyed()) win.webContents.send('tr:midi:inputEvent', evt);
  });

  svc.onMtcFrame((frame) => {
    if (!win.isDestroyed()) win.webContents.send('tr:midi:mtcFrame', frame);
  });
}
