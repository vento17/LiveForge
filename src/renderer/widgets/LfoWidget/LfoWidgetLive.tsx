import React, { useEffect, useRef, useState } from 'react';
import type { LfoWidget } from '../../../shared/types/project';
import type { MidiMapping, OscMapping } from '../../../shared/types/mapping';
import { useStore } from '../../store';
import { dispatchValue } from '../../ipc/dispatch';
import { bridge } from '../../ipc/bridge';

function computeLfoValue(waveform: string, phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  switch (waveform) {
    case 'sine':     return (Math.sin(2 * Math.PI * p) + 1) / 2;
    case 'square':   return p < 0.5 ? 1 : 0;
    case 'saw':      return p;
    case 'triangle': return p < 0.5 ? p * 2 : 2 - p * 2;
    case 'random':   return 0; // handled via randomRef
    default:         return (Math.sin(2 * Math.PI * p) + 1) / 2;
  }
}

export default function LfoWidgetLive({ widget }: { widget: LfoWidget }): React.JSX.Element {
  const masterBpm      = useStore((s) => s.masterBpm);
  const globalResetTick = useStore((s) => s.globalResetTick);
  const globalPlayTick  = useStore((s) => s.globalPlayTick);

  const masterBpmRef = useRef(masterBpm);
  masterBpmRef.current = masterBpm;
  const widgetRef = useRef(widget);
  widgetRef.current = widget;

  const accBeatsRef   = useRef(0);
  const lastNowRef    = useRef(0);
  const randomValRef  = useRef(0.5);
  const lastRandomPhaseFloorRef = useRef(-1);

  // Play/stop — starts running (preserves prior free-run behavior); stop freezes.
  const [isPlaying, setIsPlaying] = useState(true);
  const isPlayingRef = useRef(true);
  const playMappingRef = useRef(widget.playMapping ?? null);
  const stopMappingRef = useRef(widget.stopMapping ?? null);
  playMappingRef.current = widget.playMapping ?? null;
  stopMappingRef.current = widget.stopMapping ?? null;

  function startPlaying() { isPlayingRef.current = true;  setIsPlaying(true);  lastNowRef.current = performance.now(); }
  function stopPlaying()  { isPlayingRef.current = false; setIsPlaying(false); }
  const startRef = useRef(startPlaying); startRef.current = startPlaying;
  const stopRef  = useRef(stopPlaying);  stopRef.current  = stopPlaying;

  useEffect(() => {
    let rafId: number;

    function tick(now: number) {
      const dt = now - lastNowRef.current;
      lastNowRef.current = now;
      // Frozen while stopped — hold last value, keep lastNow current so there's
      // no phase jump when it resumes.
      if (!isPlayingRef.current) { rafId = requestAnimationFrame(tick); return; }
      if (dt > 0 && dt < 300) {
        accBeatsRef.current += dt * masterBpmRef.current / 60000;
      }

      const w = widgetRef.current;
      let phase: number;

      if (w.rateMode === 'bpm') {
        phase = (accBeatsRef.current / Math.max(0.001, w.rateMultiplier)) % 1 + w.phase;
      } else {
        const elapsedSec = accBeatsRef.current * 60 / Math.max(1, masterBpmRef.current);
        phase = (elapsedSec * w.rateHz) % 1 + w.phase;
      }

      // sample-and-hold for random
      if (w.waveform === 'random') {
        const floor = Math.floor(phase);
        if (floor !== lastRandomPhaseFloorRef.current) {
          lastRandomPhaseFloorRef.current = floor;
          randomValRef.current = Math.random();
        }
      }

      let raw: number;
      if (w.waveform === 'random') {
        raw = randomValRef.current;
      } else {
        raw = computeLfoValue(w.waveform, phase);
      }

      // Apply amplitude and offset: centre at offset, swing ±amplitude/2
      const value = Math.max(0, Math.min(1, w.offset + (raw - 0.5) * w.amplitude));

      useStore.getState().setCellValue(w.id, 0, value);
      if (w.mapping) dispatchValue(w.mapping, value);

      rafId = requestAnimationFrame(tick);
    }

    lastNowRef.current = performance.now();
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    accBeatsRef.current = 0;
    lastNowRef.current = performance.now();
    lastRandomPhaseFloorRef.current = -1;
  }, [globalResetTick, globalPlayTick]);

  // Play/stop triggers (OSC + MIDI)
  useEffect(() => bridge.on('tr:osc:feedback', (msg) => {
    const pm = playMappingRef.current, sm = stopMappingRef.current;
    if (pm?.type === 'osc' && msg.address === (pm as OscMapping).address) startRef.current();
    if (sm?.type === 'osc' && msg.address === (sm as OscMapping).address) stopRef.current();
  }), []);

  useEffect(() => bridge.on('tr:midi:inputEvent', (evt) => {
    const matches = (m: MidiMapping | null): boolean => {
      if (!m || m.type !== 'midi') return false;
      const isCC   = m.messageType === 'controlChange' && evt.messageType === 'controlChange' && evt.channel === m.channel && evt.number === m.number;
      const isNote = m.messageType === 'noteOn'        && evt.messageType === 'noteOn'        && evt.channel === m.channel && evt.number === m.number;
      return isCC || isNote;
    };
    if (matches(playMappingRef.current as MidiMapping | null)) startRef.current();
    if (matches(stopMappingRef.current as MidiMapping | null)) stopRef.current();
  }), []);

  const color = widget.style.foregroundColor;

  const liveValue = useStore((s) => s.runtime.widgets[widget.id]?.cells[0]?.value ?? 0);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      padding: '6px 8px', boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase' }}>
          ◈ lfo
        </span>
        <button
          style={{ ...lfoBtn, color: isPlaying ? color : 'rgba(255,255,255,0.3)',
            borderColor: isPlaying ? color : 'rgba(255,255,255,0.12)' }}
          onPointerDown={(e) => { e.preventDefault(); startPlaying(); }}
          title="Play"
        >▶</button>
        <button
          style={{ ...lfoBtn, color: !isPlaying ? color : 'rgba(255,255,255,0.3)',
            borderColor: !isPlaying ? color + '99' : 'rgba(255,255,255,0.12)' }}
          onPointerDown={(e) => { e.preventDefault(); stopPlaying(); }}
          title="Stop"
        >■</button>
        <span style={{ fontSize: 10, color, marginLeft: 'auto', fontWeight: 600 }}>
          {waveformIcon(widget.waveform)} {widget.waveform}
        </span>
      </div>

      {/* Value bar */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', position: 'relative', minHeight: 12 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${liveValue * 100}%`,
          background: color,
          opacity: 0.7,
          transition: 'width 0.02s linear',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#999', fontVariantNumeric: 'tabular-nums',
        }}>
          {liveValue.toFixed(3)}
        </div>
      </div>

      <div style={{ fontSize: 9, color: '#444', marginTop: 4, flexShrink: 0 }}>
        {widget.rateMode === 'bpm'
          ? `×${widget.rateMultiplier} beats`
          : `${widget.rateHz} Hz`
        } · amp {widget.amplitude.toFixed(2)} · off {widget.offset.toFixed(2)}
      </div>
    </div>
  );
}

const lfoBtn: React.CSSProperties = {
  minWidth: 22, padding: '2px 5px', borderRadius: 3, fontSize: 11, lineHeight: 1,
  background: 'rgba(0,0,0,0.4)', border: '1px solid', cursor: 'pointer',
  fontFamily: 'inherit', touchAction: 'none', flexShrink: 0,
};

function waveformIcon(wf: string): string {
  switch (wf) {
    case 'sine':     return '∿';
    case 'square':   return '⊓';
    case 'saw':      return '⊿';
    case 'triangle': return '△';
    case 'random':   return '⌇';
    default:         return '∿';
  }
}
