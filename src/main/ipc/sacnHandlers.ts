import { ipcMain } from 'electron';
import { SacnService } from '../services/SacnService';

const svc = new SacnService();

export function registerSacnHandlers(): void {
  ipcMain.handle('tr:sacn:configure', (_e, config) => {
    svc.configure(config.mode, config.priority, config.targetHost);
    return { ok: true };
  });

  ipcMain.on('tr:sacn:sendChannel', (_e, p) =>
    svc.setChannel(p.universe, p.channel, p.value, p.priority)
  );

  ipcMain.on('tr:sacn:sendUniverse', (_e, p) =>
    svc.setChannels(p.universe, p.channels, p.priority)
  );
}
