import { ipcMain, type BrowserWindow } from 'electron';
import { OscService } from '../services/OscService';

const svc = new OscService();

export function registerOscHandlers(win: BrowserWindow): void {
  ipcMain.handle('tr:osc:configure', async (_e, config) => {
    await svc.configure(config.targetHost, config.targetPort, config.listenPort, config.outputs ?? [], config.extraListenPorts ?? []);
    svc.onMessage((msg) => {
      if (!win.isDestroyed()) {
        win.webContents.send('tr:osc:feedback', msg);
      }
    });
    return { ok: true };
  });

  ipcMain.handle('tr:osc:disconnect', async () => {
    svc.close();
    return { ok: true };
  });

  ipcMain.on('tr:osc:send', (_e, payload) => svc.send(payload));
}
