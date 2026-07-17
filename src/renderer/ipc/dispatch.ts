import { bridge } from './bridge';
import type { Mapping } from '../../shared/types/mapping';

// ─── Master gains ───────────────────────────────────────────────────────────────
// A MasterLevel widget scales EVERYTHING going out on one protocol by multiplying
// the normalized value before it is scaled to the protocol range. gain 1 = full.
const masterGains: Record<string, number> = {};

export function setMasterGain(protocol: string, gain: number): void {
  masterGains[protocol] = Math.max(0, Math.min(1, gain));
}
export function clearMasterGain(protocol: string): void {
  delete masterGains[protocol];
}
export function resetMasterGains(): void {
  for (const k of Object.keys(masterGains)) delete masterGains[k];
}

// All continuous values (sliders, knobs, XY) enter as normalized 0.0–1.0.
// Buttons use dispatchButton which applies onValue/offValue directly.

export function dispatchValue(mapping: Mapping, value: number): void {
  if (!mapping) return;
  const gain = masterGains[mapping.type] ?? 1;
  const v = Math.max(0, Math.min(1, value)) * gain;

  switch (mapping.type) {
    case 'midi': {
      const scaled = Math.round(v * (mapping.maxValue - mapping.minValue) + mapping.minValue);
      switch (mapping.messageType) {
        case 'controlChange':
          bridge.send('tr:midi:sendCC', { channel: mapping.channel, cc: mapping.number, value: scaled });
          break;
        case 'noteOn':
        case 'noteOff':
          bridge.send('tr:midi:sendNote', { channel: mapping.channel, note: mapping.number, velocity: scaled, on: mapping.messageType === 'noteOn' });
          break;
        case 'pitchBend':
          bridge.send('tr:midi:sendPB', { channel: mapping.channel, value: Math.round(v * 16383) });
          break;
        default:
          bridge.send('tr:midi:sendCC', { channel: mapping.channel, cc: mapping.number, value: scaled });
      }
      break;
    }
    case 'osc': {
      const oscVal = (mapping.minValue !== undefined && mapping.maxValue !== undefined)
        ? v * (mapping.maxValue - mapping.minValue) + mapping.minValue
        : v;
      bridge.send('tr:osc:send', { address: mapping.address, args: [{ type: 'f', value: oscVal }] });
      break;
    }
    case 'artnet': {
      const scaled = Math.round(v * (mapping.maxValue - mapping.minValue) + mapping.minValue);
      bridge.send('tr:artnet:sendChannel', { universe: mapping.universe, channel: mapping.channel, value: scaled });
      break;
    }
    case 'sacn': {
      const scaled = Math.round(v * (mapping.maxValue - mapping.minValue) + mapping.minValue);
      bridge.send('tr:sacn:sendChannel', { universe: mapping.universe, channel: mapping.channel, value: scaled, priority: mapping.priority });
      break;
    }
    case 'enttec': {
      const scaled = Math.round(v * (mapping.maxValue - mapping.minValue) + mapping.minValue);
      bridge.send('tr:enttec:sendChannel', { channel: mapping.channel, value: scaled });
      break;
    }
  }
}

// Buttons bypass normalization — onValue/offValue are already in protocol range.
export function dispatchButton(mapping: Mapping, on: boolean, onValue: number, offValue: number): void {
  if (!mapping) return;
  switch (mapping.type) {
    case 'midi': {
      const value = on ? onValue : offValue;
      if (mapping.messageType === 'noteOn' || mapping.messageType === 'noteOff') {
        bridge.send('tr:midi:sendNote', { channel: mapping.channel, note: mapping.number, velocity: on ? onValue : 0, on });
      } else {
        bridge.send('tr:midi:sendCC', { channel: mapping.channel, cc: mapping.number, value });
      }
      break;
    }
    default:
      dispatchValue(mapping, on ? 1.0 : 0.0);
  }
}
