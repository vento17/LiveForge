import { app, BrowserWindow, shell, session } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import { is } from '@electron-toolkit/utils';
import { registerAllHandlers } from './ipc/router';

let mainWindow: BrowserWindow | null = null;
let sidecar: ChildProcess | null = null;

function startSidecar(): void {
  // The Spout/NDI video sidecar is Windows-only (Spout needs SpoutLibrary.dll).
  // Skip it elsewhere so the app runs on macOS/Linux without those widgets —
  // Windows behaviour is unchanged.
  if (process.platform !== 'win32') {
    console.log('[sidecar] skipped — Windows only');
    return;
  }
  let cmd: string;
  let args: string[];
  if (is.dev) {
    cmd = 'python';
    args = [join(app.getAppPath(), 'src/main/sidecar/server.py')];
  } else {
    cmd = join(process.resourcesPath, 'sidecar', 'sidecar.exe');
    args = [];
  }
  try {
    sidecar = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    // Never let a missing/failed sidecar crash the app (unhandled 'error' event).
    sidecar.on('error', (err) => { console.error('[sidecar] failed to start:', err.message); sidecar = null; });
    sidecar.stdout?.on('data', (d: Buffer) => process.stdout.write(`[sidecar] ${d}`));
    sidecar.stderr?.on('data', (d: Buffer) => process.stderr.write(`[sidecar:err] ${d}`));
    sidecar.on('exit', (code) => { console.log(`[sidecar] exited ${code}`); sidecar = null; });
  } catch (err) {
    console.error('[sidecar] spawn error:', err);
    sidecar = null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'LiveForge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  registerAllHandlers(mainWindow);
}

app.whenReady().then(() => {
  // Electron exposes camera + microphone access under the single 'media'
  // permission — there is no separate 'camera' value.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'media';
  });
  startSidecar();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  sidecar?.kill();
});

app.on('window-all-closed', () => {
  sidecar?.kill();
  if (process.platform !== 'darwin') app.quit();
});
