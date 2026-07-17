import { ipcMain, dialog } from 'electron';
import type { BrowserWindow } from 'electron';
import { readFile } from 'fs/promises';
import path from 'path';

export function registerFileHandlers(win: BrowserWindow): void {
  ipcMain.handle('tr:file:pickImage', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const buffer = await readFile(filePaths[0]);
    const ext = path.extname(filePaths[0]).slice(1).toLowerCase();
    const mime =
      ext === 'svg' ? 'image/svg+xml' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  });

  ipcMain.handle('tr:file:pickAudio', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Select Audio',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const buffer   = await readFile(filePaths[0]);
    const ext      = path.extname(filePaths[0]).slice(1).toLowerCase();
    const mimes: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
    };
    const mime = mimes[ext] ?? 'audio/mpeg';
    return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, fileName: path.basename(filePaths[0]) };
  });
}
