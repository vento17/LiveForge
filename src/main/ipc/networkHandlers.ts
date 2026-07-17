import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { networkServer } from '../services/NetworkServer';
import type { NetStatePayload, NetInteractPayload, NetPageRect } from '../../shared/types/ipc';

let frameTimer: ReturnType<typeof setInterval> | null = null;
let isCapturing = false;
let rendererDpr = 1; // updated from renderer's window.devicePixelRatio on every snapshot
let lastPageRect: NetPageRect | undefined; // window CSS px, from renderer
let lastRatio = 1; // frame-logical ↔ window CSS scale factor (max-1280 downscale)

async function captureAndBroadcast(win: BrowserWindow): Promise<void> {
  if (isCapturing || !networkServer.hasClients()) return;
  isCapturing = true;
  try {
    // Capture the WHOLE window (top bars included) so remote clicks can be
    // injected anywhere — every widget + the global bar become interactive.
    const image = await win.webContents.capturePage();
    const physSize = image.getSize();
    if (physSize.width === 0) return;

    const dpr = rendererDpr > 0 ? rendererDpr : 1;
    const logW = Math.round(physSize.width / dpr);
    const logH = Math.round(physSize.height / dpr);

    // Scale down to max 1280 logical pixels wide
    const maxLogW = 1280;
    const ratio = logW > maxLogW ? maxLogW / logW : 1;
    lastRatio = ratio;
    const targetPhysW = Math.round(physSize.width * ratio);
    const scaled = ratio < 1 ? image.resize({ width: targetPhysW }) : image;

    const frameLogW = Math.round(logW * ratio);
    const frameLogH = Math.round(logH * ratio);

    // Page rect in frame-logical coords (no crop now: window y → y*ratio).
    const framePageRect = lastPageRect ? {
      ox: lastPageRect.x * ratio,
      oy: lastPageRect.y * ratio,
      s:  lastPageRect.scale * ratio,
    } : undefined;

    const jpeg = scaled.toJPEG(70);
    networkServer.sendFrame(jpeg.toString('base64'), frameLogW, frameLogH, framePageRect);
  } catch (err) {
    console.error('[Network] captureAndBroadcast error:', err);
  } finally {
    isCapturing = false;
  }
}

// Inject a remote pointer event as a real mouse event at the mapped window
// coordinate. frame-logical → window CSS = divide by the current downscale ratio.
function injectInput(win: BrowserWindow, p: { action: 'down' | 'move' | 'up'; x: number; y: number }): void {
  const r = lastRatio || 1;
  const x = Math.round(p.x / r);
  const y = Math.round(p.y / r);
  const type = p.action === 'down' ? 'mouseDown' : p.action === 'up' ? 'mouseUp' : 'mouseMove';
  try {
    win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 } as Electron.MouseInputEvent);
  } catch { /* ignore */ }
}

function stopFrameCapture(): void {
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
}

export function registerNetworkHandlers(win: BrowserWindow): void {
  // Renderer asks to start the HTTP+WS server
  ipcMain.handle('tr:net:start', async (_e, payload: { port: number }) => {
    const result = await networkServer.start(payload.port);
    if (result.ok) {
      // Forward browser interactions / page switches to the renderer
      networkServer.onInteract = (interactPayload: NetInteractPayload) => {
        win.webContents.send('tr:net:interact', interactPayload);
      };
      networkServer.onSwitchPage = (pageId: string) => {
        win.webContents.send('tr:net:switchPage', pageId);
      };
      // Raw pointer injection — makes the ENTIRE window clickable from the remote
      networkServer.onInput = (p) => injectInput(win, p);
      // Start frame capture when any browser client connects
      networkServer.onClientConnect = () => {
        if (!frameTimer) {
          frameTimer = setInterval(() => captureAndBroadcast(win), 100); // 10 fps
        }
      };
      // Stop frame capture when last client disconnects
      networkServer.onClientDisconnect = () => {
        if (!networkServer.hasClients()) stopFrameCapture();
      };
    }
    return result;
  });

  // Renderer asks to stop the server
  ipcMain.handle('tr:net:stop', async () => {
    stopFrameCapture();
    networkServer.onInteract = undefined;
    networkServer.onSwitchPage = undefined;
    networkServer.onInput = undefined;
    networkServer.onClientConnect = undefined;
    networkServer.onClientDisconnect = undefined;
    return networkServer.stop();
  });

  // Renderer queries local IP (for display in settings)
  ipcMain.handle('tr:net:getLocalIP', () => networkServer.getLocalIP());

  // Renderer pushes full state snapshot → store DPR + broadcast to browser clients
  ipcMain.on('tr:net:stateChange', (_e, payload: NetStatePayload) => {
    if (payload.dpr && payload.dpr > 0) rendererDpr = payload.dpr;
    if (payload.pageRect) lastPageRect = payload.pageRect;
    networkServer.broadcastState(payload);
  });

  // Renderer pushes a targeted single-widget runtime update → broadcast to browser clients
  ipcMain.on('tr:net:runtimePatch', (_e, payload: { widgetId: string; cells: { value: number; active: boolean }[] }) => {
    networkServer.broadcastRuntimeUpdate(payload.widgetId, payload.cells);
  });
}
