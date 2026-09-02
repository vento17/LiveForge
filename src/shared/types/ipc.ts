import type { Project } from './project';
import type { OscFeedbackMessage, MidiPortInfo } from './runtime';

// ─── IPC Channel Registry ─────────────────────────────────────────────────────
//
// Convention:
//   'tr:domain:action'  — renderer → main (invoke/send)
//   'tr:domain:event'   — main → renderer (on)
//
// Every channel has an explicit request and response type.
// "void" response means fire-and-forget (ipcRenderer.send, not invoke).

export interface IpcChannels {
  // Project
  'tr:project:save':          { req: Project;                    res: { ok: boolean; path: string } };
  'tr:project:load':          { req: void;                       res: Project | null };
  'tr:project:export':        { req: Project;                    res: { ok: boolean; path: string } };
  'tr:project:backup':        { req: Project;                    res: { ok: boolean; path: string } };
  // Crash recovery. autosave overwrites one rolling file; recoverRead returns it
  // with the time it was written; recoverClear drops it once the work is safe.
  'tr:project:autosave':      { req: Project;                    res: { ok: boolean } };
  'tr:project:recoverRead':   { req: void;                       res: { project: Project; savedAt: string } | null };
  'tr:project:recoverClear':  { req: void;                       res: { ok: boolean } };

  // Window
  'tr:window:fullscreen':     { req: boolean;                    res: void };

  // Files
  'tr:file:pickImage':        { req: void;                       res: string | null };
  'tr:file:pickAudio':        { req: void;                       res: { dataUrl: string; fileName: string } | null };

  // MIDI output
  'tr:midi:listPorts':        { req: void;                       res: MidiPortInfo[] };
  'tr:midi:openPort':         { req: { portName: string; virtual: boolean; extraOutputs?: Array<{ id: string; portName: string }> }; res: { ok: boolean } };
  'tr:midi:closePort':        { req: void;                       res: void };
  'tr:midi:sendCC':           { req: MidiCCPayload;              res: void };
  'tr:midi:sendNote':         { req: MidiNotePayload;            res: void };
  'tr:midi:sendPB':           { req: MidiPBPayload;              res: void };
  'tr:midi:clockStart':       { req: { bpm: number };            res: void };
  'tr:midi:clockStop':        { req: void;                       res: void };

  // MIDI input
  'tr:midi:listInputPorts':   { req: void;                       res: MidiPortInfo[] };
  'tr:midi:openInputPort':    { req: { portName: string; extraPorts?: string[] };       res: { ok: boolean } };
  'tr:midi:inputEvent':       { req: never;                      res: MidiInputEventPayload };
  'tr:midi:mtcFrame':         { req: never;                      res: MtcFramePayload };

  // OSC output
  'tr:osc:configure':         { req: OscConfigPayload;           res: { ok: boolean } };
  'tr:osc:disconnect':        { req: void;                       res: { ok: boolean } };
  'tr:osc:send':              { req: OscSendPayload;             res: void };

  // OSC feedback (main → renderer, event)
  'tr:osc:feedback':          { req: never;                      res: OscFeedbackMessage };

  // Sidecar stdout/stderr (main → renderer, event). In a packaged build the
  // sidecar's own output goes nowhere, so a user hitting "stream unavailable"
  // has no way to see WHY. Forward it into the in-app log instead.
  'tr:sidecar:log':           { req: never;                      res: { level: 'info' | 'error'; text: string } };

  // Art-Net
  'tr:artnet:configure':      { req: ArtNetConfigPayload;        res: { ok: boolean } };
  'tr:artnet:sendChannel':    { req: ArtNetChannelPayload;       res: void };
  'tr:artnet:sendUniverse':   { req: ArtNetUniversePayload;      res: void };

  // sACN / E1.31
  'tr:sacn:configure':        { req: SacnConfigPayload;          res: { ok: boolean } };
  'tr:sacn:sendChannel':      { req: SacnChannelPayload;         res: void };
  'tr:sacn:sendUniverse':     { req: SacnUniversePayload;        res: void };

  // Enttec Open DMX USB
  'tr:enttec:listDevices':    { req: void;                       res: EnttecListDevicesRes };
  'tr:enttec:connect':        { req: { deviceIndex: number };    res: { ok: boolean; error?: string } };
  'tr:enttec:disconnect':     { req: void;                       res: { ok: boolean } };
  'tr:enttec:sendChannel':    { req: EnttecChannelPayload;       res: void };

  // Network Live server
  'tr:net:start':             { req: { port: number };           res: { ok: boolean; ip: string; port: number; error?: string } };
  'tr:net:stop':              { req: void;                       res: { ok: boolean } };
  'tr:net:getLocalIP':        { req: void;                       res: string };
  'tr:net:stateChange':       { req: NetStatePayload;            res: void };
  'tr:net:runtimePatch':      { req: { widgetId: string; cells: NetRuntimeCell[] }; res: void };
  'tr:net:switchPage':        { req: never;                      res: string };
  'tr:net:interact':          { req: never;                      res: NetInteractPayload };
}

// Utility types to extract req/res per channel
export type IpcReq<K extends keyof IpcChannels> = IpcChannels[K]['req'];
export type IpcRes<K extends keyof IpcChannels> = IpcChannels[K]['res'];

// ─── MIDI Payloads ────────────────────────────────────────────────────────────

export interface MidiInputEventPayload {
  channel: number;
  messageType: 'noteOn' | 'noteOff' | 'controlChange' | 'pitchBend' | 'programChange' | 'aftertouch';
  number: number;    // note or CC number 0–127
  value: number;     // velocity or CC value 0–127
}

export interface MtcFramePayload {
  h: number;    // hours
  m: number;    // minutes
  s: number;    // seconds
  f: number;    // frames
  fps: number;  // frame rate (24 | 25 | 29.97 | 30)
}

export interface MidiCCPayload {
  channel: number;   // 1–16
  cc: number;        // 0–127
  value: number;     // 0–127
  outputId?: string;
}

export interface MidiNotePayload {
  channel: number;
  note: number;      // 0–127
  velocity: number;  // 0–127
  on: boolean;
  outputId?: string;
}

export interface MidiPBPayload {
  channel: number;
  value: number;     // 0–16383
  outputId?: string;
}

// ─── OSC Payloads ─────────────────────────────────────────────────────────────

export interface OscConfigPayload {
  targetHost: string;
  targetPort: number;
  listenPort: number;
  outputs?: Array<{ id: string; host: string; port: number }>;
  extraListenPorts?: number[];
}

export interface OscSendPayload {
  address: string;
  args: Array<{ type: 'f' | 'i' | 's'; value: number | string }>;
  outputId?: string;
}

// ─── Art-Net Payloads ─────────────────────────────────────────────────────────

export interface ArtNetConfigPayload {
  outputs: Array<{ id: string; host: string }>;
}

export interface ArtNetChannelPayload {
  universe: number;  // 0–32767
  channel: number;   // 1–512
  value: number;     // 0–255
  outputId?: string;
}

// Full universe update — more efficient than per-channel when many channels change at once
export interface ArtNetUniversePayload {
  universe: number;
  // Sparse map: channel (1-based) → value (0–255)
  // Channels not listed keep their last value
  channels: Record<number, number>;
  outputId?: string;
}

// ─── sACN Payloads ────────────────────────────────────────────────────────────

export interface SacnConfigPayload {
  priority: number;
  // Each output: host present = unicast to it, host absent = multicast (per universe).
  outputs: Array<{ id: string; host?: string }>;
}

export interface SacnChannelPayload {
  universe: number;  // 1–63999
  channel: number;   // 1–512
  value: number;     // 0–255
  priority?: number; // overrides connection default if set
  outputId?: string;
}

export interface SacnUniversePayload {
  universe: number;
  channels: Record<number, number>;
  priority?: number;
  outputId?: string;
}

// ─── Enttec Open DMX USB Payloads ─────────────────────────────────────────────

export interface EnttecDeviceInfoPayload {
  index: number;
  description: string;
  serialNumber: string;
}

export interface EnttecListDevicesRes {
  ok: boolean;
  devices: EnttecDeviceInfoPayload[];
  error?: string;
}

export interface EnttecChannelPayload {
  channel: number;  // 1–512
  value: number;    // 0–255
}

// ─── Network Live Payloads ────────────────────────────────────────────────────

export interface NetRuntimeCell {
  value: number;
  active: boolean;
}

// Exact on-screen placement of the page canvas, measured in the renderer (window
// CSS px). Lets the browser client map click coords precisely regardless of the
// live sidebar being open or a page live-offset — no guessing the transform.
export interface NetPageRect {
  x: number;      // window CSS px of page origin (0,0), incl. sidebar + liveOffset
  y: number;      // window CSS px of page origin, incl. global bar + liveOffset
  scale: number;  // page px → window CSS px
}

export interface NetStatePayload {
  pages: import('./project').Page[];
  activePageId: string;
  runtimeWidgets: Record<string, { cells: NetRuntimeCell[] }>;
  dpr?: number; // renderer window.devicePixelRatio — used by main for capturePage() crop
  pageRect?: NetPageRect;
}

export interface NetInteractPayload {
  widgetId: string;
  cellIndex: number;
  value: number;      // 0–1
  active?: boolean;   // for button widgets
}
