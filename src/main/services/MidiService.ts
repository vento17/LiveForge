import midi from '@julusian/midi';
import type { MidiPortInfo } from '../../shared/types/runtime';
import type { MidiInputEventPayload, MtcFramePayload } from '../../shared/types/ipc';

export class MidiService {
  private output = new midi.Output();
  private input  = new midi.Input();
  private inputCallback: ((evt: MidiInputEventPayload) => void) | null = null;
  private mtcCallback:   ((frame: MtcFramePayload) => void) | null = null;
  private clockTimer: NodeJS.Timeout | null = null;

  // MTC quarter-frame assembly state
  private mtcPieces: number[] = new Array(8).fill(0);
  private mtcCount = 0;

  constructor() {
    this.input.ignoreTypes(false, true, true); // receive SysEx, skip timing/activeSensing

    this.input.on('message', (_delta, msg) => {
      const status = msg[0];

      // Universal Device Identity Request → reply as APC Mini
      // F0 7E <any> 06 01 F7
      if (status === 0xf0 && msg.length === 6 && msg[1] === 0x7e && msg[3] === 0x06 && msg[4] === 0x01 && msg[5] === 0xf7) {
        this.replyApcMiniIdentity();
        return;
      }

      // MTC Quarter Frame (0xF1)
      if (status === 0xf1 && msg[1] !== undefined) {
        this.parseMtcQF(msg[1]);
        return;
      }

      if (!this.inputCallback) return;
      const data1   = msg[1] ?? 0;
      const data2   = msg[2] ?? 0;
      const ch      = (status & 0x0f) + 1;
      const nibble  = status & 0xf0;

      let messageType: MidiInputEventPayload['messageType'];
      if      (nibble === 0x90) messageType = data2 > 0 ? 'noteOn' : 'noteOff';
      else if (nibble === 0x80) messageType = 'noteOff';
      else if (nibble === 0xb0) messageType = 'controlChange';
      else if (nibble === 0xe0) messageType = 'pitchBend';
      else if (nibble === 0xc0) messageType = 'programChange';
      else if (nibble === 0xa0) messageType = 'aftertouch';
      else return;

      this.inputCallback({ channel: ch, messageType, number: data1, value: data2 });
    });
  }

  private parseMtcQF(data: number): void {
    const msgNum = (data >> 4) & 0x07;
    const nibble = data & 0x0f;

    this.mtcPieces[msgNum] = nibble;
    this.mtcCount++;

    // Emit a frame after every 8 quarter-frames (msgs 0–7 received)
    if (this.mtcCount >= 8 && msgNum === 7) {
      const f = (this.mtcPieces[0] | (this.mtcPieces[1] << 4)) & 0x1f;
      const s = (this.mtcPieces[2] | (this.mtcPieces[3] << 4)) & 0x3f;
      const m = (this.mtcPieces[4] | (this.mtcPieces[5] << 4)) & 0x3f;
      const hRate = (this.mtcPieces[6] | (this.mtcPieces[7] << 4));
      const h   = hRate & 0x1f;
      const rateCode = (hRate >> 5) & 0x03;
      const fps = rateCode === 0 ? 24 : rateCode === 1 ? 25 : rateCode === 2 ? 29.97 : 30;
      if (this.mtcCallback) this.mtcCallback({ h, m, s, f, fps });
      this.mtcCount = 0;
    }
  }

  onMtcFrame(cb: (frame: MtcFramePayload) => void): void {
    this.mtcCallback = cb;
  }

  private replyApcMiniIdentity(): void {
    try {
      // Universal Identity Reply — Akai APC Mini mk1
      // F0 7E 00 06 02  <mfr:47>  <family:28 00>  <member:19 00>  <ver:00 00 00 00>  F7
      this.output.sendMessage([
        0xf0, 0x7e, 0x00, 0x06, 0x02,
        0x47,             // Akai Professional
        0x28, 0x00,       // APC Mini family
        0x19, 0x00,       // device member
        0x00, 0x00, 0x00, 0x00, // firmware version
        0xf7,
      ]);
    } catch (err) {
      console.error('[MidiService] SysEx identity reply failed:', err);
    }
  }

  // ─── Output ──────────────────────────────────────────────────────────────────

  listPorts(): MidiPortInfo[] {
    const count = this.output.getPortCount();
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      name: this.output.getPortName(i),
    }));
  }

  openPort(portName: string, virtual: boolean): { ok: boolean } {
    try {
      this.output.closePort();
      if (virtual) {
        this.output.openVirtualPort(portName);
      } else {
        const match = this.listPorts().find((p) => p.name === portName);
        if (!match) return { ok: false };
        this.output.openPort(match.index);
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  closePort(): void {
    this.output.closePort();
  }

  sendCC(channel: number, cc: number, value: number): void {
    try { this.output.sendMessage([0xb0 | (channel - 1), cc, value]); }
    catch (err) { console.error('[MidiService] sendCC failed:', err); }
  }

  sendNote(channel: number, note: number, velocity: number, on: boolean): void {
    try { this.output.sendMessage([(on ? 0x90 : 0x80) | (channel - 1), note, velocity]); }
    catch (err) { console.error('[MidiService] sendNote failed:', err); }
  }

  sendPitchBend(channel: number, value: number): void {
    try { this.output.sendMessage([0xe0 | (channel - 1), value & 0x7f, (value >> 7) & 0x7f]); }
    catch (err) { console.error('[MidiService] sendPB failed:', err); }
  }

  startClock(bpm: number): void {
    this.stopClock();
    const intervalMs = 60000 / (bpm * 24);
    this.clockTimer = setInterval(() => {
      try { this.output.sendMessage([0xf8]); }
      catch { /* ignore if port closed */ }
    }, intervalMs);
  }

  stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  listInputPorts(): MidiPortInfo[] {
    const count = this.input.getPortCount();
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      name: this.input.getPortName(i),
    }));
  }

  openInputPort(portName: string): { ok: boolean } {
    try {
      this.input.closePort();
      const match = this.listInputPorts().find((p) => p.name === portName);
      if (!match) return { ok: false };
      this.input.openPort(match.index);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  onInputMessage(cb: (evt: MidiInputEventPayload) => void): void {
    this.inputCallback = cb;
  }
}
