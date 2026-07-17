import React, { useState } from 'react';
import { useStore, useActivePage, useProject } from '../../../store';
import type { StoreState } from '../../../store';
import type { MidiConnection, MidiInputConnection, OscConnection, ArtNetConnection, SacnConnection, LtcAudioConnection, AudioOutputConnection, EnttecDmxConnection, ImageWidget, TextWidget, BlendMode, TextFrame, TextAlign, FontWeight, FontStyle, StepSequencerWidget, GraphWidget, XYPadWidget, SpeedMultiplier, WidgetStyle, ButtonGridWidget, ButtonBehavior, KnobBankWidget, CuesWidget, TimelineWidget, RouterWidget, RouterRow, RouterOutput, RouterInputType, AutoBpmWidget, BeatOutput, LfoWidget, MathWidget, MathOperation, LfoWaveform, ValueDisplayWidget, ValueDisplayFormat } from '../../../../shared/types/project';
import { BEAT_DIVISORS } from '../../../../shared/types/project';
import type { Mapping, MidiMapping, OscMapping, EnttecDmxMapping, ArtNetMapping, SacnMapping } from '../../../../shared/types/mapping';
import { bridge } from '../../../ipc/bridge';
import { dispatchValue, dispatchButton } from '../../../ipc/dispatch';
import logoUrl from '../../../assets/Logo.png';
import { GLOBAL_BAR_HEIGHT } from '../../GlobalBar';

export default function Inspector(): React.JSX.Element {
  const { selectedWidgetId, updateWidget, updateWidgetRect, activePageId, isSettingsOpen } = useStore((s) => ({
    selectedWidgetId: s.selectedWidgetId,
    updateWidget: s.updateWidget,
    updateWidgetRect: s.updateWidgetRect,
    activePageId: s.activePageId,
    isSettingsOpen: s.isSettingsOpen,
  }));
  const page = useActivePage();
  const widget = page?.widgets.find((w) => w.id === selectedWidgetId);

  return (
    <div style={styles.panel}>
      {isSettingsOpen
        ? <SettingsPanel />
        : widget && activePageId
          ? widget.kind === 'imageWidget'
            ? <ImagePanel widget={widget as ImageWidget} activePageId={activePageId} updateWidget={updateWidget} />
            : widget.kind === 'textWidget'
              ? <TextPanel widget={widget as TextWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
              : widget.kind === 'stepSequencer'
                ? <StepSequencerPanel widget={widget as StepSequencerWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                : widget.kind === 'graphWidget'
                  ? <GraphPanel widget={widget as GraphWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                  : widget.kind === 'xyPad'
                    ? <XYPadPanel widget={widget as XYPadWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                    : widget.kind === 'cues'
                      ? <CuesInspectorPanel widget={widget as CuesWidget} activePageId={activePageId} updateWidget={updateWidget} />
                      : widget.kind === 'timeline'
                        ? <TimelineInspectorPanel widget={widget as TimelineWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                        : widget.kind === 'spoutInput'
                          ? <SpoutInputInspectorPanel widget={widget as import('../../../../shared/types/project').SpoutInputWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                          : widget.kind === 'ndiInput'
                            ? <NdiInputInspectorPanel widget={widget as import('../../../../shared/types/project').NdiInputWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                            : widget.kind === 'submasters'
                              ? <SubmastersInspectorPanel widget={widget as import('../../../../shared/types/project').SubmastersWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                              : widget.kind === 'autoBpm'
                                ? <AutoBpmInspectorPanel widget={widget as AutoBpmWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                : widget.kind === 'audioAnalyser'
                                  ? <AudioAnalyserInspectorPanel widget={widget as import('../../../../shared/types/project').AudioAnalyserWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                  : widget.kind === 'soundPlayer'
                                    ? <SoundPlayerInspectorPanel widget={widget as import('../../../../shared/types/project').SoundPlayerWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                    : widget.kind === 'router'
                                      ? <RouterInspectorPanel widget={widget as import('../../../../shared/types/project').RouterWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                      : widget.kind === 'lfoWidget'
                                        ? <LfoInspectorPanel widget={widget as LfoWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                        : widget.kind === 'mathWidget'
                                          ? <MathInspectorPanel widget={widget as MathWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                          : widget.kind === 'valueDisplay'
                                            ? <ValueDisplayInspectorPanel widget={widget as ValueDisplayWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                            : widget.kind === 'masterLevel'
                                              ? <MasterLevelInspectorPanel widget={widget as import('../../../../shared/types/project').MasterLevelWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                              : widget.kind === 'instance'
                                                ? <InstanceInspectorPanel widget={widget as import('../../../../shared/types/project').InstanceWidget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
                                                : <WidgetPanel widget={widget} activePageId={activePageId} updateWidget={updateWidget} updateWidgetRect={updateWidgetRect} />
          : <NoSelectionPanel />
      }
    </div>
  );
}

// ─── Widget selected ──────────────────────────────────────────────────────────

function WidgetPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: NonNullable<ReturnType<typeof useActivePage> extends null ? never : ReturnType<typeof useActivePage>>['widgets'][number];
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const { updateWidgetCounts, resetCellMappings, resetCellNames, resetCellColors, setOutputProtocol } = useStore((s) => ({
    updateWidgetCounts: s.updateWidgetCounts,
    resetCellMappings: s.resetCellMappings,
    resetCellNames: s.resetCellNames,
    resetCellColors: s.resetCellColors,
    setOutputProtocol: s.setOutputProtocol,
  }));

  const project = useProject();
  const [apcConflicts, setApcConflicts] = useState<string[]>([]);

  const isBankWidget = widget.kind !== 'xyPad';
  const bankWidget = isBankWidget ? widget as { countX: number; countY: number; spacingX: number; spacingY: number } : null;

  function patch(partial: Record<string, unknown>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  function patchStyle(partial: Partial<typeof widget.style>) {
    patch({ style: { ...widget.style, ...partial } });
  }

  function applyApcMiniPreset() {
    const bw = widget as ButtonGridWidget;
    const newCells = Array.from({ length: 64 }, (_, i) => {
      const row = Math.floor(i / 8);
      const col = i % 8;
      const note = (7 - row) * 8 + col;
      const existing = bw.cells[i];
      return {
        label: existing?.label ?? String(note),
        color: existing?.color,
        behavior: (existing?.behavior ?? 'toggle') as ButtonBehavior,
        onValue: existing?.onValue ?? 127,
        offValue: existing?.offValue ?? 0,
        feedbackRules: existing?.feedbackRules ?? [],
        mapping: {
          type: 'midi' as const,
          messageType: 'noteOn' as const,
          channel: 1,
          number: note,
          minValue: 0,
          maxValue: 127,
        } as MidiMapping,
      };
    });
    const apcNoteSet = new Set(Array.from({ length: 64 }, (_, i) => i));
    const conflicts: string[] = [];
    for (const page of project.pages) {
      for (const w of page.widgets) {
        if (w.id === widget.id) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wCells: Array<{ mapping?: Mapping }> = (w as any).cells ?? [];
        const wMappings: Mapping[] = [w.mapping, ...wCells.map((c) => c?.mapping ?? null)];
        for (const m of wMappings) {
          if (!m || m.type !== 'midi') continue;
          if (m.messageType !== 'noteOn' && m.messageType !== 'noteOff') continue;
          if (m.channel !== 1) continue;
          if (apcNoteSet.has(m.number)) {
            conflicts.push(`${page.name} › ${w.label || w.kind} (note ${m.number})`);
            break;
          }
        }
      }
    }
    setApcConflicts(conflicts);
    updateWidget(activePageId, widget.id, { countX: 8, countY: 8, cells: newCells } as never);
  }

  return (
    <>
      <div style={styles.header}>{widget.kind}</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X">
            <NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} />
          </Field>
          <Field label="Y">
            <NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="W">
            <NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} />
          </Field>
          <Field label="H">
            <NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} />
          </Field>
        </Row>
      </Section>

      {bankWidget && (
        <Section label="Grid">
          <Row>
            <Field label="Cols (X)">
              <NumInput value={bankWidget.countX} onChange={(v) => updateWidgetCounts(activePageId, widget.id, Math.max(1, v), bankWidget.countY)} />
            </Field>
            <Field label="Rows (Y)">
              <NumInput value={bankWidget.countY} onChange={(v) => updateWidgetCounts(activePageId, widget.id, bankWidget.countX, Math.max(1, v))} />
            </Field>
          </Row>
          <Row>
            <Field label="Gap X (px)">
              <NumInput value={bankWidget.spacingX} onChange={(v) => patch({ spacingX: Math.max(0, v) })} />
            </Field>
            <Field label="Gap Y (px)">
              <NumInput value={bankWidget.spacingY} onChange={(v) => patch({ spacingY: Math.max(0, v) })} />
            </Field>
          </Row>
        </Section>
      )}

      {widget.kind === 'knobBank' && (
        <Section label="Knob size">
          <NumInput
            value={(widget as KnobBankWidget).knobSize ?? 56}
            onChange={(v) => patch({ knobSize: Math.max(20, Math.min(200, v)) })}
          />
        </Section>
      )}

      <Section label="Style">
        <Row>
          <Field label="BG">
            <ColorInput value={widget.style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} />
          </Field>
          <Field label="FG (default)">
            <ColorInput value={widget.style.foregroundColor} onChange={(v) => patchStyle({ foregroundColor: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Label col.">
            <ColorInput value={widget.style.labelColor} onChange={(v) => patchStyle({ labelColor: v })} />
          </Field>
          <Field label="Radius">
            <NumInput value={widget.style.borderRadius} onChange={(v) => patchStyle({ borderRadius: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Font size">
            <NumInput value={widget.style.fontSize} onChange={(v) => patchStyle({ fontSize: v })} />
          </Field>
          <Field label="Show labels">
            <input type="checkbox" checked={widget.style.showLabel}
              onChange={(e) => patchStyle({ showLabel: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
        </Row>
        <Row>
          <Field label="Show value">
            <input type="checkbox" checked={widget.style.showValue ?? false}
              onChange={(e) => patchStyle({ showValue: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
          <Field label="Value format">
            <select style={styles.input} value={widget.style.valueFormat ?? 'percent'}
              onChange={(e) => patchStyle({ valueFormat: e.target.value as 'percent' | 'raw' | 'protocol' })}>
              <option value="percent">Percent %</option>
              <option value="raw">Raw 0–1</option>
              <option value="protocol">Protocol</option>
            </select>
          </Field>
        </Row>
      </Section>

      {isBankWidget && (
        <Section label="Output protocol">
          <select
            style={styles.input}
            value={widget.outputProtocol}
            onChange={(e) => setOutputProtocol(activePageId, widget.id, e.target.value as import('../../../../shared/types/project').OutputProtocol)}
          >
            <option value="midi">MIDI</option>
            <option value="osc">OSC</option>
            <option value="enttec">Enttec Open DMX USB</option>
            <option value="artnet">Art-Net (DMX)</option>
            <option value="sacn">sACN / E1.31 (DMX)</option>
          </select>
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 5 }}>
            Changes protocol and resets cell mappings to defaults.
          </div>
        </Section>
      )}

      <FrameSection style={widget.style} patchStyle={patchStyle} />

      {widget.kind === 'buttonGrid' && (
        <>
          <Section label="Button behavior">
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6 }}>
              Set all cells to:
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(() => {
                const bw = widget as ButtonGridWidget;
                const normalized = bw.cells.map((c) => (c.behavior === 'momentary' || !c.behavior) ? 'pulse' : c.behavior);
                const activeBehavior = normalized.length > 0 && normalized.every((b) => b === normalized[0]) ? normalized[0] : null;
                return (['pulse', 'toggle', 'radio'] as ButtonBehavior[]).map((b) => {
                  const isActive = activeBehavior === b;
                  return (
                    <button key={b} onClick={() => {
                      const newCells = bw.cells.map((c) => ({ ...c, behavior: b }));
                      updateWidget(activePageId, widget.id, { cells: newCells } as never);
                    }} style={{
                      padding: '4px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                      background: isActive ? '#ffffff' : 'var(--color-surface-2)',
                      border: `1px solid ${isActive ? '#ffffff' : 'var(--color-border)'}`,
                      color: isActive ? '#000000' : 'var(--color-text)',
                      textTransform: 'capitalize',
                    }}>{b}</button>
                  );
                });
              })()}
            </div>
          </Section>

          <Section label="APC Mini">
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6 }}>
              Configura 8×8 grid, Note On ch 1, layout APC Mini.<br />
              Rinomina la porta loopMidi a <strong style={{ color: 'var(--color-text)' }}>"APC MINI"</strong>.
            </div>
            <ResetBtn onClick={applyApcMiniPreset}>
              ⬛ Apply APC Mini layout
            </ResetBtn>
            {apcConflicts.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 10, color: '#e6a000', lineHeight: 1.5 }}>
                ⚠ Altri widget usano ch 1 note 0–63:
                {apcConflicts.map((c, idx) => (
                  <div key={idx} style={{ paddingLeft: 8 }}>· {c}</div>
                ))}
                <div style={{ marginTop: 4, color: 'var(--color-text-dim)' }}>
                  I bottoni APC hanno precedenza sulle note in conflitto.
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {isBankWidget && (
        <Section label="Reset">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ResetBtn onClick={() => resetCellMappings(activePageId, widget.id)}>
              ↺ Auto channel index
            </ResetBtn>
            <ResetBtn onClick={() => resetCellNames(activePageId, widget.id)}>
              ↺ Reset names
            </ResetBtn>
            <ResetBtn onClick={() => resetCellColors(activePageId, widget.id)}>
              ↺ Reset colors (use FG default)
            </ResetBtn>
          </div>
        </Section>
      )}

      {(widget.kind === 'sliderBank' || widget.kind === 'knobBank' || widget.kind === 'buttonGrid' || widget.kind === 'xyPad') && (
        <Section label="Trigger">
          <ResetBtn onClick={() => {
            const wr = useStore.getState().runtime.widgets[widget.id];
            if (widget.kind === 'sliderBank' || widget.kind === 'knobBank') {
              for (let i = 0; i < widget.cells.length; i++) {
                dispatchValue(widget.cells[i]?.mapping ?? widget.mapping, wr?.cells[i]?.value ?? 0);
              }
            } else if (widget.kind === 'buttonGrid') {
              for (let i = 0; i < widget.cells.length; i++) {
                const cell = widget.cells[i];
                dispatchButton(cell?.mapping ?? widget.mapping, wr?.cells[i]?.active ?? false, cell?.onValue ?? 127, cell?.offValue ?? 0);
              }
            } else if (widget.kind === 'xyPad') {
              dispatchValue(widget.mappingX, wr?.cells[0]?.value ?? 0);
              dispatchValue(widget.mappingY, wr?.cells[1]?.value ?? 0);
            }
          }}>
            ↦ Send all current values
          </ResetBtn>
        </Section>
      )}
    </>
  );
}

function ResetBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--color-surface-2)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-dim)',
      borderRadius: 'var(--radius-sm)',
      padding: '4px 8px',
      fontSize: 11, cursor: 'pointer',
      textAlign: 'left',
    }}>
      {children}
    </button>
  );
}

// ─── Timeline inspector panel ────────────────────────────────────────────────

function TimelineInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: TimelineWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<TimelineWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }
  return (
    <>
      <div style={styles.header}>Timeline</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Playback">
        <Row>
          <Field label="Duration (s)">
            <NumInput value={widget.duration} onChange={(v) => patch({ duration: Math.max(1, v) })} />
          </Field>
          <Field label="Loop">
            <input type="checkbox" checked={widget.loopMode === 'loop'}
              onChange={(e) => patch({ loopMode: e.target.checked ? 'loop' : 'none' })}
              style={{ marginTop: 6 }} />
          </Field>
        </Row>
      </Section>
      <Section label="Play trigger">
        <MappingEditor mapping={widget.playMapping} onChange={(m) => patch({ playMapping: m })} />
      </Section>
      <Section label="Stop trigger">
        <MappingEditor mapping={widget.stopMapping} onChange={(m) => patch({ stopMapping: m })} />
      </Section>
      <Section label="Timecode sync">
        <Row>
          <Field label="Source">
            <select style={styles.input} value={widget.timecodeSource ?? 'off'}
              onChange={(e) => patch({ timecodeSource: e.target.value as 'off' | 'ltc' | 'mtc' })}>
              <option value="off">Off</option>
              <option value="ltc">LTC (audio)</option>
              <option value="mtc">MTC (MIDI)</option>
            </select>
          </Field>
        </Row>
        {(widget.timecodeSource === 'ltc' || widget.timecodeSource === 'mtc') && (
          <Row>
            <Field label="Frame rate">
              <select style={styles.input} value={widget.timecodeFrameRate ?? 25}
                onChange={(e) => patch({ timecodeFrameRate: Number(e.target.value) as 24 | 25 | 29.97 | 30 })}>
                <option value={24}>24 fps</option>
                <option value={25}>25 fps</option>
                <option value={29.97}>29.97 fps</option>
                <option value={30}>30 fps</option>
              </select>
            </Field>
          </Row>
        )}
      </Section>
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', padding: '8px 12px', lineHeight: 1.5 }}>
        {widget.tracks.length} track{widget.tracks.length !== 1 ? 's' : ''}.
        <br />Manage tracks in Live mode.
      </div>
    </>
  );
}

// ─── Cues inspector panel ─────────────────────────────────────────────────────

type NavKey = 'navFirst' | 'navPrev' | 'navNext' | 'navRandom' | 'navLast';
const NAV_BUTTONS: { key: NavKey; label: string; defaultAddr: string }[] = [
  { key: 'navFirst',  label: '⏮ First',   defaultAddr: '/cue/first'  },
  { key: 'navPrev',   label: '◀ Prev',    defaultAddr: '/cue/prev'   },
  { key: 'navNext',   label: 'Next ▶',    defaultAddr: '/cue/next'   },
  { key: 'navRandom', label: '✦ Random',  defaultAddr: '/cue/random' },
  { key: 'navLast',   label: 'Last ⏭',   defaultAddr: '/cue/last'   },
];

function CuesInspectorPanel({ widget, activePageId, updateWidget }: {
  widget: CuesWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
}) {
  function patch(partial: Record<string, unknown>) {
    updateWidget(activePageId, widget.id, partial as never);
  }
  return (
    <>
      <div style={styles.header}>cues</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <div style={{ fontSize: 11, color: 'var(--color-text-dim)', padding: '8px 12px', lineHeight: 1.5 }}>
        {widget.cues.length} cue{widget.cues.length !== 1 ? 's' : ''} saved. Manage in Live mode.
        <br />OSC trigger: /<em>cuename</em>
      </div>
      <Section label="Navigation mappings">
        {NAV_BUTTONS.map(({ key, label, defaultAddr }) => {
          const m = widget[key];
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
              <select
                style={{ ...styles.input, marginBottom: 4 }}
                value={m?.type ?? 'none'}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'none') patch({ [key]: null });
                  else if (t === 'midi') patch({ [key]: { type: 'midi', messageType: 'controlChange', channel: 1, number: 0, minValue: 0, maxValue: 127 } });
                  else patch({ [key]: { type: 'osc', address: defaultAddr } });
                }}
              >
                <option value="none">Off</option>
                <option value="midi">MIDI</option>
                <option value="osc">OSC</option>
              </select>
              {m?.type === 'midi' && (
                <Row>
                  <Field label="Ch.">
                    <NumInput value={(m as MidiMapping).channel} onChange={(v) => patch({ [key]: { ...m, channel: Math.max(1, Math.min(16, v)) } })} />
                  </Field>
                  <Field label="CC / Note">
                    <NumInput value={(m as MidiMapping).number} onChange={(v) => patch({ [key]: { ...m, number: Math.max(0, Math.min(127, v)) } })} />
                  </Field>
                </Row>
              )}
              {m?.type === 'osc' && (
                <input
                  style={styles.input}
                  value={(m as OscMapping).address}
                  onChange={(e) => patch({ [key]: { ...m, address: e.target.value } })}
                  placeholder="/address"
                />
              )}
            </div>
          );
        })}
      </Section>
    </>
  );
}

// ─── Image widget panel ───────────────────────────────────────────────────────

const BLEND_MODES: BlendMode[] = [
  'normal','screen','multiply','overlay','difference',
  'exclusion','hard-light','soft-light','color-dodge','color-burn',
  'luminosity','hue','saturation','color',
];

function ImagePanel({ widget, activePageId, updateWidget }: {
  widget: ImageWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
}) {
  function patch(partial: Partial<ImageWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  async function pickImage() {
    try {
      const dataUrl = await bridge.invoke('tr:file:pickImage', undefined as never);
      if (dataUrl) patch({ src: dataUrl });
    } catch (err) {
      console.error('pickImage failed:', err);
    }
  }

  return (
    <>
      <div style={styles.header}>Image</div>

      <Section label="File">
        <div style={{
          fontSize: 10, color: 'var(--color-text-dim)',
          marginBottom: 6, wordBreak: 'break-all',
        }}>
          {widget.src ? 'Image loaded' : 'No image selected'}
        </div>
        <button onClick={pickImage} style={{ ...styles.input, cursor: 'pointer', textAlign: 'left', background: 'var(--color-surface-2)' }}>
          Pick image…
        </button>
        {widget.src && (
          <button onClick={() => patch({ src: '' })} style={{ ...styles.input, cursor: 'pointer', marginTop: 4, color: 'var(--color-accent)', background: 'var(--color-surface-2)' }}>
            Clear
          </button>
        )}
      </Section>

      <Section label="Layer">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['under', 'over'] as const).map((l) => (
            <button key={l} onClick={() => patch({ layer: l })} style={{
              flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer', borderRadius: 3,
              background: widget.layer === l ? 'var(--color-accent)' : 'var(--color-surface-2)',
              border: `1px solid ${widget.layer === l ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: widget.layer === l ? '#000' : 'var(--color-text)',
              textTransform: 'capitalize',
            }}>{l}</button>
          ))}
        </div>
      </Section>

      <Section label="Blend Mode">
        <select style={styles.input} value={widget.blendMode}
          onChange={(e) => patch({ blendMode: e.target.value as BlendMode })}>
          {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Section>

      <Section label="Opacity">
        <Row>
          <Field label={`${Math.round(widget.opacity * 100)}%`}>
            <input type="range" min={0} max={1} step={0.01}
              value={widget.opacity}
              onChange={(e) => patch({ opacity: Number(e.target.value) })}
              style={{ width: '100%' }} />
          </Field>
        </Row>
      </Section>
    </>
  );
}

// ─── Text widget panel ────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  { label: 'System sans-serif', value: 'sans-serif' },
  { label: 'System serif',      value: 'serif' },
  { label: 'Monospace',         value: 'monospace' },
  { label: 'Impact',            value: 'Impact, sans-serif' },
  { label: 'Arial',             value: 'Arial, sans-serif' },
  { label: 'Georgia',           value: 'Georgia, serif' },
  { label: 'Custom…',           value: '__custom__' },
];

function TextPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: TextWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const [customFont, setCustomFont] = useState('');

  function patch(partial: Partial<TextWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  const isCustomFont = !FONT_FAMILIES.some((f) => f.value === widget.fontFamily && f.value !== '__custom__');

  return (
    <>
      <div style={styles.header}>Text</div>

      <Section label="Content">
        <textarea
          style={{ ...styles.input, height: 72, resize: 'vertical', fontFamily: 'inherit' }}
          value={widget.text}
          onChange={(e) => patch({ text: e.target.value })}
        />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X">
            <NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} />
          </Field>
          <Field label="Y">
            <NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="W">
            <NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} />
          </Field>
          <Field label="H">
            <NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} />
          </Field>
        </Row>
      </Section>

      <Section label="Font">
        <Field label="Family">
          <select style={styles.input}
            value={isCustomFont ? '__custom__' : widget.fontFamily}
            onChange={(e) => {
              if (e.target.value === '__custom__') return;
              patch({ fontFamily: e.target.value });
            }}>
            {FONT_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        {isCustomFont && (
          <Field label="Custom font name">
            <input style={styles.input}
              value={customFont || widget.fontFamily}
              onChange={(e) => setCustomFont(e.target.value)}
              onBlur={() => { if (customFont) patch({ fontFamily: customFont }); }}
              placeholder="e.g. Roboto, Arial" />
          </Field>
        )}
        <Row>
          <Field label="Size (px)">
            <NumInput value={widget.style.fontSize}
              onChange={(v) => updateWidget(activePageId, widget.id, { style: { ...widget.style, fontSize: v } } as never)} />
          </Field>
          <Field label="Align">
            <select style={styles.input} value={widget.textAlign}
              onChange={(e) => patch({ textAlign: e.target.value as TextAlign })}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Weight">
            <select style={styles.input} value={widget.fontWeight}
              onChange={(e) => patch({ fontWeight: e.target.value as FontWeight })}>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </Field>
          <Field label="Style">
            <select style={styles.input} value={widget.fontStyle}
              onChange={(e) => patch({ fontStyle: e.target.value as FontStyle })}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </Field>
        </Row>
      </Section>

      <Section label="Color">
        <Field label="Text color">
          <ColorInput value={widget.textColor} onChange={(v) => patch({ textColor: v })} />
        </Field>
      </Section>

      <Section label="Frame">
        <Field label="Type">
          <select style={styles.input} value={widget.frame}
            onChange={(e) => patch({ frame: e.target.value as TextFrame })}>
            <option value="none">None</option>
            <option value="outline">Outline (border)</option>
            <option value="underline">Underline</option>
          </select>
        </Field>
        {widget.frame !== 'none' && (
          <Row>
            <Field label="Color">
              <ColorInput value={widget.frameColor} onChange={(v) => patch({ frameColor: v })} />
            </Field>
            <Field label="Size (px)">
              <NumInput value={widget.frameSize} onChange={(v) => patch({ frameSize: Math.max(1, v) })} />
            </Field>
          </Row>
        )}
      </Section>

      <Section label="Layer">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['under', 'over'] as const).map((l) => (
            <button key={l} onClick={() => patch({ layer: l })} style={{
              flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer', borderRadius: 3,
              background: widget.layer === l ? 'var(--color-accent)' : 'var(--color-surface-2)',
              border: `1px solid ${widget.layer === l ? 'var(--color-accent)' : 'var(--color-border)'}`,
              color: widget.layer === l ? '#000' : 'var(--color-text)',
              textTransform: 'capitalize',
            }}>{l}</button>
          ))}
        </div>
      </Section>
    </>
  );
}

// ─── Step Sequencer panel ─────────────────────────────────────────────────────

const SPEED_OPTIONS: { label: string; value: SpeedMultiplier }[] = [
  { label: '1/8', value: 0.125 },
  { label: '1/4', value: 0.25  },
  { label: '1/2', value: 0.5   },
  { label: '1x',  value: 1     },
  { label: '2x',  value: 2     },
  { label: '4x',  value: 4     },
  { label: '8x',  value: 8     },
];

const STEP_COUNT_OPTIONS = [4, 8, 16, 32];

function StepSequencerPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: StepSequencerWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<StepSequencerWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  function patchStyle(partial: Partial<typeof widget.style>) {
    patch({ style: { ...widget.style, ...partial } });
  }

  function handleStepCountChange(newCount: number) {
    const oldSteps = widget.steps;
    const newSteps = Array.from({ length: newCount }, (_, i) =>
      i < oldSteps.length ? oldSteps[i] : { active: false, value: 1 }
    );
    patch({ stepCount: newCount, steps: newSteps });
  }

  function handleAllOn() {
    patch({ steps: widget.steps.map((s) => ({ ...s, active: true })) });
  }

  function handleAllOff() {
    patch({ steps: widget.steps.map((s) => ({ ...s, active: false })) });
  }

  function handleAllValue(v: number) {
    patch({ steps: widget.steps.map((s) => ({ ...s, value: v })) });
  }

  return (
    <>
      <div style={styles.header}>Step Sequencer</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X">
            <NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} />
          </Field>
          <Field label="Y">
            <NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="W">
            <NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} />
          </Field>
          <Field label="H">
            <NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} />
          </Field>
        </Row>
      </Section>

      <Section label="Sequencer">
        <Field label="Steps">
          <div style={{ display: 'flex', gap: 4 }}>
            {STEP_COUNT_OPTIONS.map((n) => (
              <button key={n} onClick={() => handleStepCountChange(n)} style={{
                flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                background: widget.stepCount === n ? 'var(--color-accent)' : 'var(--color-surface-2)',
                border: `1px solid ${widget.stepCount === n ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: widget.stepCount === n ? '#fff' : 'var(--color-text)',
              }}>{n}</button>
            ))}
          </div>
        </Field>
        <Field label="Default speed">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SPEED_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => patch({ speedMultiplier: value })} style={{
                padding: '3px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                background: widget.speedMultiplier === value ? 'var(--color-accent)' : 'var(--color-surface-2)',
                border: `1px solid ${widget.speedMultiplier === value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: widget.speedMultiplier === value ? '#fff' : 'var(--color-text)',
              }}>{label}</button>
            ))}
          </div>
        </Field>
      </Section>

      <Section label="Step pattern">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row>
            <ResetBtn onClick={handleAllOn}>All on</ResetBtn>
            <ResetBtn onClick={handleAllOff}>All off</ResetBtn>
          </Row>
          <Row>
            <ResetBtn onClick={() => handleAllValue(1)}>Values → full</ResetBtn>
            <ResetBtn onClick={() => handleAllValue(0.5)}>Values → half</ResetBtn>
          </Row>
        </div>
      </Section>

      <Section label="Style">
        <Row>
          <Field label="BG">
            <ColorInput value={widget.style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} />
          </Field>
          <Field label="FG">
            <ColorInput value={widget.style.foregroundColor} onChange={(v) => patchStyle({ foregroundColor: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Font size">
            <NumInput value={widget.style.fontSize} onChange={(v) => patchStyle({ fontSize: v })} />
          </Field>
          <Field label="Show labels">
            <input type="checkbox" checked={widget.style.showLabel}
              onChange={(e) => patchStyle({ showLabel: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
        </Row>
        <Row>
          <Field label="Show value">
            <input type="checkbox" checked={widget.style.showValue ?? false}
              onChange={(e) => patchStyle({ showValue: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
          <Field label="Value format">
            <select style={styles.input} value={widget.style.valueFormat ?? 'percent'}
              onChange={(e) => patchStyle({ valueFormat: e.target.value as 'percent' | 'raw' | 'protocol' })}>
              <option value="percent">Percent %</option>
              <option value="raw">Raw 0–1</option>
              <option value="protocol">Protocol</option>
            </select>
          </Field>
        </Row>
      </Section>

      <Section label="Output protocol">
        <select
          style={styles.input}
          value={widget.outputProtocol}
          onChange={(e) => {
            const proto = e.target.value as import('../../../../shared/types/project').OutputProtocol;
            let mapping: import('../../../../shared/types/mapping').Mapping;
            if (proto === 'midi') {
              mapping = { type: 'midi', messageType: 'controlChange', channel: 1, number: 0, minValue: 0, maxValue: 127 };
            } else if (proto === 'osc') {
              mapping = { type: 'osc', address: '/seq/1' };
            } else if (proto === 'enttec') {
              mapping = { type: 'enttec', channel: 1, minValue: 0, maxValue: 255 };
            } else if (proto === 'artnet') {
              mapping = { type: 'artnet', universe: 0, channel: 1, minValue: 0, maxValue: 255 };
            } else {
              mapping = { type: 'sacn', universe: 1, channel: 1, minValue: 0, maxValue: 255, priority: 100 };
            }
            patch({ outputProtocol: proto, mapping } as never);
          }}
        >
          <option value="midi">MIDI</option>
          <option value="osc">OSC</option>
          <option value="enttec">Enttec Open DMX USB</option>
          <option value="artnet">Art-Net (DMX)</option>
          <option value="sacn">sACN / E1.31 (DMX)</option>
        </select>
      </Section>

      <Section label="Mapping">
        {widget.mapping?.type === 'midi' && (
          <>
            <Row>
              <Field label="Channel">
                <NumInput value={widget.mapping.channel} onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(16, v)) } } as never)} />
              </Field>
              <Field label="CC / Note">
                <NumInput value={widget.mapping.number} onChange={(v) => patch({ mapping: { ...widget.mapping!, number: Math.max(0, Math.min(127, v)) } } as never)} />
              </Field>
            </Row>
            <Row>
              <Field label="Min">
                <NumInput value={widget.mapping.minValue} onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
              </Field>
              <Field label="Max">
                <NumInput value={widget.mapping.maxValue} onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
              </Field>
            </Row>
          </>
        )}
        {widget.mapping?.type === 'osc' && (
          <Field label="Address">
            <input style={styles.input} value={(widget.mapping as import('../../../../shared/types/mapping').OscMapping).address}
              onChange={(e) => patch({ mapping: { ...widget.mapping!, address: e.target.value } } as never)} />
          </Field>
        )}
        {widget.mapping?.type === 'enttec' && (
          <Row>
            <Field label="Channel">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).channel}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(512, v)) } } as never)} />
            </Field>
            <Field label="Min">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).minValue}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
            </Field>
            <Field label="Max">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).maxValue}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
            </Field>
          </Row>
        )}
        {(widget.mapping?.type === 'artnet' || widget.mapping?.type === 'sacn') && (
          <>
            <Row>
              <Field label="Universe">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).universe}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, universe: v } } as never)} />
              </Field>
              <Field label="Channel">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).channel}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(512, v)) } } as never)} />
              </Field>
            </Row>
            <Row>
              <Field label="Min">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).minValue}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
              </Field>
              <Field label="Max">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).maxValue}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
              </Field>
            </Row>
          </>
        )}
      </Section>

      <FrameSection style={widget.style} patchStyle={(p) => patch({ style: { ...widget.style, ...p } } as never)} />
    </>
  );
}

// ─── Graph widget panel ───────────────────────────────────────────────────────

function GraphPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: GraphWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<GraphWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  function patchStyle(partial: Partial<typeof widget.style>) {
    patch({ style: { ...widget.style, ...partial } });
  }

  return (
    <>
      <div style={styles.header}>Graph</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X">
            <NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} />
          </Field>
          <Field label="Y">
            <NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="W">
            <NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} />
          </Field>
          <Field label="H">
            <NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} />
          </Field>
        </Row>
      </Section>

      <Section label="Playback">
        <Field label="Timing">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['bpm', 'manual'] as const).map((m) => (
              <button key={m} onClick={() => patch({ timingMode: m })} style={{
                flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                background: (widget.timingMode ?? 'bpm') === m ? 'var(--color-accent)' : 'var(--color-surface-2)',
                border: `1px solid ${(widget.timingMode ?? 'bpm') === m ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: (widget.timingMode ?? 'bpm') === m ? '#fff' : 'var(--color-text)',
              }}>{m === 'bpm' ? 'BPM' : 'Manual (sec)'}</button>
            ))}
          </div>
        </Field>

        <Field label="Mode">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['loop', 'once'] as const).map((m) => (
              <button key={m} onClick={() => patch({ playMode: m })} style={{
                flex: 1, padding: '4px 0', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                background: (widget.playMode ?? 'loop') === m ? 'var(--color-accent)' : 'var(--color-surface-2)',
                border: `1px solid ${(widget.playMode ?? 'loop') === m ? 'var(--color-accent)' : 'var(--color-border)'}`,
                color: (widget.playMode ?? 'loop') === m ? '#fff' : 'var(--color-text)',
                textTransform: 'capitalize' as const,
              }}>{m}</button>
            ))}
          </div>
        </Field>

        {(widget.timingMode ?? 'bpm') === 'bpm' && (
          <Field label="Speed">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SPEED_OPTIONS.map(({ label, value }) => (
                <button key={value} onClick={() => patch({ speedMultiplier: value })} style={{
                  padding: '3px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3,
                  background: widget.speedMultiplier === value ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  border: `1px solid ${widget.speedMultiplier === value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  color: widget.speedMultiplier === value ? '#fff' : 'var(--color-text)',
                }}>{label}</button>
              ))}
            </div>
          </Field>
        )}

        {(widget.timingMode ?? 'bpm') === 'manual' && (
          <Field label="Duration (seconds)">
            <NumInput
              value={widget.manualDuration ?? 4}
              onChange={(v) => patch({ manualDuration: Math.max(0.1, Math.round(v * 10) / 10) })}
            />
          </Field>
        )}
      </Section>

      <Section label="Play Trigger">
        <TriggerField
          mapping={widget.playMapping ?? null}
          defaultAddress="/graph/play"
          onChange={(m) => patch({ playMapping: m })}
        />
      </Section>

      <Section label="Stop Trigger">
        <TriggerField
          mapping={widget.stopMapping ?? null}
          defaultAddress="/graph/stop"
          onChange={(m) => patch({ stopMapping: m })}
        />
      </Section>

      <Section label="Reverse Trigger">
        <TriggerField
          mapping={widget.reverseMapping ?? null}
          defaultAddress="/graph/rev"
          onChange={(m) => patch({ reverseMapping: m })}
        />
      </Section>

      <Section label="Style">
        <Row>
          <Field label="BG">
            <ColorInput value={widget.style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} />
          </Field>
          <Field label="FG">
            <ColorInput value={widget.style.foregroundColor} onChange={(v) => patchStyle({ foregroundColor: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Font size">
            <NumInput value={widget.style.fontSize} onChange={(v) => patchStyle({ fontSize: v })} />
          </Field>
          <Field label="Show hints">
            <input type="checkbox" checked={widget.style.showLabel}
              onChange={(e) => patchStyle({ showLabel: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
        </Row>
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />

      <Section label="Output protocol">
        <select
          style={styles.input}
          value={widget.outputProtocol}
          onChange={(e) => {
            const proto = e.target.value as import('../../../../shared/types/project').OutputProtocol;
            let mapping: import('../../../../shared/types/mapping').Mapping;
            if (proto === 'midi') {
              mapping = { type: 'midi', messageType: 'controlChange', channel: 1, number: 0, minValue: 0, maxValue: 127 };
            } else if (proto === 'osc') {
              mapping = { type: 'osc', address: '/graph/1' };
            } else if (proto === 'enttec') {
              mapping = { type: 'enttec', channel: 1, minValue: 0, maxValue: 255 };
            } else if (proto === 'artnet') {
              mapping = { type: 'artnet', universe: 0, channel: 1, minValue: 0, maxValue: 255 };
            } else {
              mapping = { type: 'sacn', universe: 1, channel: 1, minValue: 0, maxValue: 255, priority: 100 };
            }
            patch({ outputProtocol: proto, mapping } as never);
          }}
        >
          <option value="midi">MIDI</option>
          <option value="osc">OSC</option>
          <option value="enttec">Enttec Open DMX USB</option>
          <option value="artnet">Art-Net (DMX)</option>
          <option value="sacn">sACN / E1.31 (DMX)</option>
        </select>
      </Section>

      <Section label="Mapping">
        {widget.mapping?.type === 'midi' && (
          <>
            <Row>
              <Field label="Channel">
                <NumInput value={widget.mapping.channel} onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(16, v)) } } as never)} />
              </Field>
              <Field label="CC / Note">
                <NumInput value={widget.mapping.number} onChange={(v) => patch({ mapping: { ...widget.mapping!, number: Math.max(0, Math.min(127, v)) } } as never)} />
              </Field>
            </Row>
            <Row>
              <Field label="Min">
                <NumInput value={widget.mapping.minValue} onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
              </Field>
              <Field label="Max">
                <NumInput value={widget.mapping.maxValue} onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
              </Field>
            </Row>
          </>
        )}
        {widget.mapping?.type === 'osc' && (
          <Field label="Address">
            <input style={styles.input} value={(widget.mapping as import('../../../../shared/types/mapping').OscMapping).address}
              onChange={(e) => patch({ mapping: { ...widget.mapping!, address: e.target.value } } as never)} />
          </Field>
        )}
        {widget.mapping?.type === 'enttec' && (
          <Row>
            <Field label="Channel">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).channel}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(512, v)) } } as never)} />
            </Field>
            <Field label="Min">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).minValue}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
            </Field>
            <Field label="Max">
              <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).maxValue}
                onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
            </Field>
          </Row>
        )}
        {(widget.mapping?.type === 'artnet' || widget.mapping?.type === 'sacn') && (
          <>
            <Row>
              <Field label="Universe">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).universe}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, universe: v } } as never)} />
              </Field>
              <Field label="Channel">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).channel}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, channel: Math.max(1, Math.min(512, v)) } } as never)} />
              </Field>
            </Row>
            <Row>
              <Field label="Min">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).minValue}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, minValue: v } } as never)} />
              </Field>
              <Field label="Max">
                <NumInput value={(widget.mapping as import('../../../../shared/types/mapping').ArtNetMapping).maxValue}
                  onChange={(v) => patch({ mapping: { ...widget.mapping!, maxValue: v } } as never)} />
              </Field>
            </Row>
          </>
        )}
      </Section>
    </>
  );
}

// ─── XY Pad panel ────────────────────────────────────────────────────────────

function makeDefaultMapping(proto: string, num: number): Mapping {
  if (proto === 'midi')   return { type: 'midi', messageType: 'controlChange', channel: 1, number: num, minValue: 0, maxValue: 127 };
  if (proto === 'osc')    return { type: 'osc', address: `/xy/${num === 0 ? 'x' : 'y'}` };
  if (proto === 'enttec') return { type: 'enttec', channel: num + 1, minValue: 0, maxValue: 255 };
  if (proto === 'artnet') return { type: 'artnet', universe: 0, channel: num + 1, minValue: 0, maxValue: 255 };
  return { type: 'sacn', universe: 1, channel: num + 1, minValue: 0, maxValue: 255, priority: 100 };
}

function MappingEditor({ mapping, onChange }: {
  mapping: Mapping;
  onChange: (m: Mapping) => void;
}) {
  const proto = mapping?.type ?? 'midi';
  return (
    <>
      <Field label="Protocol">
        <select style={styles.input} value={proto}
          onChange={(e) => onChange(makeDefaultMapping(e.target.value, mapping?.type === 'midi' ? (mapping as import('../../../../shared/types/mapping').MidiMapping).number : 0))}>
          <option value="midi">MIDI</option>
          <option value="osc">OSC</option>
          <option value="enttec">Enttec Open DMX USB</option>
          <option value="artnet">Art-Net (DMX)</option>
          <option value="sacn">sACN / E1.31 (DMX)</option>
        </select>
      </Field>
      {mapping?.type === 'midi' && (
        <>
          <Row>
            <Field label="Ch.">
              <NumInput value={mapping.channel} onChange={(v) => onChange({ ...mapping, channel: Math.max(1, Math.min(16, v)) })} />
            </Field>
            <Field label="CC / Note">
              <NumInput value={mapping.number} onChange={(v) => onChange({ ...mapping, number: Math.max(0, Math.min(127, v)) })} />
            </Field>
          </Row>
          <Row>
            <Field label="Min">
              <NumInput value={mapping.minValue} onChange={(v) => onChange({ ...mapping, minValue: v })} />
            </Field>
            <Field label="Max">
              <NumInput value={mapping.maxValue} onChange={(v) => onChange({ ...mapping, maxValue: v })} />
            </Field>
          </Row>
        </>
      )}
      {mapping?.type === 'osc' && (
        <Field label="Address">
          <input style={styles.input} value={(mapping as import('../../../../shared/types/mapping').OscMapping).address}
            onChange={(e) => onChange({ ...mapping, address: e.target.value })} />
        </Field>
      )}
      {mapping?.type === 'enttec' && (
        <Row>
          <Field label="Channel">
            <NumInput value={(mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).channel}
              onChange={(v) => onChange({ ...mapping, channel: Math.max(1, Math.min(512, v)) } as never)} />
          </Field>
          <Field label="Min">
            <NumInput value={(mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).minValue}
              onChange={(v) => onChange({ ...mapping, minValue: v } as never)} />
          </Field>
          <Field label="Max">
            <NumInput value={(mapping as import('../../../../shared/types/mapping').EnttecDmxMapping).maxValue}
              onChange={(v) => onChange({ ...mapping, maxValue: v } as never)} />
          </Field>
        </Row>
      )}
      {(mapping?.type === 'artnet' || mapping?.type === 'sacn') && (
        <>
          <Row>
            <Field label="Universe">
              <NumInput value={(mapping as import('../../../../shared/types/mapping').ArtNetMapping).universe}
                onChange={(v) => onChange({ ...mapping, universe: v } as never)} />
            </Field>
            <Field label="Channel">
              <NumInput value={(mapping as import('../../../../shared/types/mapping').ArtNetMapping).channel}
                onChange={(v) => onChange({ ...mapping, channel: Math.max(1, Math.min(512, v)) } as never)} />
            </Field>
          </Row>
          <Row>
            <Field label="Min">
              <NumInput value={(mapping as import('../../../../shared/types/mapping').ArtNetMapping).minValue}
                onChange={(v) => onChange({ ...mapping, minValue: v } as never)} />
            </Field>
            <Field label="Max">
              <NumInput value={(mapping as import('../../../../shared/types/mapping').ArtNetMapping).maxValue}
                onChange={(v) => onChange({ ...mapping, maxValue: v } as never)} />
            </Field>
          </Row>
        </>
      )}
    </>
  );
}

function XYPadPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: XYPadWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<XYPadWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }
  function patchStyle(partial: Partial<typeof widget.style>) {
    patch({ style: { ...widget.style, ...partial } });
  }

  return (
    <>
      <div style={styles.header}>XY Pad</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="Options">
        <Row>
          <Field label="Crosshair">
            <input type="checkbox" checked={widget.showCrosshair}
              onChange={(e) => patch({ showCrosshair: e.target.checked })} style={{ marginTop: 6 }} />
          </Field>
          <Field label="Invert X">
            <input type="checkbox" checked={widget.invertX}
              onChange={(e) => patch({ invertX: e.target.checked })} style={{ marginTop: 6 }} />
          </Field>
          <Field label="Invert Y">
            <input type="checkbox" checked={widget.invertY}
              onChange={(e) => patch({ invertY: e.target.checked })} style={{ marginTop: 6 }} />
          </Field>
        </Row>
      </Section>

      <Section label="X Axis">
        <MappingEditor mapping={widget.mappingX} onChange={(m) => patch({ mappingX: m })} />
      </Section>

      <Section label="Y Axis">
        <MappingEditor mapping={widget.mappingY} onChange={(m) => patch({ mappingY: m })} />
      </Section>

      <Section label="Style">
        <Row>
          <Field label="BG"><ColorInput value={widget.style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} /></Field>
          <Field label="FG"><ColorInput value={widget.style.foregroundColor} onChange={(v) => patchStyle({ foregroundColor: v })} /></Field>
        </Row>
        <Row>
          <Field label="Radius">
            <NumInput value={widget.style.borderRadius} onChange={(v) => patchStyle({ borderRadius: v })} />
          </Field>
          <Field label="Show label">
            <input type="checkbox" checked={widget.style.showLabel}
              onChange={(e) => patchStyle({ showLabel: e.target.checked })} style={{ marginTop: 6 }} />
          </Field>
        </Row>
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── Settings panel (⚙ button) ───────────────────────────────────────────────

type ConnStatus = 'idle' | 'ok' | 'error' | 'disconnected';

function StatusBadge({ status }: { status: ConnStatus }) {
  if (status === 'idle') return null;
  const color = status === 'ok' ? '#4caf50' : '#f44336';
  const label = status === 'ok' ? 'connected' : status === 'error' ? 'error' : 'disconnected';
  return (
    <span style={{ fontSize: 10, marginLeft: 8, color }}>● {label}</span>
  );
}

function ConnectBtn({ onClick, children, disconnect, disabled }: {
  onClick: () => void;
  children: React.ReactNode;
  disconnect?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        marginTop: 8, width: '100%',
        background: disabled ? 'var(--color-surface-2)' : disconnect ? '#c0392b' : 'var(--color-accent)',
        border: 'none',
        color: disabled ? 'var(--color-text-dim)' : disconnect ? '#fff' : '#000',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const RESOLUTION_PRESETS = [
  { label: '1920×1080 (16:9)',        width: 1920, height: 1030 },
  { label: '1920×1200 (16:10)',       width: 1920, height: 1150 },
  { label: '2560×1440 (16:9)',        width: 2560, height: 1390 },
  { label: '1280×800 (16:10)',        width: 1280, height: 750  },
  { label: '1280×720 (16:9)',         width: 1280, height: 670  },
  { label: '1024×768 (4:3)',          width: 1024, height: 718  },
  { label: '1080×1920 (portrait)',    width: 1080, height: 1870 },
  { label: '390×844 (iPhone)',        width: 390,  height: 794  },
  { label: '412×915 (Android)',       width: 412,  height: 865  },
  { label: 'Custom',                  width: 0,    height: 0    },
] as const;

function SettingsPanel() {
  const project = useProject();
  const page = useActivePage();
  const { setProjectName, setConnection, setPageSize, setPageLiveOffset, setTapTriggerMapping, setResetTriggerMapping, setConnectedProtocol, connectedProtocols } = useStore((s) => ({
    setProjectName:          s.setProjectName,
    setConnection:           s.setConnection,
    setPageSize:             s.setPageSize,
    setPageLiveOffset:       s.setPageLiveOffset,
    setTapTriggerMapping:    s.setTapTriggerMapping,
    setResetTriggerMapping:  s.setResetTriggerMapping,
    setConnectedProtocol:    s.setConnectedProtocol,
    connectedProtocols:      s.connectedProtocols,
  }));

  const [midiStatus,      setMidiStatus]      = useState<ConnStatus>(connectedProtocols['midi']      ? 'ok' : 'idle');
  const [midiInputStatus, setMidiInputStatus] = useState<ConnStatus>(connectedProtocols['midiInput'] ? 'ok' : 'idle');
  const [oscStatus,       setOscStatus]       = useState<ConnStatus>(connectedProtocols['osc']       ? 'ok' : 'idle');
  const [artnetStatus,    setArtnetStatus]    = useState<ConnStatus>(connectedProtocols['artnet']    ? 'ok' : 'idle');
  const [sacnStatus,      setSacnStatus]      = useState<ConnStatus>(connectedProtocols['sacn']      ? 'ok' : 'idle');
  const [enttecStatus,    setEnttecStatus]    = useState<ConnStatus>(connectedProtocols['enttec']    ? 'ok' : 'idle');
  const [midiPorts,       setMidiPorts]       = useState<string[] | null>(null);
  const [midiInputPorts,  setMidiInputPorts]  = useState<string[] | null>(null);
  const [enttecDevices,   setEnttecDevices]   = useState<{ index: number; description: string; serialNumber: string }[] | null>(null);

  const conn = {
    midi:        project.connections.find((c) => c.type === 'midi')        as MidiConnection        | undefined,
    midiInput:   project.connections.find((c) => c.type === 'midiInput')   as MidiInputConnection   | undefined,
    osc:         project.connections.find((c) => c.type === 'osc')         as OscConnection         | undefined,
    artnet:      project.connections.find((c) => c.type === 'artnet')      as ArtNetConnection      | undefined,
    sacn:        project.connections.find((c) => c.type === 'sacn')        as SacnConnection        | undefined,
    enttecDmx:   project.connections.find((c) => c.type === 'enttecDmx')  as EnttecDmxConnection   | undefined,
    ltcAudio:    project.connections.find((c) => c.type === 'ltcAudio')    as LtcAudioConnection    | undefined,
    audioOutput: project.connections.find((c) => c.type === 'audioOutput') as AudioOutputConnection | undefined,
  };

  const [audioDevices,    setAudioDevices]    = React.useState<MediaDeviceInfo[]>([]);
  const [audioOutDevices, setAudioOutDevices] = React.useState<MediaDeviceInfo[]>([]);

  async function listAudioInputs() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    } catch { /* permission denied */ }
  }

  async function listAudioOutputs() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioOutDevices(devices.filter((d) => d.kind === 'audiooutput'));
    } catch { /* permission denied */ }
  }

  const tapMapping    = project.tapTriggerMapping;
  const resetMapping  = project.resetTriggerMapping;

  const tapType: string =
    !tapMapping                                                           ? 'none'
    : tapMapping.type === 'osc'                                           ? 'osc'
    : (tapMapping as MidiMapping).messageType === 'controlChange'         ? 'midi-cc'
    :                                                                       'midi-note';

  const resetType: string =
    !resetMapping                                                             ? 'none'
    : resetMapping.type === 'osc'                                             ? 'osc'
    : (resetMapping as MidiMapping).messageType === 'controlChange'           ? 'midi-cc'
    :                                                                           'midi-note';

  function handleTapTypeChange(t: string) {
    if (t === 'none')           setTapTriggerMapping(null);
    else if (t === 'osc')       setTapTriggerMapping({ type: 'osc', address: '/tap' });
    else if (t === 'midi-cc')   setTapTriggerMapping({ type: 'midi', messageType: 'controlChange', channel: 1, number: 36, minValue: 0, maxValue: 127 });
    else if (t === 'midi-note') setTapTriggerMapping({ type: 'midi', messageType: 'noteOn',        channel: 1, number: 36, minValue: 0, maxValue: 127 });
  }

  function handleResetTypeChange(t: string) {
    if (t === 'none')           setResetTriggerMapping(null);
    else if (t === 'osc')       setResetTriggerMapping({ type: 'osc', address: '/reset' });
    else if (t === 'midi-cc')   setResetTriggerMapping({ type: 'midi', messageType: 'controlChange', channel: 1, number: 37, minValue: 0, maxValue: 127 });
    else if (t === 'midi-note') setResetTriggerMapping({ type: 'midi', messageType: 'noteOn',        channel: 1, number: 37, minValue: 0, maxValue: 127 });
  }

  async function connectMidi() {
    const portName = conn.midi?.portName ?? '';
    const virtual  = conn.midi?.virtualPort ?? false;
    if (!portName) return;
    try {
      const res = await bridge.invoke('tr:midi:openPort', { portName, virtual });
      const status = res.ok ? 'ok' : 'error';
      setMidiStatus(status);
      if (status === 'ok') setConnectedProtocol('midi', true);
    } catch {
      setMidiStatus('error');
    }
  }

  async function connectMidiInput() {
    const portName = conn.midiInput?.portName ?? '';
    if (!portName) return;
    try {
      const res = await bridge.invoke('tr:midi:openInputPort', { portName });
      const status = res.ok ? 'ok' : 'error';
      setMidiInputStatus(status);
      if (status === 'ok') setConnectedProtocol('midiInput', true);
    } catch {
      setMidiInputStatus('error');
    }
  }

  async function connectOsc() {
    try {
      const res = await bridge.invoke('tr:osc:configure', {
        targetHost: conn.osc?.targetHost ?? '127.0.0.1',
        targetPort: conn.osc?.targetPort ?? 8000,
        listenPort: conn.osc?.listenPort ?? 9000,
      });
      const status = res.ok ? 'ok' : 'error';
      setOscStatus(status);
      if (status === 'ok') setConnectedProtocol('osc', true);
    } catch {
      setOscStatus('error');
    }
  }

  async function connectArtnet() {
    const an = conn.artnet;
    if (!an?.targetHost) return;
    try {
      const res = await bridge.invoke('tr:artnet:configure', { targetHost: an.targetHost });
      const status = res.ok ? 'ok' : 'error';
      setArtnetStatus(status);
      if (status === 'ok') setConnectedProtocol('artnet', true);
    } catch {
      setArtnetStatus('error');
    }
  }

  async function connectSacn() {
    const sacn = conn.sacn;
    try {
      const res = await bridge.invoke('tr:sacn:configure', {
        mode: sacn?.mode ?? 'multicast',
        priority: sacn?.priority ?? 100,
        targetHost: sacn?.targetHost,
      });
      const status = res.ok ? 'ok' : 'error';
      setSacnStatus(status);
      if (status === 'ok') setConnectedProtocol('sacn', true);
    } catch {
      setSacnStatus('error');
    }
  }

  async function disconnectMidi() {
    try { await bridge.invoke('tr:midi:closePort', undefined as never); } catch { /* ignore */ }
    setMidiStatus('disconnected');
    setConnectedProtocol('midi', false);
  }

  function disconnectMidiInput() {
    setMidiInputStatus('disconnected');
    setConnectedProtocol('midiInput', false);
  }

  async function disconnectOsc() {
    try { await bridge.invoke('tr:osc:disconnect', undefined as never); } catch { /* ignore */ }
    setOscStatus('disconnected');
    setConnectedProtocol('osc', false);
  }

  function disconnectArtnet() {
    setArtnetStatus('disconnected');
    setConnectedProtocol('artnet', false);
  }

  function disconnectSacn() {
    setSacnStatus('disconnected');
    setConnectedProtocol('sacn', false);
  }

  async function connectEnttec() {
    const idx = conn.enttecDmx?.deviceIndex ?? 0;
    try {
      const res = await bridge.invoke('tr:enttec:connect', { deviceIndex: idx });
      const status = res.ok ? 'ok' : 'error';
      setEnttecStatus(status);
      if (status === 'ok') setConnectedProtocol('enttec', true);
    } catch {
      setEnttecStatus('error');
    }
  }

  async function disconnectEnttec() {
    try { await bridge.invoke('tr:enttec:disconnect', undefined as never); } catch { /* ignore */ }
    setEnttecStatus('disconnected');
    setConnectedProtocol('enttec', false);
  }

  return (
    <>
      <img src={logoUrl} alt="LiveForge" style={{ width: '100%', display: 'block', marginBottom: 6, objectFit: 'contain' }} />
      <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--color-text-dim)', marginBottom: 16, letterSpacing: 0.5 }}>developed by VENTO in 2026</div>
      <div style={styles.header}>Settings</div>

      <Section label="Project">
        <Field label="Name">
          <input style={styles.input} value={project.name}
            onChange={(e) => setProjectName(e.target.value)} />
        </Field>
      </Section>

      <Section label="Trigger">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6 }}>
          Send current values of all controls across every page.
        </div>
        <ResetBtn onClick={() => {
          const { runtime } = useStore.getState();
          for (const pg of project.pages) {
            for (const w of pg.widgets) {
              const wr = runtime.widgets[w.id];
              if (w.kind === 'sliderBank' || w.kind === 'knobBank') {
                for (let i = 0; i < w.cells.length; i++) {
                  dispatchValue(w.cells[i]?.mapping ?? w.mapping, wr?.cells[i]?.value ?? 0);
                }
              } else if (w.kind === 'buttonGrid') {
                for (let i = 0; i < w.cells.length; i++) {
                  const cell = w.cells[i];
                  dispatchButton(cell?.mapping ?? w.mapping, wr?.cells[i]?.active ?? false, cell?.onValue ?? 127, cell?.offValue ?? 0);
                }
              } else if (w.kind === 'xyPad') {
                dispatchValue(w.mappingX, wr?.cells[0]?.value ?? 0);
                dispatchValue(w.mappingY, wr?.cells[1]?.value ?? 0);
              }
            }
          }
        }}>
          ↦ Trigger all widgets (all pages)
        </ResetBtn>
      </Section>

      {page && (
        <CollapsibleSection label="Canvas Resolution">
          <Field label="Preset">
            <select
              style={styles.input}
              value={RESOLUTION_PRESETS.find((p) => p.width === page.width && p.height === page.height)?.label ?? 'Custom'}
              onChange={(e) => {
                const preset = RESOLUTION_PRESETS.find((p) => p.label === e.target.value);
                if (preset && preset.width > 0) setPageSize(page.id, preset.width, preset.height);
              }}
            >
              {RESOLUTION_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Row>
            <Field label="Width">
              <NumInput value={page.width} onChange={(v) => setPageSize(page.id, Math.max(320, v), page.height)} />
            </Field>
            <Field label="Screen height">
              <NumInput value={page.height + GLOBAL_BAR_HEIGHT} onChange={(v) => setPageSize(page.id, page.width, Math.max(240, v - GLOBAL_BAR_HEIGHT))} />
            </Field>
          </Row>
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2 }}>
            Enter your screen height — {GLOBAL_BAR_HEIGHT}px reserved for the top bar.
          </div>
          <Row>
            <Field label="Live X">
              <NumInput value={page.liveOffsetX ?? 0} onChange={(v) => setPageLiveOffset(page.id, v, page.liveOffsetY ?? 0)} />
            </Field>
            <Field label="Live Y">
              <NumInput value={page.liveOffsetY ?? 0} onChange={(v) => setPageLiveOffset(page.id, page.liveOffsetX ?? 0, v)} />
            </Field>
          </Row>
        </CollapsibleSection>
      )}

      <CollapsibleSection label="Tempo">
        <Field label="Tap source">
          <select style={styles.input} value={tapType} onChange={(e) => handleTapTypeChange(e.target.value)}>
            <option value="none">None (manual only)</option>
            <option value="osc">OSC message</option>
            <option value="midi-cc">MIDI CC</option>
            <option value="midi-note">MIDI Note</option>
          </select>
        </Field>
        {tapMapping?.type === 'osc' && (
          <Field label="OSC address">
            <input style={styles.input}
              value={(tapMapping as OscMapping).address}
              onChange={(e) => setTapTriggerMapping({ ...(tapMapping as OscMapping), address: e.target.value })} />
          </Field>
        )}
        {tapMapping?.type === 'midi' && (
          <Row>
            <Field label="Channel">
              <NumInput
                value={(tapMapping as MidiMapping).channel}
                onChange={(v) => setTapTriggerMapping({ ...(tapMapping as MidiMapping), channel: Math.max(1, Math.min(16, v)) })} />
            </Field>
            <Field label={(tapMapping as MidiMapping).messageType === 'noteOn' ? 'Note' : 'CC'}>
              <NumInput
                value={(tapMapping as MidiMapping).number}
                onChange={(v) => setTapTriggerMapping({ ...(tapMapping as MidiMapping), number: Math.max(0, Math.min(127, v)) })} />
            </Field>
          </Row>
        )}
        {tapMapping === null && (
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 4 }}>
            Use ↺ TAP in the top bar.
          </div>
        )}

        <Field label="Reset source">
          <select style={styles.input} value={resetType} onChange={(e) => handleResetTypeChange(e.target.value)}>
            <option value="none">None (↺ button only)</option>
            <option value="osc">OSC message</option>
            <option value="midi-cc">MIDI CC</option>
            <option value="midi-note">MIDI Note</option>
          </select>
        </Field>
        {resetMapping?.type === 'osc' && (
          <Field label="OSC address">
            <input style={styles.input}
              value={(resetMapping as OscMapping).address}
              onChange={(e) => setResetTriggerMapping({ ...(resetMapping as OscMapping), address: e.target.value })} />
          </Field>
        )}
        {resetMapping?.type === 'midi' && (
          <Row>
            <Field label="Channel">
              <NumInput
                value={(resetMapping as MidiMapping).channel}
                onChange={(v) => setResetTriggerMapping({ ...(resetMapping as MidiMapping), channel: Math.max(1, Math.min(16, v)) })} />
            </Field>
            <Field label={(resetMapping as MidiMapping).messageType === 'noteOn' ? 'Note' : 'CC'}>
              <NumInput
                value={(resetMapping as MidiMapping).number}
                onChange={(v) => setResetTriggerMapping({ ...(resetMapping as MidiMapping), number: Math.max(0, Math.min(127, v)) })} />
            </Field>
          </Row>
        )}
      </CollapsibleSection>

      <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0 16px' }} />

      <CollapsibleSection label="MIDI Output">
        <Field label="Port name">
          <input style={styles.input}
            placeholder="e.g. loopMIDI port, hardware synth"
            value={conn.midi?.portName ?? ''}
            onChange={(e) => { setMidiStatus('idle'); setConnection({ type: 'midi', portName: e.target.value, virtualPort: false }); }} />
        </Field>
        <button
          onClick={async () => {
            const ports = await bridge.invoke('tr:midi:listPorts', undefined as never);
            setMidiPorts(ports.map((p) => p.name));
          }}
          style={{ ...styles.input, cursor: 'pointer', marginTop: 6, textAlign: 'left', background: 'var(--color-surface-2)' }}
        >
          List available ports
        </button>
        {midiPorts !== null && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-dim)' }}>
            {midiPorts.length === 0
              ? 'No MIDI output ports found'
              : midiPorts.map((name, i) => (
                  <div
                    key={i}
                    style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3,
                      background: name === conn.midi?.portName ? 'var(--color-accent)' : 'transparent',
                      color: name === conn.midi?.portName ? '#fff' : 'inherit' }}
                    onClick={() => { setMidiStatus('idle'); setConnection({ type: 'midi', portName: name, virtualPort: false }); }}
                  >
                    {name}
                  </div>
                ))
            }
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ConnectBtn
            onClick={midiStatus === 'ok' ? disconnectMidi : connectMidi}
            disconnect={midiStatus === 'ok'}
            disabled={midiStatus !== 'ok' && !(conn.midi?.portName)}
          >
            {midiStatus === 'ok' ? 'Disconnect MIDI' : conn.midi?.portName ? 'Connect MIDI' : 'Enter port name to connect'}
          </ConnectBtn>
          <StatusBadge status={midiStatus} />
        </div>
      </CollapsibleSection>

      <MidiClockSection />

      <CollapsibleSection label="MIDI Input">
        <Field label="Port name">
          <input style={styles.input}
            placeholder="e.g. Launchpad"
            value={conn.midiInput?.portName ?? ''}
            onChange={(e) => { setMidiInputStatus('idle'); setConnection({ type: 'midiInput', portName: e.target.value }); }} />
        </Field>
        <button
          onClick={async () => {
            const ports = await bridge.invoke('tr:midi:listInputPorts', undefined as never);
            setMidiInputPorts(ports.map((p) => p.name));
          }}
          style={{ ...styles.input, cursor: 'pointer', marginTop: 6, textAlign: 'left', background: 'var(--color-surface-2)' }}
        >
          List available ports
        </button>
        {midiInputPorts !== null && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-dim)' }}>
            {midiInputPorts.length === 0
              ? 'No MIDI input ports found'
              : midiInputPorts.map((name, i) => (
                  <div key={i}
                    style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 1,
                      background: name === conn.midiInput?.portName ? 'var(--color-accent)' : 'transparent',
                      color: name === conn.midiInput?.portName ? '#000' : 'inherit' }}
                    onClick={() => { setMidiInputStatus('idle'); setConnection({ type: 'midiInput', portName: name }); }}
                  >
                    {name}
                  </div>
                ))
            }
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ConnectBtn
            onClick={midiInputStatus === 'ok' ? disconnectMidiInput : connectMidiInput}
            disconnect={midiInputStatus === 'ok'}
            disabled={midiInputStatus !== 'ok' && !(conn.midiInput?.portName)}
          >
            {midiInputStatus === 'ok' ? 'Disconnect MIDI In' : conn.midiInput?.portName ? 'Connect MIDI In' : 'Enter port name to connect'}
          </ConnectBtn>
          <StatusBadge status={midiInputStatus} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="OSC">
        <Field label="Destination IP">
          <input style={styles.input}
            placeholder="e.g. 192.168.1.100"
            value={conn.osc?.targetHost ?? '127.0.0.1'}
            onChange={(e) => { setOscStatus('idle'); setConnection({ type: 'osc', targetHost: e.target.value, targetPort: conn.osc?.targetPort ?? 8000, listenPort: conn.osc?.listenPort ?? 9000 }); }} />
        </Field>
        <Row>
          <Field label="Destination port">
            <input style={styles.input} type="number"
              value={conn.osc?.targetPort ?? 8000}
              onChange={(e) => { setOscStatus('idle'); setConnection({ type: 'osc', targetHost: conn.osc?.targetHost ?? '127.0.0.1', targetPort: Number(e.target.value), listenPort: conn.osc?.listenPort ?? 9000 }); }} />
          </Field>
          <Field label="Listen port">
            <input style={styles.input} type="number"
              value={conn.osc?.listenPort ?? 9000}
              onChange={(e) => { setOscStatus('idle'); setConnection({ type: 'osc', targetHost: conn.osc?.targetHost ?? '127.0.0.1', targetPort: conn.osc?.targetPort ?? 8000, listenPort: Number(e.target.value) }); }} />
          </Field>
        </Row>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ConnectBtn onClick={oscStatus === 'ok' ? disconnectOsc : connectOsc} disconnect={oscStatus === 'ok'}>
            {oscStatus === 'ok' ? 'Disconnect OSC' : 'Connect OSC'}
          </ConnectBtn>
          <StatusBadge status={oscStatus} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Art-Net">
        <Field label="Destination IP">
          <input style={styles.input}
            placeholder="255.255.255.255 = broadcast"
            value={conn.artnet?.targetHost ?? ''}
            onChange={(e) => { setArtnetStatus('idle'); setConnection({ type: 'artnet', targetHost: e.target.value }); }} />
        </Field>
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 4 }}>
          Use 255.255.255.255 for LAN broadcast, or the receiver's IP for unicast.
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ConnectBtn onClick={artnetStatus === 'ok' ? disconnectArtnet : connectArtnet} disconnect={artnetStatus === 'ok'}>
            {artnetStatus === 'ok' ? 'Disconnect Art-Net' : 'Connect Art-Net'}
          </ConnectBtn>
          <StatusBadge status={artnetStatus} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="sACN / E1.31">
        <Field label="Mode">
          <select style={styles.input}
            value={conn.sacn?.mode ?? 'multicast'}
            onChange={(e) => { setSacnStatus('idle'); setConnection({ type: 'sacn', mode: e.target.value as 'multicast' | 'unicast', priority: conn.sacn?.priority ?? 100, targetHost: conn.sacn?.targetHost }); }}>
            <option value="multicast">Multicast (automatic)</option>
            <option value="unicast">Unicast (specific IP)</option>
          </select>
        </Field>
        {(conn.sacn?.mode ?? 'multicast') === 'unicast' && (
          <Field label="Destination IP">
            <input style={styles.input}
              placeholder="e.g. 192.168.1.50"
              value={conn.sacn?.targetHost ?? ''}
              onChange={(e) => { setSacnStatus('idle'); setConnection({ type: 'sacn', mode: 'unicast', priority: conn.sacn?.priority ?? 100, targetHost: e.target.value }); }} />
          </Field>
        )}
        <Field label="Priority (1–200)">
          <input style={styles.input} type="number" min={1} max={200}
            value={conn.sacn?.priority ?? 100}
            onChange={(e) => { setSacnStatus('idle'); setConnection({ type: 'sacn', mode: conn.sacn?.mode ?? 'multicast', priority: Number(e.target.value), targetHost: conn.sacn?.targetHost }); }} />
        </Field>
        {(conn.sacn?.mode ?? 'multicast') === 'multicast' && (
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 4 }}>
            Multicast: destination is computed automatically from the universe number.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ConnectBtn onClick={sacnStatus === 'ok' ? disconnectSacn : connectSacn} disconnect={sacnStatus === 'ok'}>
            {sacnStatus === 'ok' ? 'Disconnect sACN' : 'Connect sACN'}
          </ConnectBtn>
          <StatusBadge status={sacnStatus} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Enttec Open DMX USB">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
          Requires the FTDI D2XX driver. Device index is 0 for the first dongle.
        </div>
        <button
          onClick={async () => {
            try {
              const res = await bridge.invoke('tr:enttec:listDevices', undefined as never);
              if (res.ok) setEnttecDevices(res.devices);
              else setEnttecDevices([]);
            } catch { setEnttecDevices([]); }
          }}
          style={{ ...styles.input, cursor: 'pointer', marginBottom: 6, textAlign: 'left', background: 'var(--color-surface-2)' }}
        >
          Scan USB devices…
        </button>
        {enttecDevices !== null && (
          enttecDevices.length === 0
            ? <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 6 }}>No FTDI devices found</div>
            : <div style={{ marginBottom: 6 }}>
                {enttecDevices.map((d) => (
                  <div key={d.index}
                    style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3, fontSize: 11,
                      background: d.index === (conn.enttecDmx?.deviceIndex ?? 0) ? 'var(--color-accent)' : 'transparent',
                      color: d.index === (conn.enttecDmx?.deviceIndex ?? 0) ? '#fff' : 'inherit' }}
                    onClick={() => { setEnttecStatus('idle'); setConnection({ type: 'enttecDmx', deviceIndex: d.index, deviceDescription: d.description }); }}
                  >
                    [{d.index}] {d.description}{d.serialNumber ? ` (${d.serialNumber})` : ''}
                  </div>
                ))}
              </div>
        )}
        <Field label="Device index">
          <NumInput
            value={conn.enttecDmx?.deviceIndex ?? 0}
            onChange={(v) => { setEnttecStatus('idle'); setConnection({ type: 'enttecDmx', deviceIndex: Math.max(0, v) }); }}
          />
        </Field>
        {conn.enttecDmx?.deviceDescription && (
          <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2 }}>
            {conn.enttecDmx.deviceDescription}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          <ConnectBtn onClick={enttecStatus === 'ok' ? disconnectEnttec : connectEnttec} disconnect={enttecStatus === 'ok'}>
            {enttecStatus === 'ok' ? 'Disconnect Enttec' : 'Connect Enttec'}
          </ConnectBtn>
          <StatusBadge status={enttecStatus} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Audio Input">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
          Select the audio input device. Used by Timeline widgets for timecode sync and future audio analysis features.
        </div>
        <button
          onClick={listAudioInputs}
          style={{ ...styles.input, cursor: 'pointer', marginBottom: 6, textAlign: 'left', background: 'var(--color-surface-2)' }}
        >
          Scan audio inputs…
        </button>
        {audioDevices.length > 0 && (
          <Field label="Device">
            <select
              style={styles.input}
              value={conn.ltcAudio?.deviceId ?? ''}
              onChange={(e) => {
                const dev = audioDevices.find((d) => d.deviceId === e.target.value);
                if (dev) setConnection({ type: 'ltcAudio', deviceId: dev.deviceId, deviceLabel: dev.label });
                else setConnection({ type: 'ltcAudio', deviceId: '', deviceLabel: '' });
              }}
            >
              <option value="">— none —</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId}
                </option>
              ))}
            </select>
          </Field>
        )}
        {conn.ltcAudio?.deviceLabel && (
          <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 4 }}>
            Selected: {conn.ltcAudio.deviceLabel}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection label="Audio Output">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
          Select the audio output device for sound track playback.
        </div>
        <button
          onClick={listAudioOutputs}
          style={{ ...styles.input, cursor: 'pointer', marginBottom: 6, textAlign: 'left', background: 'var(--color-surface-2)' }}
        >
          Scan audio outputs…
        </button>
        {audioOutDevices.length > 0 && (
          <Field label="Device">
            <select
              style={styles.input}
              value={conn.audioOutput?.deviceId ?? ''}
              onChange={(e) => {
                const dev = audioOutDevices.find((d) => d.deviceId === e.target.value);
                if (dev) setConnection({ type: 'audioOutput', deviceId: dev.deviceId, deviceLabel: dev.label });
                else setConnection({ type: 'audioOutput', deviceId: '', deviceLabel: '' });
              }}
            >
              <option value="">— default —</option>
              {audioOutDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || d.deviceId}
                </option>
              ))}
            </select>
          </Field>
        )}
        {conn.audioOutput?.deviceLabel && (
          <div style={{ fontSize: 10, color: 'var(--color-accent)', marginTop: 4 }}>
            Selected: {conn.audioOutput.deviceLabel}
          </div>
        )}
      </CollapsibleSection>

      <NetworkLiveSection />
    </>
  );
}

// ─── MIDI Clock section ───────────────────────────────────────────────────────

function MidiClockSection() {
  const { midiClockEnabled, setMidiClockEnabled } = useStore((s) => ({
    midiClockEnabled: s.midiClockEnabled,
    setMidiClockEnabled: s.setMidiClockEnabled,
  }));

  return (
    <CollapsibleSection label="MIDI Clock">
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
        Send MIDI clock ticks (24 PPQN) via the MIDI output port, synced to the master BPM.
        Requires an active MIDI output connection.
      </div>
      <Field label="Send clock">
        <button
          onPointerDown={(e) => { e.preventDefault(); setMidiClockEnabled(!midiClockEnabled); }}
          style={{
            height: 24, padding: '0 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
            background: midiClockEnabled ? 'var(--color-accent)' : 'var(--color-surface-2)',
            border: `1px solid ${midiClockEnabled ? 'var(--color-accent)' : 'var(--color-border)'}`,
            color: midiClockEnabled ? '#000' : 'var(--color-text-dim)',
            borderRadius: 'var(--radius-sm)', fontWeight: midiClockEnabled ? 700 : undefined,
          }}
        >
          {midiClockEnabled ? '⬤ Running' : '◎ Off'}
        </button>
      </Field>
    </CollapsibleSection>
  );
}

// ─── Network Live section (rendered inside SettingsPanel) ─────────────────────

function NetworkLiveSection() {
  const { networkEnabled, networkPort, networkLocalIP, setNetworkEnabled, setNetworkPort, setNetworkLocalIP } =
    useStore((s) => ({
      networkEnabled: s.networkEnabled,
      networkPort: s.networkPort,
      networkLocalIP: s.networkLocalIP,
      setNetworkEnabled: s.setNetworkEnabled,
      setNetworkPort: s.setNetworkPort,
      setNetworkLocalIP: s.setNetworkLocalIP,
    }));

  const startNetworkSync = React.useCallback(() => {
    import('../../../network/networkSync').then((m) => m.startNetworkSync());
  }, []);
  const stopNetworkSync = React.useCallback(() => {
    import('../../../network/networkSync').then((m) => m.stopNetworkSync());
  }, []);

  const [portInput, setPortInput] = React.useState(String(networkPort));
  const [status, setStatus] = React.useState<'idle' | 'starting' | 'error'>('idle');

  async function handleToggle() {
    try {
      if (networkEnabled) {
        await bridge.invoke('tr:net:stop', undefined as never);
        stopNetworkSync();
        setNetworkEnabled(false);
        setNetworkLocalIP('');
      } else {
        const port = parseInt(portInput, 10) || 3456;
        setStatus('starting');
        const result = await bridge.invoke('tr:net:start', { port });
        if (result.ok) {
          setNetworkPort(port);
          setNetworkLocalIP(result.ip);
          setNetworkEnabled(true);
          setStatus('idle');
          startNetworkSync();
        } else {
          setStatus('error');
        }
      }
    } catch (err) {
      console.error('[Network] handleToggle error:', err);
      setStatus('error');
    }
  }

  const url = networkEnabled && networkLocalIP
    ? `https://${networkLocalIP}:${networkPort}`
    : null;

  return (
    <CollapsibleSection label="Network Live">
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
        Serve the live canvas over the local network. Connect from any phone or PC on the same WiFi.
      </div>

      <Row>
        <Field label="Port">
          <input
            style={styles.input}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
            disabled={networkEnabled}
          />
        </Field>
        <Field label="">
          <button
            onClick={handleToggle}
            style={{
              ...styles.input, cursor: 'pointer', fontWeight: 600,
              background: networkEnabled ? '#1a2a1a' : 'var(--color-surface-2)',
              color: networkEnabled ? '#00cc66' : 'var(--color-text)',
              border: `1px solid ${networkEnabled ? '#00cc66' : 'var(--color-border)'}`,
            }}
          >
            {status === 'starting' ? '…' : networkEnabled ? '● ON' : 'Start'}
          </button>
        </Field>
      </Row>

      {status === 'error' && (
        <div style={{ fontSize: 10, color: '#cc3333', marginTop: 4 }}>
          Failed to start — port may be in use.
        </div>
      )}

      {url && (
        <div style={{ marginTop: 8, padding: '8px', background: 'var(--color-surface)', border: '1px solid #00cc6640', borderRadius: 3 }}>
          <div style={{ fontSize: 9, color: '#555', marginBottom: 4, letterSpacing: 1 }}>OPEN IN BROWSER</div>
          <div style={{ fontSize: 12, color: '#00cc66', fontFamily: 'monospace', letterSpacing: 0.5 }}>
            {url}
          </div>
          <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>
            If browser shows "not secure": tap Advanced → Proceed to continue (self-signed cert, one-time per device).
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ─── Sidecar source picker ────────────────────────────────────────────────────

const SIDECAR = 'http://127.0.0.1:8765';

function useSidecarSources(endpoint: string) {
  const [sources, setSources] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SIDECAR}${endpoint}`);
      const data = await res.json() as { sources: string[]; ok: boolean; error?: string };
      setSources(data.sources ?? []);
      if (!data.ok && data.error) setError(data.error);
    } catch {
      setError('Sidecar not running — launch LiveForge normally');
    }
    setLoading(false);
  }

  React.useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { sources, loading, error, refresh };
}

function SourceSelect({ value, onChange, endpoint }: {
  value: string;
  onChange: (name: string) => void;
  endpoint: string;
}) {
  const { sources, loading, error, refresh } = useSidecarSources(endpoint);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <select
          style={{ ...styles.input, flex: 1 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— no source —</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          {value && !sources.includes(value) && (
            <option value={value} style={{ color: '#e6a000' }}>{value} (offline)</option>
          )}
        </select>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh source list"
          style={{
            flexShrink: 0, padding: '3px 8px', fontSize: 12, cursor: 'pointer',
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)', borderRadius: 3,
          }}
        >
          {loading ? '…' : '↺'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 10, color: '#e6a000', lineHeight: 1.4 }}>{error}</div>
      )}
      {!error && sources.length === 0 && !loading && (
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>
          No sources found — start a sender then click ↺
        </div>
      )}
    </>
  );
}

// ─── Spout Input inspector panel ─────────────────────────────────────────────

function SpoutInputInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').SpoutInputWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<import('../../../../shared/types/project').SpoutInputWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  return (
    <>
      <div style={styles.header}>Spout Input</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Spout sender">
        <SourceSelect value={widget.senderName} onChange={(n) => patch({ senderName: n })} endpoint="/spout/sources" />
      </Section>
      <Section label="Display">
        <Row>
          <Field label="Border px">
            <NumInput value={widget.borderWidth ?? 0} min={0} max={32} onChange={(v) => patch({ borderWidth: v })} />
          </Field>
          <Field label="Color">
            <input type="color" value={widget.borderColor ?? '#ffffff'}
              onChange={(e) => patch({ borderColor: e.target.value })}
              style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          </Field>
        </Row>
        <Row>
          <Field label="Max FPS">
            <NumInput value={widget.targetFps ?? 0} min={0} max={120} onChange={(v) => patch({ targetFps: v })} />
          </Field>
          <Field label=""><span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>0 = no limit</span></Field>
        </Row>
      </Section>
    </>
  );
}

// ─── NDI Input inspector panel ────────────────────────────────────────────────

function NdiInputInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').NdiInputWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<import('../../../../shared/types/project').NdiInputWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  return (
    <>
      <div style={styles.header}>NDI Input</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="NDI source">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6, lineHeight: 1.4 }}>
          NDI sources on the LAN. Requires NDI Runtime installed.
        </div>
        <SourceSelect value={widget.sourceName} onChange={(n) => patch({ sourceName: n })} endpoint="/ndi/sources" />
      </Section>
      <Section label="Display">
        <Row>
          <Field label="Border px">
            <NumInput value={widget.borderWidth ?? 0} onChange={(v) => patch({ borderWidth: v })} />
          </Field>
          <Field label="Color">
            <input type="color" value={widget.borderColor ?? '#ffffff'}
              onChange={(e) => patch({ borderColor: e.target.value })}
              style={{ width: '100%', height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          </Field>
        </Row>
        <Row>
          <Field label="Max FPS">
            <NumInput value={widget.targetFps ?? 0} onChange={(v) => patch({ targetFps: v })} />
          </Field>
          <Field label=""><span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>0 = no limit</span></Field>
        </Row>
      </Section>
    </>
  );
}

// ─── Submasters inspector panel ──────────────────────────────────────────────

function SubmastersInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').SubmastersWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const activePage = useActivePage();

  function patch(partial: Partial<import('../../../../shared/types/project').SubmastersWidget>) {
    updateWidget(activePageId, widget.id, partial as never);
  }

  function patchStyle(partial: Partial<typeof widget.style>) {
    patch({ style: { ...widget.style, ...partial } });
  }

  function handleCountChange(newCount: number) {
    const safe = Math.max(1, Math.min(32, Math.round(newCount)));
    const newScenes = Array.from({ length: safe }, (_, i) =>
      widget.scenes[i] ?? { label: `${i + 1}`, snapshot: {} }
    );
    patch({ countX: safe, scenes: newScenes });
  }

  function handleAddLinked() {
    const available = activePage?.widgets.find(
      (w) => w.id !== widget.id && !widget.linkedWidgetIds.includes(w.id)
    );
    if (!available) return;
    patch({ linkedWidgetIds: [...widget.linkedWidgetIds, available.id] });
  }

  function handleRemoveLinked(idx: number) {
    patch({ linkedWidgetIds: widget.linkedWidgetIds.filter((_, i) => i !== idx) });
  }

  function handleChangeLinked(idx: number, newId: string) {
    const newIds = [...widget.linkedWidgetIds];
    newIds[idx] = newId;
    patch({ linkedWidgetIds: newIds });
  }

  function handleSceneColor(sceneIdx: number, color: string) {
    const newScenes = widget.scenes.map((s, i) => i === sceneIdx ? { ...s, color } : s);
    patch({ scenes: newScenes });
  }

  function handleSceneLabel(sceneIdx: number, label: string) {
    const newScenes = widget.scenes.map((s, i) => i === sceneIdx ? { ...s, label } : s);
    patch({ scenes: newScenes });
  }

  function handleClearScene(sceneIdx: number) {
    const newScenes = widget.scenes.map((s, i) => i === sceneIdx ? { ...s, snapshot: {} } : s);
    patch({ scenes: newScenes });
  }

  const pageWidgets = activePage?.widgets.filter((w) => w.id !== widget.id) ?? [];

  return (
    <>
      <div style={styles.header}>Submasters</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label}
          onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="Scenes">
        <Row>
          <Field label="Count">
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                onClick={() => handleCountChange(widget.countX - 1)}
                style={{ width: 28, height: 28, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 3, cursor: 'pointer', fontSize: 16 }}
              >−</button>
              <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--color-text)' }}>{widget.countX}</span>
              <button
                onClick={() => handleCountChange(widget.countX + 1)}
                style={{ width: 28, height: 28, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderRadius: 3, cursor: 'pointer', fontSize: 16 }}
              >+</button>
            </div>
          </Field>
        </Row>
        <Row>
          <Field label="Gap X">
            <NumInput value={widget.spacingX} onChange={(v) => patch({ spacingX: Math.max(0, v) })} />
          </Field>
          <Field label="Gap Y">
            <NumInput value={widget.spacingY} onChange={(v) => patch({ spacingY: Math.max(0, v) })} />
          </Field>
        </Row>
      </Section>

      <Section label="Merge Mode">
        <select
          style={styles.input}
          value={widget.mergeMode}
          onChange={(e) => patch({ mergeMode: e.target.value as import('../../../../shared/types/project').SubmasterMergeMode })}
        >
          <option value="htp">HTP – Higher Takes Preference</option>
          <option value="ltp">LTP – Last Takes Preference</option>
        </select>
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginTop: 5, lineHeight: 1.4 }}>
          HTP: max of all active scenes. LTP: last moved fader wins.
        </div>
      </Section>

      <Section label="Linked Widgets">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          Widgets controlled by this submaster.
        </div>
        {widget.linkedWidgetIds.map((wid, i) => {
          const found = pageWidgets.find((w) => w.id === wid);
          return (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <select
                value={wid}
                onChange={(e) => handleChangeLinked(i, e.target.value)}
                style={{ ...styles.input, flex: 1 }}
              >
                {!found && <option value={wid}>[deleted]</option>}
                {pageWidgets.map((w) => (
                  <option key={w.id} value={w.id}>{w.label || w.kind}</option>
                ))}
              </select>
              <button
                onClick={() => handleRemoveLinked(i)}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
              >×</button>
            </div>
          );
        })}
        <button
          onClick={handleAddLinked}
          disabled={pageWidgets.length === 0 || pageWidgets.every((w) => widget.linkedWidgetIds.includes(w.id))}
          style={{
            width: '100%', marginTop: 4, padding: '4px 0', fontSize: 11,
            background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)', borderRadius: 3, cursor: 'pointer',
          }}
        >+ Add Widget</button>
      </Section>

      <Section label="Scene Config">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          Label and color per scene button.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {widget.scenes.map((scene, i) => {
            const hasData = Object.keys(scene.snapshot).length > 0;
            return (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-dim)', width: 14, flexShrink: 0 }}>{i + 1}</span>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={scene.label}
                  onChange={(e) => handleSceneLabel(i, e.target.value)}
                />
                <input
                  type="color"
                  value={scene.color ?? widget.style.foregroundColor}
                  onChange={(e) => handleSceneColor(i, e.target.value)}
                  style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                />
                {hasData && (
                  <button
                    onClick={() => handleClearScene(i)}
                    title="Clear snapshot"
                    style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                  >✕</button>
                )}
                {!hasData && (
                  <span style={{ fontSize: 10, color: '#333', width: 16, flexShrink: 0, textAlign: 'center' }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section label="Style">
        <Row>
          <Field label="BG">
            <ColorInput value={widget.style.backgroundColor} onChange={(v) => patchStyle({ backgroundColor: v })} />
          </Field>
          <Field label="FG (default)">
            <ColorInput value={widget.style.foregroundColor} onChange={(v) => patchStyle({ foregroundColor: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Label col.">
            <ColorInput value={widget.style.labelColor} onChange={(v) => patchStyle({ labelColor: v })} />
          </Field>
          <Field label="Radius">
            <NumInput value={widget.style.borderRadius} onChange={(v) => patchStyle({ borderRadius: v })} />
          </Field>
        </Row>
        <Row>
          <Field label="Font size">
            <NumInput value={widget.style.fontSize} onChange={(v) => patchStyle({ fontSize: v })} />
          </Field>
          <Field label="Show labels">
            <input type="checkbox" checked={widget.style.showLabel}
              onChange={(e) => patchStyle({ showLabel: e.target.checked })}
              style={{ marginTop: 6 }} />
          </Field>
        </Row>
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── AutoBpm inspector panel ──────────────────────────────────────────────────

function BeatOutputMappingEditor({ label, mapping, onChange }: {
  label: string;
  mapping: Mapping;
  onChange: (m: Mapping) => void;
}) {
  const proto = mapping?.type ?? 'none';
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>{label}</div>
      <select
        style={{ ...styles.input, fontSize: 10, marginBottom: proto !== 'none' ? 4 : 0 }}
        value={proto}
        onChange={(e) => {
          const t = e.target.value;
          if (t === 'none') onChange(null);
          else if (t === 'midi') onChange({ type: 'midi', messageType: 'controlChange', channel: 1, number: 0, minValue: 0, maxValue: 127 });
          else if (t === 'osc')  onChange({ type: 'osc', address: '/bpm/out' });
          else if (t === 'artnet') onChange({ type: 'artnet', universe: 0, channel: 1, minValue: 0, maxValue: 255 });
          else if (t === 'sacn')   onChange({ type: 'sacn', universe: 1, channel: 1, minValue: 0, maxValue: 255, priority: 100 });
          else if (t === 'enttec') onChange({ type: 'enttec', channel: 1, minValue: 0, maxValue: 255 });
        }}
      >
        <option value="none">Off</option>
        <option value="midi">MIDI</option>
        <option value="osc">OSC</option>
        <option value="artnet">Art-Net</option>
        <option value="sacn">sACN</option>
        <option value="enttec">Enttec DMX</option>
      </select>
      {mapping?.type === 'midi' && (() => {
        const m = mapping as MidiMapping;
        return (
          <Row>
            <Field label="Ch"><NumInput value={m.channel} onChange={(v) => onChange({ ...m, channel: Math.max(1, Math.min(16, v)) })} /></Field>
            <Field label="CC"><NumInput value={m.number} onChange={(v) => onChange({ ...m, number: Math.max(0, Math.min(127, v)) })} /></Field>
          </Row>
        );
      })()}
      {mapping?.type === 'osc' && (
        <input style={{ ...styles.input, fontSize: 10 }} placeholder="/address"
          value={(mapping as OscMapping).address}
          onChange={(e) => onChange({ ...(mapping as OscMapping), address: e.target.value })} />
      )}
      {(mapping?.type === 'artnet' || mapping?.type === 'sacn') && (() => {
        const m = mapping as ArtNetMapping | SacnMapping;
        return (
          <Row>
            <Field label="Univ"><NumInput value={m.universe} onChange={(v) => onChange({ ...m, universe: v } as never)} /></Field>
            <Field label="Ch"><NumInput value={m.channel} onChange={(v) => onChange({ ...m, channel: Math.max(1, Math.min(512, v)) } as never)} /></Field>
          </Row>
        );
      })()}
      {mapping?.type === 'enttec' && (() => {
        const m = mapping as EnttecDmxMapping;
        return (
          <Field label="Ch"><NumInput value={m.channel} onChange={(v) => onChange({ ...m, channel: Math.max(1, Math.min(512, v)) })} /></Field>
        );
      })()}
    </div>
  );
}

function AutoBpmInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: AutoBpmWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<AutoBpmWidget>) { updateWidget(activePageId, widget.id, partial as never); }
  function patchStyle(p: Partial<typeof widget.style>) { patch({ style: { ...widget.style, ...p } }); }

  function patchOutput(i: number, partial: Partial<BeatOutput>) {
    const beatOutputs = widget.beatOutputs.map((o, idx) => idx === i ? { ...o, ...partial } : o);
    patch({ beatOutputs });
  }

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <>
      <div style={styles.header}>BPM Clock</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="Beat Outputs">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
          Each divisor has a trigger (0→1→0 pulse) and a ramp (0→1 sawtooth).
        </div>
        {BEAT_DIVISORS.map((D, i) => {
          const out = widget.beatOutputs[i];
          const isOpen = expandedIdx === i;
          const hasMapping = !!(out.triggerMapping || out.rampMapping);
          return (
            <div key={D} style={{ marginBottom: 4 }}>
              <button
                onClick={() => setExpandedIdx(isOpen ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--color-surface-2)' : 'none',
                  border: `1px solid ${isOpen ? 'var(--color-border)' : 'transparent'}`,
                  borderRadius: 3, padding: '4px 8px', cursor: 'pointer',
                  color: hasMapping ? 'var(--color-text)' : 'var(--color-text-dim)',
                  fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>x{D} {D === 1 ? '(every beat)' : D === 3 ? '(triplet bar)' : `(${D} beats)`}</span>
                <span style={{ fontSize: 9, color: hasMapping ? '#00cc66' : '#333' }}>
                  {hasMapping ? '●' : '○'} {isOpen ? '▲' : '▼'}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '8px 8px 4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 3px 3px' }}>
                  <BeatOutputMappingEditor
                    label="Trigger (pulse)"
                    mapping={out.triggerMapping}
                    onChange={(m) => patchOutput(i, { triggerMapping: m })}
                  />
                  <BeatOutputMappingEditor
                    label="Ramp (sawtooth)"
                    mapping={out.rampMapping}
                    onChange={(m) => patchOutput(i, { rampMapping: m })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── Router inspector panel ───────────────────────────────────────────────────

function RouterOutputEditor({ output, onChange, onRemove }: {
  output: RouterOutput;
  onChange: (updated: Partial<RouterOutput>) => void;
  onRemove: () => void;
}) {
  const activePage = useActivePage();
  const mode = output.targetWidgetId != null ? 'widget' : (output.mapping?.type ?? '');

  function handleModeChange(p: string) {
    if (p === 'widget') {
      onChange({ mapping: null, targetWidgetId: '', targetCellIndex: 0 });
    } else {
      onChange({ targetWidgetId: undefined, targetCellIndex: undefined });
      if (!p) { onChange({ mapping: null }); return; }
      if (p === 'midi')   onChange({ mapping: { type: 'midi', messageType: 'controlChange', channel: 1, number: 0, minValue: 0, maxValue: 127 } });
      else if (p === 'osc')    onChange({ mapping: { type: 'osc', address: '/out' } });
      else if (p === 'enttec') onChange({ mapping: { type: 'enttec', channel: 1, minValue: 0, maxValue: 255 } });
      else if (p === 'artnet') onChange({ mapping: { type: 'artnet', universe: 0, channel: 1, minValue: 0, maxValue: 255 } });
      else if (p === 'sacn')   onChange({ mapping: { type: 'sacn', universe: 1, channel: 1, minValue: 0, maxValue: 255, priority: 100 } });
    }
  }

  function pm(partial: Partial<Mapping & object>) { onChange({ mapping: { ...output.mapping!, ...partial } as Mapping }); }

  // Widget cell target: compute available target widgets and their cells
  const targetWidgets = activePage?.widgets.filter((w) =>
    ['sliderBank', 'buttonGrid', 'knobBank', 'xyPad', 'stepSequencer', 'graphWidget', 'soundPlayer'].includes(w.kind)
  ) ?? [];
  const targetWidget = activePage?.widgets.find((w) => w.id === output.targetWidgetId);
  function getTargetCells(widgetId: string): { index: number; label: string }[] {
    const w = activePage?.widgets.find((x) => x.id === widgetId);
    if (!w) return [];
    if (w.kind === 'xyPad') return [{ index: 0, label: 'X' }, { index: 1, label: 'Y' }];
    if (w.kind === 'stepSequencer' || w.kind === 'graphWidget') return [{ index: 0, label: 'value' }];
    if (w.kind === 'soundPlayer') {
      return w.tracks.map((t, i) => ({ index: i, label: t.label || t.fileName || `Track ${i + 1}` }));
    }
    if ('cells' in w && Array.isArray(w.cells)) {
      return (w.cells as { label?: string }[]).map((c, i) => ({ index: i, label: c.label || `#${i + 1}` }));
    }
    return [{ index: 0, label: 'value' }];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <select style={{ ...styles.input, flex: 1, fontSize: 10 }} value={mode} onChange={(e) => handleModeChange(e.target.value)}>
          <option value="">— output type —</option>
          <option value="widget">Widget Cell</option>
          <option value="midi">MIDI</option>
          <option value="osc">OSC</option>
          <option value="enttec">Enttec DMX USB</option>
          <option value="artnet">Art-Net</option>
          <option value="sacn">sACN / E1.31</option>
        </select>
        <button onClick={onRemove} style={{ background: 'none', border: '1px solid #333', color: '#555', cursor: 'pointer', borderRadius: 2, padding: '2px 6px', fontSize: 11, flexShrink: 0 }}>✕</button>
      </div>
      {mode === 'widget' && (
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            style={{ ...styles.input, flex: 2, fontSize: 10 }}
            value={output.targetWidgetId ?? ''}
            onChange={(e) => onChange({ targetWidgetId: e.target.value, targetCellIndex: 0 })}
          >
            <option value="">— widget —</option>
            {targetWidgets.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <select
            style={{ ...styles.input, flex: 1, fontSize: 10 }}
            value={output.targetCellIndex ?? 0}
            disabled={!targetWidget}
            onChange={(e) => onChange({ targetCellIndex: Number(e.target.value) })}
          >
            {getTargetCells(output.targetWidgetId ?? '').map((c) => (
              <option key={c.index} value={c.index}>{c.label}</option>
            ))}
            {!targetWidget && <option value={0}>—</option>}
          </select>
        </div>
      )}
      {output.mapping?.type === 'midi' && (() => {
        const m = output.mapping as MidiMapping;
        return (
          <>
            <Row>
              <Field label="Ch"><NumInput value={m.channel} onChange={(v) => pm({ channel: Math.max(1, Math.min(16, v)) })} /></Field>
              <Field label="CC"><NumInput value={m.number} onChange={(v) => pm({ number: Math.max(0, Math.min(127, v)) })} /></Field>
            </Row>
            <Row>
              <Field label="Min"><NumInput value={m.minValue} onChange={(v) => pm({ minValue: v })} /></Field>
              <Field label="Max"><NumInput value={m.maxValue} onChange={(v) => pm({ maxValue: v })} /></Field>
            </Row>
          </>
        );
      })()}
      {output.mapping?.type === 'osc' && (() => {
        const m = output.mapping as OscMapping;
        return (
          <>
            <input style={{ ...styles.input, fontSize: 10 }} placeholder="/address"
              value={m.address}
              onChange={(e) => pm({ address: e.target.value })} />
            <Row>
              <Field label="Min"><NumInput value={m.minValue ?? 0} onChange={(v) => pm({ minValue: v })} /></Field>
              <Field label="Max"><NumInput value={m.maxValue ?? 1} onChange={(v) => pm({ maxValue: v })} /></Field>
            </Row>
          </>
        );
      })()}
      {output.mapping?.type === 'enttec' && (() => {
        const m = output.mapping as EnttecDmxMapping;
        return (
          <>
            <Field label="Channel">
              <NumInput value={m.channel} onChange={(v) => pm({ channel: Math.max(1, Math.min(512, v)) })} />
            </Field>
            <Row>
              <Field label="Min"><NumInput value={m.minValue} onChange={(v) => pm({ minValue: v })} /></Field>
              <Field label="Max"><NumInput value={m.maxValue} onChange={(v) => pm({ maxValue: v })} /></Field>
            </Row>
          </>
        );
      })()}
      {(output.mapping?.type === 'artnet' || output.mapping?.type === 'sacn') && (() => {
        const m = output.mapping as ArtNetMapping | SacnMapping;
        return (
          <>
            <Row>
              <Field label="Universe"><NumInput value={m.universe} onChange={(v) => pm({ universe: v })} /></Field>
              <Field label="Channel"><NumInput value={m.channel} onChange={(v) => pm({ channel: Math.max(1, Math.min(512, v)) })} /></Field>
            </Row>
            <Row>
              <Field label="Min"><NumInput value={m.minValue} onChange={(v) => pm({ minValue: v })} /></Field>
              <Field label="Max"><NumInput value={m.maxValue} onChange={(v) => pm({ maxValue: v })} /></Field>
            </Row>
          </>
        );
      })()}
    </div>
  );
}

function RouterInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: RouterWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const activePage = useActivePage();

  function patch(partial: Partial<RouterWidget>) { updateWidget(activePageId, widget.id, partial as never); }
  function patchStyle(p: Partial<typeof widget.style>) { patch({ style: { ...widget.style, ...p } }); }

  const inputWidgets = activePage?.widgets.filter((w) =>
    ['sliderBank', 'buttonGrid', 'knobBank', 'xyPad', 'stepSequencer', 'graphWidget',
     'autoBpm', 'timeline', 'audioAnalyser', 'soundPlayer'].includes(w.kind)
  ) ?? [];

  function getCells(widgetId: string): { index: number; label: string }[] {
    const w = activePage?.widgets.find((x) => x.id === widgetId);
    if (!w) return [];
    if (w.kind === 'xyPad') return [{ index: 0, label: 'X' }, { index: 1, label: 'Y' }];
    if (w.kind === 'stepSequencer' || w.kind === 'graphWidget') return [{ index: 0, label: 'value' }];
    if (w.kind === 'autoBpm') {
      return [
        ...BEAT_DIVISORS.map((D, i) => ({ index: i, label: `trig ×${D}` })),
        ...BEAT_DIVISORS.map((D, i) => ({ index: 8 + i, label: `ramp ×${D}` })),
      ];
    }
    if (w.kind === 'timeline') {
      return w.tracks.map((t, i) => ({ index: i, label: `${t.kind}: ${t.label}` }));
    }
    if (w.kind === 'audioAnalyser') {
      return [
        ...['kick', 'snare', 'bass', 'mid', 'high'].map((lbl, i) => ({ index: i, label: lbl })),
        ...BEAT_DIVISORS.map((D, i) => ({ index: 5 + i, label: `trig ×${D}` })),
        ...BEAT_DIVISORS.map((D, i) => ({ index: 13 + i, label: `ramp ×${D}` })),
      ];
    }
    if (w.kind === 'soundPlayer') {
      return w.tracks.map((t, i) => ({ index: i, label: t.label || t.fileName || `Track ${i + 1}` }));
    }
    if ('cells' in w && Array.isArray(w.cells)) {
      return (w.cells as { label?: string }[]).map((c, i) => ({ index: i, label: c.label || `#${i + 1}` }));
    }
    return [{ index: 0, label: 'value' }];
  }

  function addRow() {
    const newRow: RouterRow = { id: crypto.randomUUID(), inputType: 'widget', widgetId: '', cellIndex: 0, outputs: [] };
    patch({ rows: [...widget.rows, newRow] });
  }

  function removeRow(rowId: string) {
    patch({ rows: widget.rows.filter((r) => r.id !== rowId) });
  }

  function updateRow(rowId: string, partial: Partial<RouterRow>) {
    patch({ rows: widget.rows.map((r) => r.id === rowId ? { ...r, ...partial } : r) });
  }

  function addOutput(rowId: string) {
    const newOut: RouterOutput = { id: crypto.randomUUID(), mapping: null };
    patch({ rows: widget.rows.map((r) => r.id === rowId ? { ...r, outputs: [...r.outputs, newOut] } : r) });
  }

  function removeOutput(rowId: string, outId: string) {
    patch({ rows: widget.rows.map((r) => r.id === rowId ? { ...r, outputs: r.outputs.filter((o) => o.id !== outId) } : r) });
  }

  function updateOutput(rowId: string, outId: string, partial: Partial<RouterOutput>) {
    patch({ rows: widget.rows.map((r) => r.id === rowId
      ? { ...r, outputs: r.outputs.map((o) => o.id === outId ? { ...o, ...partial } : o) }
      : r
    )});
  }

  const rowBtnStyle: React.CSSProperties = {
    background: 'none', border: '1px dashed #333', color: '#555', cursor: 'pointer',
    fontSize: 10, borderRadius: 2, padding: '3px 8px',
  };

  return (
    <>
      <div style={styles.header}>Router</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="Style">
        <Row>
          <Field label="Font size">
            <NumInput value={widget.style.fontSize} onChange={(v) => patchStyle({ fontSize: Math.max(8, v) })} />
          </Field>
        </Row>
      </Section>

      <Section label="Routes">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
          Each route reads one widget cell and forwards its value (0–1) to all listed outputs.
        </div>

        {widget.rows.map((row, rowIdx) => {
          const inputType: RouterInputType = row.inputType ?? 'widget';
          const cells = getCells(row.widgetId);
          return (
            <div key={row.id} style={{ marginBottom: 12 }}>
              {/* Source type selector */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#505050', width: 18, flexShrink: 0, textAlign: 'right' }}>{rowIdx + 1}</span>
                <select
                  style={{ ...styles.input, flex: 1, fontSize: 11 }}
                  value={inputType}
                  onChange={(e) => updateRow(row.id, { inputType: e.target.value as RouterInputType, widgetId: '', cellIndex: 0 })}
                >
                  <option value="widget">Widget Cell</option>
                  <option value="midiCC">MIDI CC</option>
                  <option value="midiNote">MIDI Note</option>
                  <option value="osc">OSC</option>
                </select>
                <button
                  onClick={() => removeRow(row.id)}
                  style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
                >✕</button>
              </div>

              {/* Source-specific inputs */}
              {inputType === 'widget' && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 4, marginLeft: 22 }}>
                  <select
                    style={{ ...styles.input, flex: 2, fontSize: 11 }}
                    value={row.widgetId}
                    onChange={(e) => updateRow(row.id, { widgetId: e.target.value, cellIndex: 0 })}
                  >
                    <option value="">— widget —</option>
                    {inputWidgets.map((w) => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                  <select
                    style={{ ...styles.input, flex: 1, fontSize: 11 }}
                    value={row.cellIndex}
                    onChange={(e) => updateRow(row.id, { cellIndex: Number(e.target.value) })}
                    disabled={cells.length === 0}
                  >
                    {cells.length === 0
                      ? <option value={0}>—</option>
                      : cells.map((c) => <option key={c.index} value={c.index}>{c.label}</option>)
                    }
                  </select>
                </div>
              )}
              {(inputType === 'midiCC' || inputType === 'midiNote') && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 4, marginLeft: 22 }}>
                  <Field label="Ch (0=any)">
                    <NumInput
                      value={row.midiChannel ?? 0}
                      min={0} max={16}
                      onChange={(v) => updateRow(row.id, { midiChannel: Math.max(0, Math.min(16, v)) })}
                    />
                  </Field>
                  <Field label={inputType === 'midiCC' ? 'CC' : 'Note'}>
                    <NumInput
                      value={row.midiNumber ?? 0}
                      min={0} max={127}
                      onChange={(v) => updateRow(row.id, { midiNumber: Math.max(0, Math.min(127, v)) })}
                    />
                  </Field>
                </div>
              )}
              {inputType === 'osc' && (
                <div style={{ marginBottom: 4, marginLeft: 22 }}>
                  <input
                    style={{ ...styles.input, fontSize: 11 }}
                    placeholder="/address"
                    value={row.oscAddress ?? ''}
                    onChange={(e) => updateRow(row.id, { oscAddress: e.target.value })}
                  />
                </div>
              )}

              {/* Outputs */}
              {row.outputs.map((out) => (
                <div key={out.id} style={{
                  marginLeft: 22, marginBottom: 4,
                  padding: '6px 8px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderLeft: '2px solid #2a2a2a',
                  borderRadius: '0 2px 2px 0',
                }}>
                  <RouterOutputEditor
                    output={out}
                    onChange={(partial) => updateOutput(row.id, out.id, partial)}
                    onRemove={() => removeOutput(row.id, out.id)}
                  />
                </div>
              ))}

              <button
                onClick={() => addOutput(row.id)}
                style={{ ...rowBtnStyle, marginLeft: 22, width: 'calc(100% - 22px)' }}
              >
                + output
              </button>
            </div>
          );
        })}

        <button onClick={addRow} style={{ ...rowBtnStyle, width: '100%', marginTop: 4 }}>
          + route
        </button>
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── Audio Analyser inspector panel ──────────────────────────────────────────

function AudioAnalyserInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').AudioAnalyserWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(p: object) { updateWidget(activePageId, widget.id, p as never); }
  function patchStyle(p: Partial<typeof widget.style>) { patch({ style: { ...widget.style, ...p } }); }
  function patchBeatOutput(i: number, partial: Partial<import('../../../../shared/types/project').BeatOutput>) {
    const beatOutputs = (widget.beatOutputs ?? []).map((o, idx) => idx === i ? { ...o, ...partial } : o);
    patch({ beatOutputs });
  }

  const [expandedBpmIdx, setExpandedBpmIdx] = useState<number | null>(null);

  const OUTPUTS: { key: 'kickMapping' | 'snareMapping' | 'bassMapping' | 'midMapping' | 'highMapping'; label: string }[] = [
    { key: 'kickMapping', label: 'Kick trigger' },
    { key: 'snareMapping', label: 'Snare trigger' },
    { key: 'bassMapping', label: 'Bass level' },
    { key: 'midMapping', label: 'Mid level' },
    { key: 'highMapping', label: 'High level' },
  ];

  return (
    <>
      <div style={styles.header}>Audio Analyser</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="BPM Outputs">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
          Each divisor has a trigger (pulse) and a ramp (0→1 sawtooth).
        </div>
        {BEAT_DIVISORS.map((D, i) => {
          const out = widget.beatOutputs?.[i];
          const isOpen = expandedBpmIdx === i;
          const hasMapping = !!(out?.triggerMapping || out?.rampMapping);
          return (
            <div key={D} style={{ marginBottom: 4 }}>
              <button
                onClick={() => setExpandedBpmIdx(isOpen ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', background: isOpen ? 'var(--color-surface-2)' : 'none',
                  border: `1px solid ${isOpen ? 'var(--color-border)' : 'transparent'}`,
                  borderRadius: 3, padding: '4px 8px', cursor: 'pointer',
                  color: hasMapping ? 'var(--color-text)' : 'var(--color-text-dim)',
                  fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>×{D} {D === 1 ? '(every beat)' : D === 3 ? '(triplet bar)' : `(${D} beats)`}</span>
                <span style={{ fontSize: 9, color: hasMapping ? '#00cc66' : '#333' }}>
                  {hasMapping ? '●' : '○'} {isOpen ? '▲' : '▼'}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: '8px 8px 4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 3px 3px' }}>
                  <Field label="Label">
                    <input
                      style={styles.input}
                      placeholder={`×${D}`}
                      value={out?.name ?? ''}
                      onChange={(e) => patchBeatOutput(i, { name: e.target.value || undefined })}
                    />
                  </Field>
                  <BeatOutputMappingEditor
                    label="Trigger (pulse)"
                    mapping={out?.triggerMapping ?? null}
                    onChange={(m) => patchBeatOutput(i, { triggerMapping: m })}
                  />
                  <BeatOutputMappingEditor
                    label="Ramp (sawtooth)"
                    mapping={out?.rampMapping ?? null}
                    onChange={(m) => patchBeatOutput(i, { rampMapping: m })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </Section>

      <Section label="Kick">
        <Row>
          <Field label="Freq (Hz)"><NumInput value={widget.kickFreq} onChange={(v) => patch({ kickFreq: Math.max(1, v) })} /></Field>
          <Field label="Band (Hz)"><NumInput value={widget.kickBand} onChange={(v) => patch({ kickBand: Math.max(1, v) })} /></Field>
        </Row>
      </Section>

      <Section label="Snare">
        <Row>
          <Field label="Freq (Hz)"><NumInput value={widget.snareFreq} onChange={(v) => patch({ snareFreq: Math.max(1, v) })} /></Field>
          <Field label="Band (Hz)"><NumInput value={widget.snareBand} onChange={(v) => patch({ snareBand: Math.max(1, v) })} /></Field>
        </Row>
      </Section>

      <Section label="Bass (Lowpass)">
        <Row>
          <Field label="Cutoff (Hz)"><NumInput value={widget.bassFreq} onChange={(v) => patch({ bassFreq: Math.max(1, v) })} /></Field>
          <Field label="Rolloff (Hz)"><NumInput value={widget.bassBand} onChange={(v) => patch({ bassBand: Math.max(1, v) })} /></Field>
        </Row>
      </Section>

      <Section label="Mid (Bandpass)">
        <Row>
          <Field label="Center (Hz)"><NumInput value={widget.midFreq} onChange={(v) => patch({ midFreq: Math.max(1, v) })} /></Field>
          <Field label="Width (Hz)"><NumInput value={widget.midBand} onChange={(v) => patch({ midBand: Math.max(1, v) })} /></Field>
        </Row>
      </Section>

      <Section label="High (Highpass)">
        <Row>
          <Field label="Cutoff (Hz)"><NumInput value={widget.highFreq} onChange={(v) => patch({ highFreq: Math.max(1, v) })} /></Field>
          <Field label="Rolloff (Hz)"><NumInput value={widget.highBand} onChange={(v) => patch({ highBand: Math.max(1, v) })} /></Field>
        </Row>
      </Section>

      <Section label="Audio Output Mappings">
        {OUTPUTS.map(({ key, label }) => (
          <BeatOutputMappingEditor
            key={key}
            label={label}
            mapping={(widget as never)[key] as Mapping}
            onChange={(m) => patch({ [key]: m })}
          />
        ))}
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── Sound Player inspector panel ─────────────────────────────────────────────

function SoundPlayerInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').SoundPlayerWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(p: object) { updateWidget(activePageId, widget.id, p as never); }
  function patchStyle(p: Partial<typeof widget.style>) { patch({ style: { ...widget.style, ...p } }); }
  function patchTracks(tracks: import('../../../../shared/types/project').SoundPlayerTrack[]) { patch({ tracks }); }

  function addTrack() {
    const newTrack: import('../../../../shared/types/project').SoundPlayerTrack = {
      id: crypto.randomUUID(),
      label: `Track ${widget.tracks.length + 1}`,
      src: '',
      fileName: '',
      volume: 0.8,
      playMapping: null,
    };
    patchTracks([...widget.tracks, newTrack]);
  }

  function removeTrack(id: string) {
    patchTracks(widget.tracks.filter((t) => t.id !== id));
  }

  function updateTrack(id: string, p: Partial<import('../../../../shared/types/project').SoundPlayerTrack>) {
    patchTracks(widget.tracks.map((t) => t.id === id ? { ...t, ...p } : t));
  }

  function moveTrack(from: number, to: number) {
    const arr = [...widget.tracks];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    patchTracks(arr);
  }

  async function loadFile(id: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        updateTrack(id, { src, fileName: file.name, label: file.name.replace(/\.[^.]+$/, '') });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  return (
    <>
      <div style={styles.header}>Sound Player</div>

      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>

      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>

      <Section label="Master Volume">
        <Row>
          <Field label="Vol %">
            <NumInput value={Math.round(widget.masterVolume * 100)}
              onChange={(v) => patch({ masterVolume: Math.max(0, Math.min(100, v)) / 100 })} />
          </Field>
        </Row>
      </Section>

      <Section label="Tracks">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 8 }}>
          Tracks are triggerable via Router (cell index = track index).
        </div>
        {widget.tracks.map((track, i) => (
          <div key={track.id} style={{
            marginBottom: 8, padding: '8px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 3,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#666' }}>#{i + 1}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {i > 0 && (
                  <button onClick={() => moveTrack(i, i - 1)}
                    style={{ background: 'none', border: '1px solid #333', color: '#555', cursor: 'pointer', fontSize: 10, padding: '1px 5px', borderRadius: 2 }}>▲</button>
                )}
                {i < widget.tracks.length - 1 && (
                  <button onClick={() => moveTrack(i, i + 1)}
                    style={{ background: 'none', border: '1px solid #333', color: '#555', cursor: 'pointer', fontSize: 10, padding: '1px 5px', borderRadius: 2 }}>▼</button>
                )}
                <button onClick={() => removeTrack(track.id)}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>✕</button>
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>Label</div>
              <input style={styles.input} value={track.label}
                onChange={(e) => updateTrack(track.id, { label: e.target.value })} />
            </div>

            <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => loadFile(track.id)}
                style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: 'pointer', fontSize: 10, padding: '3px 8px', borderRadius: 2 }}
              >
                {track.fileName ? '🔄 Change file' : '📂 Load file'}
              </button>
              {track.fileName && (
                <span style={{ fontSize: 9, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {track.fileName}
                </span>
              )}
            </div>

            <Row>
              <Field label="Volume %">
                <NumInput value={Math.round(track.volume * 100)}
                  onChange={(v) => updateTrack(track.id, { volume: Math.max(0, Math.min(100, v)) / 100 })} />
              </Field>
            </Row>

            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>Play trigger mapping</div>
              <BeatOutputMappingEditor
                label=""
                mapping={track.playMapping}
                onChange={(m) => updateTrack(track.id, { playMapping: m })}
              />
            </div>
          </div>
        ))}
        <button
          onClick={addTrack}
          style={{ width: '100%', background: 'none', border: '1px dashed #333', color: '#555', cursor: 'pointer', fontSize: 10, borderRadius: 2, padding: '5px' }}
        >
          + add track
        </button>
      </Section>

      <FrameSection style={widget.style} patchStyle={patchStyle} />
    </>
  );
}

// ─── Nothing selected ─────────────────────────────────────────────────────────

function NoSelectionPanel() {
  const project = useProject();
  const { setProjectName } = useStore((s) => ({ setProjectName: s.setProjectName }));

  const conns = project.connections;
  const midiConn      = conns.find((c) => c.type === 'midi')        as MidiConnection        | undefined;
  const midiInConn    = conns.find((c) => c.type === 'midiInput')   as MidiInputConnection   | undefined;
  const oscConn       = conns.find((c) => c.type === 'osc')         as OscConnection         | undefined;
  const artnetConn    = conns.find((c) => c.type === 'artnet')      as ArtNetConnection      | undefined;
  const sacnConn      = conns.find((c) => c.type === 'sacn')        as SacnConnection        | undefined;
  const audioInConn   = conns.find((c) => c.type === 'ltcAudio')    as LtcAudioConnection    | undefined;
  const audioOutConn  = conns.find((c) => c.type === 'audioOutput') as AudioOutputConnection | undefined;

  return (
    <>
      <img src={logoUrl} alt="LiveForge" style={{ width: '100%', display: 'block', marginBottom: 6, objectFit: 'contain' }} />
      <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--color-text-dim)', marginBottom: 16, letterSpacing: 0.5 }}>developed by VENTO in 2026</div>
      <div style={styles.header}>Project</div>

      <Section label="Name">
        <input
          style={styles.input}
          value={project.name}
          onChange={(e) => setProjectName(e.target.value)}
        />
      </Section>

      <Section label="Connections">
        <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 6 }}>
          Open ⚙ to configure
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ConnBadge label="MIDI out"   status={midiConn?.portName      ?? 'not configured'} />
          <ConnBadge label="MIDI in"    status={midiInConn?.portName    ?? 'not configured'} />
          <ConnBadge label="OSC"        status={oscConn?.targetHost     ? `${oscConn.targetHost}:${oscConn.targetPort ?? 8000}` : 'not configured'} />
          <ConnBadge label="Art-Net"    status={artnetConn?.targetHost  ?? 'not configured'} />
          <ConnBadge label="sACN"       status={sacnConn                ? (sacnConn.mode ?? 'multicast') : 'not configured'} />
          <ConnBadge label="Audio in"   status={audioInConn?.deviceLabel  ?? 'not configured'} />
          <ConnBadge label="Audio out"  status={audioOutConn?.deviceLabel ?? 'not configured'} />
        </div>
      </Section>

    </>
  );
}

function ConnBadge({ label, status }: { label: string; status: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{status}</span>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function TriggerField({ mapping, defaultAddress, onChange }: {
  mapping: Mapping | null | undefined;
  defaultAddress: string;
  onChange: (m: Mapping | null) => void;
}) {
  const type = !mapping ? 'none'
    : mapping.type === 'osc' ? 'osc'
    : (mapping as MidiMapping).messageType === 'controlChange' ? 'midi-cc'
    : 'midi-note';

  function handleTypeChange(t: string) {
    if (t === 'none')           onChange(null);
    else if (t === 'osc')       onChange({ type: 'osc', address: defaultAddress });
    else if (t === 'midi-cc')   onChange({ type: 'midi', messageType: 'controlChange', channel: 1, number: 36, minValue: 0, maxValue: 127 });
    else if (t === 'midi-note') onChange({ type: 'midi', messageType: 'noteOn',        channel: 1, number: 36, minValue: 0, maxValue: 127 });
  }

  return (
    <>
      <Field label="Source">
        <select style={styles.input} value={type} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="none">None</option>
          <option value="osc">OSC</option>
          <option value="midi-cc">MIDI CC</option>
          <option value="midi-note">MIDI Note</option>
        </select>
      </Field>
      {mapping?.type === 'osc' && (
        <Field label="Address">
          <input style={styles.input} value={(mapping as OscMapping).address}
            onChange={(e) => onChange({ ...(mapping as OscMapping), address: e.target.value })} />
        </Field>
      )}
      {mapping?.type === 'midi' && (
        <Row>
          <Field label="Channel">
            <NumInput value={(mapping as MidiMapping).channel}
              onChange={(v) => onChange({ ...(mapping as MidiMapping), channel: Math.max(1, Math.min(16, v)) })} />
          </Field>
          <Field label={(mapping as MidiMapping).messageType === 'noteOn' ? 'Note' : 'CC'}>
            <NumInput value={(mapping as MidiMapping).number}
              onChange={(v) => onChange({ ...(mapping as MidiMapping), number: Math.max(0, Math.min(127, v)) })} />
          </Field>
        </Row>
      )}
    </>
  );
}

function FrameSection({ style, patchStyle }: { style: WidgetStyle; patchStyle: (p: Partial<WidgetStyle>) => void }) {
  const frame      = style.frame      ?? 'none';
  const frameColor = style.frameColor ?? '#ffffff';
  const frameSize  = style.frameSize  ?? 1;
  return (
    <Section label="Frame">
      <Field label="Type">
        <select style={styles.input} value={frame}
          onChange={(e) => patchStyle({ frame: e.target.value as WidgetStyle['frame'] })}>
          <option value="none">None</option>
          <option value="outline">Outline (border)</option>
          <option value="underline">Underline</option>
        </select>
      </Field>
      {frame !== 'none' && (
        <Row>
          <Field label="Color">
            <ColorInput value={frameColor} onChange={(v) => patchStyle({ frameColor: v })} />
          </Field>
          <Field label="Size (px)">
            <NumInput value={frameSize} onChange={(v) => patchStyle({ frameSize: Math.max(1, v) })} />
          </Field>
        </Row>
      )}
    </Section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({ label, children, defaultOpen = false }: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: open ? 18 : 8 }}>
      <div
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
          color: 'var(--color-text-dim)', cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: open ? 8 : 0,
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-dim)', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input type="number" style={styles.input} value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))} />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
      <input style={{ ...styles.input, flex: 1 }} value={value}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ─── LFO Inspector Panel ──────────────────────────────────────────────────────

function LfoInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: LfoWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<LfoWidget>) { updateWidget(activePageId, widget.id, partial as never); }

  return (
    <>
      <div style={styles.header}>LFO</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Waveform">
        <select style={styles.input} value={widget.waveform} onChange={(e) => patch({ waveform: e.target.value as LfoWaveform })}>
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="saw">Sawtooth</option>
          <option value="triangle">Triangle</option>
          <option value="random">Random (S&H)</option>
        </select>
      </Section>
      <Section label="Rate">
        <Field label="Mode">
          <select style={styles.input} value={widget.rateMode} onChange={(e) => patch({ rateMode: e.target.value as 'bpm' | 'hz' })}>
            <option value="bpm">BPM-synced</option>
            <option value="hz">Hz</option>
          </select>
        </Field>
        {widget.rateMode === 'bpm' ? (
          <Field label="Beats/cycle">
            <NumInput value={widget.rateMultiplier} onChange={(v) => patch({ rateMultiplier: Math.max(0.0625, v) })} step={0.25} />
          </Field>
        ) : (
          <Field label="Hz">
            <NumInput value={widget.rateHz} onChange={(v) => patch({ rateHz: Math.max(0.01, v) })} step={0.1} />
          </Field>
        )}
      </Section>
      <Section label="Shape">
        <Field label="Amplitude">
          <NumInput value={widget.amplitude} onChange={(v) => patch({ amplitude: Math.max(0, Math.min(2, v)) })} step={0.01} />
        </Field>
        <Field label="Offset">
          <NumInput value={widget.offset} onChange={(v) => patch({ offset: Math.max(0, Math.min(1, v)) })} step={0.01} />
        </Field>
        <Field label="Phase">
          <NumInput value={widget.phase} onChange={(v) => patch({ phase: ((v % 1) + 1) % 1 })} step={0.01} />
        </Field>
      </Section>
      <Section label="Output">
        <MappingEditor mapping={widget.mapping} onChange={(m) => patch({ mapping: m })} />
      </Section>
      <Section label="Play Trigger">
        <TriggerField
          mapping={widget.playMapping ?? null}
          defaultAddress="/lfo/play"
          onChange={(m) => patch({ playMapping: m })}
        />
      </Section>
      <Section label="Stop Trigger">
        <TriggerField
          mapping={widget.stopMapping ?? null}
          defaultAddress="/lfo/stop"
          onChange={(m) => patch({ stopMapping: m })}
        />
      </Section>
    </>
  );
}

// ─── Master Level Inspector Panel ─────────────────────────────────────────────

function MasterLevelInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').MasterLevelWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  function patch(partial: Partial<import('../../../../shared/types/project').MasterLevelWidget>) { updateWidget(activePageId, widget.id, partial as never); }

  return (
    <>
      <div style={styles.header}>Master Level</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Scales protocol">
        <select
          style={styles.input}
          value={widget.protocol}
          onChange={(e) => patch({ protocol: e.target.value as import('../../../../shared/types/project').OutputProtocol })}
        >
          <option value="midi">MIDI</option>
          <option value="osc">OSC</option>
          <option value="enttec">Enttec Open DMX USB</option>
          <option value="artnet">Art-Net (DMX)</option>
          <option value="sacn">sACN / E1.31 (DMX)</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 6 }}>
          Multiplies every value sent on this protocol (0 = silence, 100% = full).
        </div>
      </Section>
      <Section label="Orientation">
        <select
          style={styles.input}
          value={widget.orientation ?? 'vertical'}
          onChange={(e) => patch({ orientation: e.target.value as 'vertical' | 'horizontal' })}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Section>
    </>
  );
}

// ─── Instance Inspector Panel ─────────────────────────────────────────────────

function InstanceInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: import('../../../../shared/types/project').InstanceWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const project = useStore((s) => s.project);
  const sources = project.pages.flatMap((p) => p.widgets).filter((w) => w.id !== widget.id && w.kind !== 'instance');
  function patch(partial: Partial<import('../../../../shared/types/project').InstanceWidget>) { updateWidget(activePageId, widget.id, partial as never); }

  return (
    <>
      <div style={styles.header}>Instance</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Source widget">
        <select
          style={styles.input}
          value={widget.sourceWidgetId}
          onChange={(e) => patch({ sourceWidgetId: e.target.value })}
        >
          <option value="">— none —</option>
          {sources.map((w) => <option key={w.id} value={w.id}>{w.label} ({w.kind})</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 6 }}>
          Mirrors this widget's value — control it from the source or any instance.
        </div>
      </Section>
    </>
  );
}

// ─── Math Inspector Panel ─────────────────────────────────────────────────────

function MathInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: MathWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  const page = useActivePage();
  const widgetOptions = page?.widgets.filter((w) => w.id !== widget.id) ?? [];
  function patch(partial: Partial<MathWidget>) { updateWidget(activePageId, widget.id, partial as never); }

  const usesB = ['add', 'subtract', 'multiply', 'min', 'max', 'avg'].includes(widget.operation);

  function cellOptions(widgetId: string): number[] {
    const w = page?.widgets.find((w) => w.id === widgetId);
    if (!w) return [];
    return Array.from({ length: getCellCount(w) }, (_, i) => i);
  }

  return (
    <>
      <div style={styles.header}>Math / Merge</div>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Source A">
        <Field label="Widget">
          <select style={styles.input} value={widget.sourceAWidgetId}
            onChange={(e) => patch({ sourceAWidgetId: e.target.value, sourceACellIndex: 0 })}>
            <option value="">— none —</option>
            {widgetOptions.map((w) => <option key={w.id} value={w.id}>{w.label} ({w.kind})</option>)}
          </select>
        </Field>
        <Field label="Cell">
          <select style={styles.input} value={widget.sourceACellIndex}
            onChange={(e) => patch({ sourceACellIndex: Number(e.target.value) })}>
            {cellOptions(widget.sourceAWidgetId).map((i) => <option key={i} value={i}>Cell {i}</option>)}
          </select>
        </Field>
      </Section>
      <Section label="Operation">
        <select style={styles.input} value={widget.operation}
          onChange={(e) => patch({ operation: e.target.value as MathOperation })}>
          <option value="add">A + B</option>
          <option value="subtract">A − B</option>
          <option value="multiply">A × B</option>
          <option value="min">min(A, B)</option>
          <option value="max">max(A, B)</option>
          <option value="avg">avg(A, B)</option>
          <option value="invert">1 − A</option>
          <option value="abs">abs(A)</option>
        </select>
      </Section>
      {usesB && (
        <Section label="Source B">
          <Field label="Widget">
            <select style={styles.input} value={widget.sourceBWidgetId}
              onChange={(e) => patch({ sourceBWidgetId: e.target.value, sourceBCellIndex: 0 })}>
              <option value="">— none —</option>
              {widgetOptions.map((w) => <option key={w.id} value={w.id}>{w.label} ({w.kind})</option>)}
            </select>
          </Field>
          <Field label="Cell">
            <select style={styles.input} value={widget.sourceBCellIndex}
              onChange={(e) => patch({ sourceBCellIndex: Number(e.target.value) })}>
              {cellOptions(widget.sourceBWidgetId).map((i) => <option key={i} value={i}>Cell {i}</option>)}
            </select>
          </Field>
        </Section>
      )}
      <Section label="Scale / Offset">
        <Field label="× Scale">
          <NumInput value={widget.scale} onChange={(v) => patch({ scale: v })} step={0.1} />
        </Field>
        <Field label="+ Offset">
          <NumInput value={widget.offset} onChange={(v) => patch({ offset: v })} step={0.01} />
        </Field>
        <Field label="Clamp 0–1">
          <button
            style={styles.input}
            onPointerDown={(e) => { e.preventDefault(); patch({ clampOutput: !widget.clampOutput }); }}
          >
            {widget.clampOutput ? '⬤ On' : '◎ Off'}
          </button>
        </Field>
      </Section>
      <Section label="Output">
        <MappingEditor mapping={widget.mapping} onChange={(m) => patch({ mapping: m })} />
      </Section>
    </>
  );
}

function getCellCount(w: import('../../../../shared/types/project').Widget): number {
  if ('cells' in w && Array.isArray(w.cells)) return w.cells.length;
  if (w.kind === 'xyPad') return 2;
  if (w.kind === 'autoBpm') return 16;
  if (w.kind === 'lfoWidget' || w.kind === 'mathWidget') return 1;
  if (w.kind === 'graphWidget' || w.kind === 'stepSequencer') return 1;
  return 0;
}

// ─── Value Display Inspector Panel ────────────────────────────────────────────

function ValueDisplayInspectorPanel({ widget, activePageId, updateWidget, updateWidgetRect }: {
  widget: ValueDisplayWidget;
  activePageId: string;
  updateWidget: StoreState['updateWidget'];
  updateWidgetRect: StoreState['updateWidgetRect'];
}) {
  // Sources span every page — the runtime is global, so a cross-page readout works.
  const project = useStore((s) => s.project);
  const allWidgets = project.pages.flatMap((p) => p.widgets);
  const widgetOptions = allWidgets.filter((w) => w.id !== widget.id);
  function patch(partial: Partial<ValueDisplayWidget>) { updateWidget(activePageId, widget.id, partial as never); }

  function cellOptions(widgetId: string): number[] {
    const w = allWidgets.find((x) => x.id === widgetId);
    if (!w) return [];
    return Array.from({ length: getCellCount(w) }, (_, i) => i);
  }

  return (
    <>
      <div style={styles.header}>Value Display</div>
      <Section label="Label">
        <input style={styles.input} value={widget.label} onChange={(e) => patch({ label: e.target.value })} />
      </Section>
      <Section label="Position">
        <Row>
          <Field label="X"><NumInput value={widget.rect.x} onChange={(v) => updateWidgetRect(activePageId, widget.id, { x: v })} /></Field>
          <Field label="Y"><NumInput value={widget.rect.y} onChange={(v) => updateWidgetRect(activePageId, widget.id, { y: v })} /></Field>
        </Row>
        <Row>
          <Field label="W"><NumInput value={widget.rect.width} onChange={(v) => updateWidgetRect(activePageId, widget.id, { width: v })} /></Field>
          <Field label="H"><NumInput value={widget.rect.height} onChange={(v) => updateWidgetRect(activePageId, widget.id, { height: v })} /></Field>
        </Row>
      </Section>
      <Section label="Source">
        <Field label="Widget">
          <select style={styles.input} value={widget.sourceWidgetId}
            onChange={(e) => patch({ sourceWidgetId: e.target.value, sourceCellIndex: 0 })}>
            <option value="">— none —</option>
            {widgetOptions.map((w) => <option key={w.id} value={w.id}>{w.label} ({w.kind})</option>)}
          </select>
        </Field>
        <Field label="Cell">
          <select style={styles.input} value={widget.sourceCellIndex}
            onChange={(e) => patch({ sourceCellIndex: Number(e.target.value) })}>
            {cellOptions(widget.sourceWidgetId).map((i) => <option key={i} value={i}>Cell {i}</option>)}
          </select>
        </Field>
      </Section>
      <Section label="Display">
        <Field label="Format">
          <select style={styles.input} value={widget.displayFormat}
            onChange={(e) => patch({ displayFormat: e.target.value as ValueDisplayFormat })}>
            <option value="percent">Percent (0–100%)</option>
            <option value="raw">Raw (0.000–1.000)</option>
            <option value="midi">MIDI (0–127)</option>
          </select>
        </Field>
        <Field label="Decimals">
          <NumInput value={widget.decimals} onChange={(v) => patch({ decimals: Math.max(0, Math.min(3, Math.round(v))) })} />
        </Field>
      </Section>
      <Section label="Style">
        <Field label="Font size">
          <NumInput value={widget.style.fontSize} onChange={(v) => patch({ style: { ...widget.style, fontSize: Math.max(8, v) } })} />
        </Field>
        <Field label="Color">
          <ColorInput value={widget.style.foregroundColor} onChange={(c) => patch({ style: { ...widget.style, foregroundColor: c } })} />
        </Field>
        <Field label="BG color">
          <ColorInput value={widget.style.backgroundColor} onChange={(c) => patch({ style: { ...widget.style, backgroundColor: c } })} />
        </Field>
        <Field label="Show label">
          <button style={styles.input} onPointerDown={(e) => { e.preventDefault(); patch({ style: { ...widget.style, showLabel: !widget.style.showLabel } }); }}>
            {widget.style.showLabel ? '⬤ On' : '◎ Off'}
          </button>
        </Field>
      </Section>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 240,
    flexShrink: 0,
    background: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    padding: 16,
    overflowY: 'auto',
  },
  header: {
    fontSize: 13, fontWeight: 600,
    marginBottom: 16,
    color: 'var(--color-accent)',
    textTransform: 'capitalize',
  },
  input: {
    width: '100%',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px 6px',
    fontSize: 12,
    boxSizing: 'border-box',
  },
  note: {
    fontSize: 11,
    color: 'var(--color-text-dim)',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  pill: {
    display: 'inline-block',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 10,
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-dim)',
    marginRight: 4,
    marginBottom: 4,
  },
};
