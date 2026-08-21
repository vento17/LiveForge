import { ipcMain } from 'electron';
import { ArtNetService } from '../services/ArtNetService';

const svc = new ArtNetService();

export function registerArtNetHandlers(): void {
  ipcMain.handle('tr:artnet:configure', (_e, config) => {
    svc.configure(config.outputs ?? []);
    return { ok: true };
  });

  ipcMain.on('tr:artnet:sendChannel', (_e, p) =>
    svc.setChannel(p.outputId, p.universe, p.channel, p.value)
  );

  ipcMain.on('tr:artnet:sendUniverse', (_e, p) =>
    svc.setChannels(p.outputId, p.universe, p.channels)
  );
}
