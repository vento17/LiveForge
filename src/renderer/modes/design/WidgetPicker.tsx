import React, { useState } from 'react';
import { useStore, useActivePageId } from '../../store';
import type { WidgetKind } from '../../../shared/types/project';

interface WidgetOption {
  kind: WidgetKind;
  label: string;
  description: string;
  full?: boolean;      // spans both columns (stands alone)
  winOnly?: boolean;   // disabled on non-Windows (Spout is Windows-only)
}

// Spout uses a Windows-only native library; disable those widgets off Windows.
const IS_WINDOWS = /Win/i.test(navigator.userAgent) || /Win/i.test(navigator.platform);

// Ordered in pairs, cascading from static → controls → modulators → sequencers →
// audio → video in → routing → masters → scenes, then Value Display + Keyboard,
// with Manual alone on the last line.
const WIDGET_OPTIONS: WidgetOption[] = [
  { kind: 'imageWidget',   label: 'Image',          description: 'PNG/JPG overlay, click-through — sits under or over the widgets.' },
  { kind: 'textWidget',    label: 'Text',           description: 'Static label with custom font, colour, alignment and frame.' },

  { kind: 'sliderBank',    label: 'Slider Bank',    description: 'Bank of vertical or horizontal faders. Each fader maps to its own MIDI/OSC/DMX output.' },
  { kind: 'knobBank',      label: 'Knob Bank',      description: 'Bank of rotary knobs — drag up/right to raise, down/left to lower.' },

  { kind: 'buttonGrid',    label: 'Button Grid',    description: 'Grid of momentary, toggle, pulse or radio buttons with per-cell colours.' },
  { kind: 'xyPad',         label: 'XY Pad',         description: 'Two-axis touch surface — X and Y each drive their own output.' },

  { kind: 'lfoWidget',     label: 'LFO',            description: 'BPM-synced or Hz oscillator (sine/square/saw/triangle/random) with play/stop.' },
  { kind: 'graphWidget',   label: 'Graph',          description: 'Draw your own envelope curve — linear/bezier/square points, looped or one-shot.' },

  { kind: 'stepSequencer', label: 'Step Sequencer', description: 'Programmable step sequencer synced to the master BPM, with RND/MAX/ZERO.' },
  { kind: 'timeline',      label: 'Timeline',       description: 'Multi-track sequencer: value, colour and audio tracks with keyframes.' },

  { kind: 'audioAnalyser', label: 'Audio Analyser', description: 'Kick/snare detection, BPM ramps and bass/mid/high band levels from an audio input.' },
  { kind: 'soundPlayer',   label: 'Sound Player',   description: 'Playlist with per-track play/pause/stop and volume — triggerable from the Router.' },

  { kind: 'spoutInput',    label: 'Spout / Syphon', description: 'Live video from a Spout sender.', winOnly: true },
  { kind: 'ndiInput',      label: 'NDI Input',      description: 'Live video from an NDI source on the network.', winOnly: true },

  { kind: 'router',        label: 'Router',         description: 'Route one cell (or MIDI/OSC input) to many outputs — also holds right-click links.' },
  { kind: 'mathWidget',    label: 'Math / Merge',   description: 'Combine two cell sources with add, subtract, multiply, min, max, avg, invert.' },

  { kind: 'masterLevel',   label: 'Master Level',   description: 'Master fader that scales EVERYTHING going out on one protocol (DMX/OSC/MIDI).' },
  { kind: 'submasters',    label: 'Submasters',     description: 'Multi-scene submaster bank with HTP/LTP merge, record and flash buttons.' },

  { kind: 'cues',          label: 'Cues',           description: 'Snapshot and recall the whole state — values and links — with fade times.' },
  { kind: 'instance',      label: 'Instance',       description: 'Bound copy of another widget — shares the exact same value across pages.' },

  { kind: 'valueDisplay',  label: 'Value Display',  description: 'Read-only numeric readout of any cell from another widget (percent, raw or MIDI).' },
  { kind: 'keyboard',      label: 'Keyboard',       description: 'Bind computer keys as buttons — press the key or tap it on screen. Each key is linkable.' },

  { kind: 'manual',        label: 'Manual',         description: 'Built-in documentation: a tab per settings section and a tab per widget, plus the shortcut list.', full: true },
];

export default function WidgetPicker(): React.JSX.Element {
  const { closeWidgetPicker, addWidget } = useStore((s) => ({
    closeWidgetPicker: s.closeWidgetPicker,
    addWidget: s.addWidget,
  }));
  const activePageId = useActivePageId();
  const [hovered, setHovered] = useState<WidgetOption | null>(null);

  function handlePick(kind: WidgetKind) {
    if (!activePageId) return;
    addWidget(activePageId, kind);
    closeWidgetPicker();
  }

  return (
    <div style={styles.overlay} onClick={closeWidgetPicker}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={{ fontWeight: 600 }}>Add Widget</span>
          <button style={styles.close} onClick={closeWidgetPicker}>✕</button>
        </div>

        {/* Compact title-only cells — descriptions live in the strip below */}
        <div style={styles.grid} onMouseLeave={() => setHovered(null)}>
          {WIDGET_OPTIONS.map((o) => {
            const isHovered = hovered?.kind === o.kind;
            const disabled = !!o.winOnly && !IS_WINDOWS;
            return (
              <button
                key={o.kind}
                disabled={disabled}
                style={{
                  ...styles.card,
                  ...(o.full ? { gridColumn: '1 / -1' } : {}),
                  ...(isHovered ? styles.cardHover : {}),
                  ...(disabled ? styles.cardDisabled : {}),
                }}
                onClick={() => { if (!disabled) handlePick(o.kind); }}
                onMouseEnter={() => setHovered(o)}
              >
                {o.label}{disabled ? '  ·  Windows only' : ''}
              </button>
            );
          })}
        </div>

        {/* Description of the widget under the cursor */}
        <div style={styles.desc}>
          {hovered ? (
            <>
              <div style={styles.descLabel}>{hovered.label}</div>
              <div style={styles.descText}>
                {hovered.description}
                {hovered.winOnly && !IS_WINDOWS && (
                  <span style={{ color: '#d08a3a' }}>  —  Windows only (Spout not available on this OS).</span>
                )}
              </div>
            </>
          ) : (
            <div style={styles.descHint}>hover a widget to see what it does</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    width: 720,
    maxWidth: '95vw',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '92vh',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  close: {
    background: 'none', border: 'none',
    color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: 16,
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 6, padding: 12,
    overflowY: 'auto',
  },
  card: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--color-text)',
    fontSize: 12,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'border-color 0.12s, background 0.12s',
  },
  cardHover: {
    background: 'var(--color-accent-dim, rgba(100,108,255,0.15))',
    border: '1px solid var(--color-accent)',
    color: 'var(--color-accent)',
  },
  cardDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    color: 'var(--color-text-dim)',
  },
  desc: {
    flexShrink: 0,
    borderTop: '1px solid var(--color-border)',
    padding: '10px 16px',
    minHeight: 58,
    background: 'var(--color-surface-2)',
    display: 'flex', flexDirection: 'column', gap: 3,
    justifyContent: 'center',
  },
  descLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--color-accent)',
    letterSpacing: '0.04em',
  },
  descText: {
    fontSize: 11, color: 'var(--color-text-dim)', lineHeight: 1.45,
  },
  descHint: {
    fontSize: 11, color: 'var(--color-text-dim)', opacity: 0.5, fontStyle: 'italic',
  },
};
