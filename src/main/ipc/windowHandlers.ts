import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

export function registerWindowHandlers(win: BrowserWindow): void {
  ipcMain.handle('tr:window:fullscreen', (_e, fullscreen: boolean) => {
    if (win.isDestroyed()) return;
    if (win.isFullScreen() === fullscreen) return;
    win.setFullScreen(fullscreen);
  });
}
