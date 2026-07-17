import type { Widget, ValueDisplayMode, TimelineWidget, TrigTrack } from '../../shared/types/project';
import type { Mapping } from '../../shared/types/mapping';

// Individual trig markers exposed as their own source cells, laid out AFTER the
// per-track cells. Order: track order, then each track's markers in CREATION
// order (the keyframes array is append-only), so a cell index stays put unless
// an earlier marker in the same track is deleted.
export function timelineTrigCells(w: TimelineWidget): { trackIndex: number; markerIndex: number }[] {
  const out: { trackIndex: number; markerIndex: number }[] = [];
  w.tracks.forEach((t, ti) => {
    if (t.kind === 'trig') {
      (t as TrigTrack).keyframes.forEach((_, mi) => out.push({ trackIndex: ti, markerIndex: mi }));
    }
  });
  return out;
}

export function cellCount(widget: Widget): number {
  switch (widget.kind) {
    case 'sliderBank':     return widget.countX * widget.countY;
    case 'buttonGrid':     return widget.countX * widget.countY;
    case 'knobBank':       return widget.countX * widget.countY;
    case 'xyPad':          return 2;
    case 'stepSequencer':  return 1;
    case 'graphWidget':    return 1;
    case 'submasters':     return widget.countX;
    case 'autoBpm':        return 16; // 8 trigger cells (0-7) + 8 ramp cells (8-15)
    case 'timeline':       return widget.tracks.length + timelineTrigCells(widget).length;
    case 'audioAnalyser':  return 21; // 0-4=audio, 5-12=BPM trig, 13-20=BPM ramp
    case 'soundPlayer':    return widget.tracks.length;
    case 'cues':           return widget.cues.length;  // one cell per cue → linkable/slave
    case 'imageWidget':
    case 'textWidget':
    case 'spoutInput':
    case 'ndiInput':
    case 'router':
    case 'valueDisplay':   return 0;
    case 'lfoWidget':      return 1;
    case 'mathWidget':     return 1;
    case 'masterLevel':    return 1;
    case 'instance':       return 0;  // mirrors its source; no own runtime cells
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizedToMidi(value: number, min: number, max: number): number {
  return Math.round(clamp(value, 0, 1) * (max - min) + min);
}

export function normalizedToDmx(value: number, min: number, max: number): number {
  return Math.round(clamp(value, 0, 1) * (max - min) + min);
}

// Format a normalized 0–1 cell value for on-cell display.
// percent → 0–100% · raw → 0.00–1.00 · protocol → scaled per the cell's mapping.
export function formatCellValue(value: number, mapping: Mapping, format: ValueDisplayMode): string {
  if (format === 'percent') return `${Math.round(value * 100)}%`;
  if (format === 'raw')     return value.toFixed(2);
  // protocol
  if (!mapping) return value.toFixed(2);
  if (mapping.type === 'osc') {
    if (mapping.minValue !== undefined && mapping.maxValue !== undefined) {
      return (value * (mapping.maxValue - mapping.minValue) + mapping.minValue).toFixed(1);
    }
    return value.toFixed(2);
  }
  // midi / artnet / sacn / enttec all carry minValue/maxValue
  const m = mapping as { minValue: number; maxValue: number };
  return String(Math.round(value * (m.maxValue - m.minValue) + m.minValue));
}
