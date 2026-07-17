import type { BrowserWindow } from 'electron';
import { registerProjectHandlers } from './projectHandlers';
import { registerMidiHandlers } from './midiHandlers';
import { registerOscHandlers } from './oscHandlers';
import { registerEnttecHandlers } from './enttecHandlers';
import { registerArtNetHandlers } from './artnetHandlers';
import { registerSacnHandlers } from './sacnHandlers';
import { registerWindowHandlers } from './windowHandlers';
import { registerFileHandlers } from './fileHandlers';
import { registerNetworkHandlers } from './networkHandlers';

export function registerAllHandlers(win: BrowserWindow): void {
  registerProjectHandlers();
  registerMidiHandlers(win);
  registerOscHandlers(win);
  registerEnttecHandlers();
  registerArtNetHandlers();
  registerSacnHandlers();
  registerWindowHandlers(win);
  registerFileHandlers(win);
  registerNetworkHandlers(win);
}
