import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

export function registerWindowHandlers(win: BrowserWindow): void {
  ipcMain.handle('tr:window:fullscreen', (_e, fullscreen: boolean) => {
    win.setFullScreen(fullscreen);
  });
}
