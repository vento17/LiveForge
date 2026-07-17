import { ipcMain, dialog, app } from 'electron';
import { mkdir } from 'fs/promises';
import path from 'path';
import { ProjectService } from '../services/ProjectService';

const svc = new ProjectService();

const saveDir = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'Save')
  : path.join(process.cwd(), 'Save');

export function registerProjectHandlers(): void {
  ipcMain.handle('tr:project:save', async (_e, project) => {
    await mkdir(saveDir, { recursive: true });
    const safeName = (project.name || 'project').replace(/[^a-z0-9_\- ]/gi, '_');
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Project',
      defaultPath: path.join(saveDir, `${safeName}.liveforge`),
      filters: [{ name: 'LiveForge Project', extensions: ['liveforge', 'json'] }],
    });
    if (canceled || !filePath) return { ok: false, path: '' };
    await svc.write(filePath, project);
    return { ok: true, path: filePath };
  });

  ipcMain.handle('tr:project:load', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Open Project',
      filters: [{ name: 'LiveForge Project', extensions: ['liveforge', 'surfrig', 'json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    return svc.read(filePaths[0]);
  });

  ipcMain.handle('tr:project:backup', async (_e, project) => {
    const backupDir = path.join(app.getPath('userData'), 'backup');
    await mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = (project.name || 'project').replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(backupDir, `${safeName}_${timestamp}.json`);
    await svc.write(filePath, project);
    return { ok: true, path: filePath };
  });
}
