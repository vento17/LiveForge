import React, { useState, useRef, useEffect } from 'react';
import { useStore, useMode, useIsLocked, useProject, useActivePageId } from '../store';
import type { MidiMapping, OscMapping } from '../../shared/types/mapping';
import { bridge } from '../ipc/bridge';
import { AutoBpmService } from '../audio/AutoBpmService';
import type { AutoBpmConfig } from '../audio/AutoBpmService';

export const GLOBAL_BAR_HEIGHT = 76; // 50px main bar + 26px BPM strip
const MAX_PAGES = 8;

// Module-level singleton — persists for the lifetime of the app
let _autoBpmSvc: AutoBpmService | null = null;
function getAutoBpmSvc(): AutoBpmService {
  if (!_autoBpmSvc) {
    _autoBpmSvc = new AutoBpmService(
      (result) => {
        const store = useStore.getState();
        store.setAutoBpmStatus({
          locked:        result.locked,
          confidence:    result.confidence,
          rawBpm:        result.rawBpm,
          beatPhase:     result.beatPhase,
          onsetStrength: result.onsetStrength,
          dropArmed:     result.dropArmed,
        });
        if (result.locked && result.bpm > 0) {
          store.setMasterBpm(Math.round(result.bpm));
        }
      },
      (msg) => { useStore.getState().setAutoBpmError(msg); },
    );
  }
  return _autoBpmSvc;
}

// Returns '#000' or '#fff' depending on which contrasts better with a hex background
function contrastColor(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000' : '#fff';
}

export default function GlobalBar(): React.JSX.Element {
  const mode         = useMode();
  const isLocked     = useIsLocked();
  const project      = useProject();
  const activePageId = useActivePageId();

  const {
    setMode, loadProject, toggleLock,
    openWidgetPicker, openSettings, closeSettings, isSettingsOpen,
    masterBpm, setMasterBpm,
    isGlobalPlaying, setGlobalPlaying, triggerGlobalPlay,
    addPage, removePage, setActivePageId,
    bpmMode, setBpmMode, autoBpmConfig, setAutoBpmConfig,
    autoBpmStatus, autoBpmAudioDeviceId, setAutoBpmAudioDeviceId, autoBpmError, setAutoBpmError,
    midiClockEnabled, midiLearnTarget,
    connectedProtocols, networkEnabled,
  } = useStore((s) => ({
    setMode:                 s.setMode,
    loadProject:             s.loadProject,
    toggleLock:              s.toggleLock,
    openWidgetPicker:        s.openWidgetPicker,
    openSettings:            s.openSettings,
    closeSettings:           s.closeSettings,
    isSettingsOpen:          s.isSettingsOpen,
    masterBpm:               s.masterBpm,
    setMasterBpm:            s.setMasterBpm,
    isGlobalPlaying:         s.isGlobalPlaying,
    setGlobalPlaying:        s.setGlobalPlaying,
    triggerGlobalPlay:       s.triggerGlobalPlay,
    addPage:                 s.addPage,
    removePage:              s.removePage,
    setActivePageId:         s.setActivePageId,
    bpmMode:                 s.bpmMode,
    setBpmMode:              s.setBpmMode,
    autoBpmConfig:           s.autoBpmConfig,
    setAutoBpmConfig:        s.setAutoBpmConfig,
    autoBpmStatus:           s.autoBpmStatus,
    autoBpmAudioDeviceId:    s.autoBpmAudioDeviceId,
    setAutoBpmAudioDeviceId: s.setAutoBpmAudioDeviceId,
    autoBpmError:            s.autoBpmError,
    setAutoBpmError:         s.setAutoBpmError,
    midiClockEnabled:        s.midiClockEnabled,
    midiLearnTarget:         s.midiLearnTarget,
    connectedProtocols:      s.connectedProtocols,
    networkEnabled:          s.networkEnabled,
  }));

  const pages    = project.pages;
  const canAdd   = pages.length < MAX_PAGES;
  const canRemove = pages.length > 1;

  const [bpmInput, setBpmInput]   = useState(String(masterBpm));
  const [tapFlash, setTapFlash]   = useState(false);
  const [resetFlash, setResetFlash] = useState(false);

  const tapMappingRef      = useRef(project.tapTriggerMapping);
  const resetMappingRef    = useRef(project.resetTriggerMapping);
  const flashTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  tapMappingRef.current   = project.tapTriggerMapping;
  resetMappingRef.current = project.resetTriggerMapping;

  useEffect(() => { setBpmInput(String(masterBpm)); }, [masterBpm]);

  // Audio input devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    if (bpmMode !== 'auto') return;
    navigator.mediaDevices.enumerateDevices().then((all) => {
      setAudioDevices(all.filter((d) => d.kind === 'audioinput'));
    }).catch(() => {});
  }, [bpmMode]);

  // Auto BPM service lifecycle
  const autoBpmConfigRef = useRef(autoBpmConfig);
  autoBpmConfigRef.current = autoBpmConfig;

  useEffect(() => {
    const svc = getAutoBpmSvc();
    if (bpmMode === 'auto') {
      setAutoBpmError(null);
      svc.start(autoBpmAudioDeviceId, autoBpmConfigRef.current);
    } else {
      svc.stop();
    }
    return () => { /* keep running on unmount — singleton lives on */ };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmMode, autoBpmAudioDeviceId]);

  // Push config changes to running service
  useEffect(() => {
    if (bpmMode === 'auto') getAutoBpmSvc().updateConfig(autoBpmConfig);
  }, [autoBpmConfig, bpmMode]);

  function commitBpm(raw: string) {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 20 && v <= 300) {
      setMasterBpm(v);
      setBpmInput(String(v));
    } else {
      setBpmInput(String(masterBpm));
    }
  }

  const flashRef = useRef<() => void>(null!);
  flashRef.current = () => {
    setTapFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setTapFlash(false), 60);
  };

  const tapRef = useRef<() => void>(null!);
  tapRef.current = () => {
    flashRef.current();
    useStore.getState().triggerTap();
    setBpmInput(String(useStore.getState().masterBpm));
  };

  const resetRef = useRef<() => void>(null!);
  resetRef.current = () => {
    setResetFlash(true);
    if (resetFlashTimerRef.current) clearTimeout(resetFlashTimerRef.current);
    resetFlashTimerRef.current = setTimeout(() => setResetFlash(false), 120);
    useStore.getState().triggerGlobalReset();
  };

  // ─── MIDI Clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (midiClockEnabled) {
      bridge.send('tr:midi:clockStart', { bpm: masterBpm });
    } else {
      bridge.send('tr:midi:clockStop', undefined as never);
    }
  }, [midiClockEnabled, masterBpm]);

  // ─── Protocol Learn — capture next MIDI CC/note or OSC message ───────────
  // A learned controller becomes an ordinary Router row driving the cell. That
  // is the app's existing answer to "this input moves that cell", so learn gets
  // everything the Router already does for free: it shows up in the router, it
  // is visible and undoable through the right-click menu, Cues snapshot it, and
  // it drives ANY cell — the per-widget MIDI listeners only understood their own
  // message type, which is why learning a CC onto a button grid did nothing.
  //
  // Crucially it also leaves the cell's own mapping alone, so a fader can take
  // MIDI in and keep sending OSC out.
  useEffect(() => {
    if (!midiLearnTarget) return;
    const protocol = midiLearnTarget.protocol ?? 'midi';

    // The row needs a router to live in. Prefer one on the target's own page,
    // else any router in the project, else make one.
    function routerFor(pageId: string, widgetId: string): string | null {
      const { project } = useStore.getState();
      const ownPage = project.pages.find((p) => p.widgets.some((w) => w.id === widgetId))
                   ?? project.pages.find((p) => p.id === pageId);
      const onPage = ownPage?.widgets.find((w) => w.kind === 'router');
      if (onPage) return onPage.id;
      const anywhere = project.pages.flatMap((p) => p.widgets).find((w) => w.kind === 'router');
      if (anywhere) return anywhere.id;
      const host = ownPage?.id ?? pageId;
      if (!host) return null;
      const id = useStore.getState().addWidget(host, 'router');
      const fresh = useStore.getState();
      const page = fresh.project.pages.find((p) => p.id === host);
      const created = page?.widgets.find((w) => w.id === id);
      if (page && created) {
        fresh.updateWidgetRect(host, id, {
          x: Math.max(0, page.width - created.rect.width - 16),
          y: Math.max(0, page.height - created.rect.height - 16),
        });
      }
      return id;
    }

    function bind(t: NonNullable<typeof midiLearnTarget>, input: {
      inputType: 'midiCC' | 'midiNote' | 'osc';
      midiChannel?: number; midiNumber?: number; oscAddress?: string;
    }) {
      const routerId = routerFor(t.pageId, t.widgetId);
      if (!routerId) return;
      useStore.getState().linkSlaveCell({
        slaveWidgetId: t.widgetId, slaveCellIndex: t.cellIndex,
        sourceWidgetId: '', sourceCellIndex: 0,
        routerId, input,
      });
      useStore.getState().setMidiLearnTarget(null);
    }

    if (protocol === 'osc') {
      return bridge.on('tr:osc:feedback', (msg) => {
        const t = useStore.getState().midiLearnTarget;
        if (!t || (t.protocol ?? 'midi') !== 'osc') return;
        const firstArg = msg.args[0];
        if (firstArg === 0 || firstArg === false) return; // ignore release events
        // A non-cell target (an LFO play trigger, say) still learns a mapping.
        if (t.mappingKey) {
          const mapping: OscMapping = { type: 'osc', address: msg.address, minValue: 0, maxValue: 1 };
          useStore.getState().updateCell(t.pageId, t.widgetId, t.cellIndex, { [t.mappingKey]: mapping });
          useStore.getState().setMidiLearnTarget(null);
          return;
        }
        bind(t, { inputType: 'osc', oscAddress: msg.address });
      });
    }

    return bridge.on('tr:midi:inputEvent', (evt) => {
      const t = useStore.getState().midiLearnTarget;
      if (!t) return;
      if (evt.messageType !== 'controlChange' && evt.messageType !== 'noteOn') return;
      if (t.mappingKey) {
        const mapping: MidiMapping = {
          type: 'midi',
          messageType: evt.messageType === 'controlChange' ? 'controlChange' : 'noteOn',
          channel: evt.channel, number: evt.number, minValue: 0, maxValue: 127,
        };
        useStore.getState().updateCell(t.pageId, t.widgetId, t.cellIndex, { [t.mappingKey]: mapping });
        useStore.getState().setMidiLearnTarget(null);
        return;
      }
      bind(t, {
        inputType: evt.messageType === 'controlChange' ? 'midiCC' : 'midiNote',
        midiChannel: evt.channel,
        midiNumber: evt.number,
      });
    });
  }, [midiLearnTarget]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  const modeRef       = useRef(mode);
  const activePgRef   = useRef(activePageId);
  const isLockedKbRef = useRef(isLocked);
  modeRef.current       = mode;
  activePgRef.current   = activePageId;
  isLockedKbRef.current = isLocked;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'F1') {
        e.preventDefault();
        if (activePgRef.current) useStore.getState().setMode('live');
      } else if (e.key === 'Escape') {
        if (!isLockedKbRef.current) useStore.getState().setMode('design');
      } else if (e.key === 't' || e.key === 'T') {
        tapRef.current();
      } else if (e.key === 'r' || e.key === 'R') {
        resetRef.current();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // OSC tap — ignore zero-value releases (TouchDesigner sends on+off pairs)
  useEffect(() => bridge.on('tr:osc:feedback', (msg) => {
    const m = tapMappingRef.current;
    if (!m || m.type !== 'osc') return;
    if (msg.address !== (m as OscMapping).address) return;
    if (msg.args.length > 0 && (msg.args[0] === 0 || msg.args[0] === false)) return;
    tapRef.current();
  }), []);

  // MIDI tap
  useEffect(() => bridge.on('tr:midi:inputEvent', (evt) => {
    const m = tapMappingRef.current;
    if (!m || m.type !== 'midi') return;
    const mm = m as MidiMapping;
    const isCC   = mm.messageType === 'controlChange' && evt.messageType === 'controlChange' && evt.channel === mm.channel && evt.number === mm.number;
    const isNote = mm.messageType === 'noteOn'        && evt.messageType === 'noteOn'        && evt.channel === mm.channel && evt.number === mm.number;
    if (isCC || isNote) tapRef.current();
  }), []);

  // OSC reset
  useEffect(() => bridge.on('tr:osc:feedback', (msg) => {
    const m = resetMappingRef.current;
    if (!m || m.type !== 'osc') return;
    if (msg.address === (m as OscMapping).address) resetRef.current();
  }), []);

  // MIDI reset
  useEffect(() => bridge.on('tr:midi:inputEvent', (evt) => {
    const m = resetMappingRef.current;
    if (!m || m.type !== 'midi') return;
    const mm = m as MidiMapping;
    const isCC   = mm.messageType === 'controlChange' && evt.messageType === 'controlChange' && evt.channel === mm.channel && evt.number === mm.number;
    const isNote = mm.messageType === 'noteOn'        && evt.messageType === 'noteOn'        && evt.channel === mm.channel && evt.number === mm.number;
    if (isCC || isNote) resetRef.current();
  }), []);

  async function handleSave() {
    await bridge.invoke('tr:project:save', project);
  }

  async function handleLoad() {
    const loaded = await bridge.invoke('tr:project:load', undefined as never);
    if (loaded) loadProject(loaded);
  }

  function handleDeleteLast() {
    if (!canRemove) return;
    removePage(pages[pages.length - 1].id);
  }

  return (
    <div style={styles.outerBar}>
      {/* ── Row 1: main bar ── */}
      <div style={styles.bar}>
        {/* Left */}
        <span style={styles.logo}>LiveForge</span>

        {mode === 'design' && (
          <>
            <div style={styles.sep} />
            <Btn onClick={openWidgetPicker}>+ Widget</Btn>
          </>
        )}

        <div style={styles.sep} />
        <Btn onClick={handleSave} disabled={isLocked}>Save</Btn>
        <Btn onClick={handleLoad} disabled={isLocked}>Load</Btn>

        {/* Center: pages (absolutely positioned within row 1) */}
        <div style={styles.pageCenter}>
          {mode === 'design' && (
            <>
              <PageBtn
                label="+"
                title={canAdd ? 'Add page' : `Max ${MAX_PAGES} pages`}
                active={false}
                dimmed={!canAdd}
                bg="var(--color-surface-2)"
                onClick={() => { if (canAdd) addPage(); }}
              />
              <PageBtn
                label="−"
                title={canRemove ? 'Delete last page' : 'Cannot delete last page'}
                active={false}
                dimmed={!canRemove}
                bg="var(--color-surface-2)"
                onClick={handleDeleteLast}
              />
            </>
          )}
          {pages.map((page, i) => {
            const isActive = page.id === activePageId;
            return (
              <PageBtn
                key={page.id}
                label={String(i + 1)}
                title={page.name}
                active={isActive}
                dimmed={false}
                bg={isActive ? page.backgroundColor : 'var(--color-surface-2)'}
                wide={mode === 'live'}
                onClick={() => setActivePageId(page.id)}
              />
            );
          })}
        </div>

        {/* Right spacer */}
        <div style={{ flex: 1 }} />

        {/* Global play / stop */}
        <button
          style={{ ...styles.tapBtn, minWidth: 30, ...(!isGlobalPlaying ? { background: 'var(--color-accent)', border: '1px solid var(--color-accent)', color: '#000' } : {}) }}
          title="Play / restart all tempo widgets"
          onPointerDown={(e) => { e.preventDefault(); triggerGlobalPlay(); }}
        >▶</button>
        <button
          style={{ ...styles.tapBtn, minWidth: 30, ...(isGlobalPlaying ? { background: 'rgba(255,80,80,0.18)', border: '1px solid rgba(255,80,80,0.5)', color: 'rgba(255,130,130,1)' } : { opacity: 0.45 }) }}
          title="Stop all tempo widgets"
          onPointerDown={(e) => { e.preventDefault(); setGlobalPlaying(false); }}
        >■</button>

        <div style={styles.sep} />

        {mode === 'design' && (
          <>
            <Btn onClick={isSettingsOpen ? closeSettings : openSettings} active={isSettingsOpen}>⚙ Settings</Btn>
            <Btn
              onClick={() => { if (activePageId) setMode('live'); }}
              accent
              disabled={!activePageId}
            >▶ Live</Btn>
          </>
        )}

        {mode === 'live' && (
          <Btn onClick={() => setMode('design')} disabled={isLocked}>✕ Config</Btn>
        )}

        <button
          onClick={toggleLock}
          style={{
            ...styles.lockBtn,
            background: isLocked ? '#fff' : 'var(--color-surface-2)',
            border: isLocked ? '1px solid #ccc' : '1px solid var(--color-border)',
            color: isLocked ? '#000' : 'var(--color-text-dim)',
          }}
          title={isLocked ? 'Unlock controls' : 'Lock controls'}
        >
          <svg width="12" height="15" viewBox="0 0 12 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="7" width="10" height="7" rx="1.5" fill="currentColor" fillOpacity={0.15}/>
            {isLocked
              ? <path d="M3 7V5a3 3 0 016 0v2"/>
              : <>
                  <path d="M3 7V5a3 3 0 016 0"/>
                  <line x1="9" y1="5" x2="9" y2="0.5"/>
                </>
            }
            <circle cx="6" cy="10.5" r="1.2" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>

      {/* ── Row 2: BPM strip ── */}
      <div style={styles.bpmRow}>
        {/* BPM cell first */}
        <input
          type="number"
          min={20} max={300}
          value={bpmInput}
          onChange={(e) => setBpmInput(e.target.value)}
          onBlur={(e) => commitBpm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitBpm(bpmInput)}
          style={{ ...styles.bpmRowInput, ...(bpmMode === 'auto' && autoBpmStatus.locked ? { color: '#4efa6a' } : {}) }}
          readOnly={bpmMode === 'auto' && autoBpmStatus.locked}
        />
        <span style={styles.bpmLabel}>BPM</span>

        <div style={styles.sep} />

        {/* Reset */}
        <button
          style={{ ...styles.bpmRowRestartBtn, ...(resetFlash ? styles.resetBtnFlash : {}) }}
          title="Reset tap averaging and all widgets"
          onPointerDown={(e) => { e.preventDefault(); resetRef.current(); }}
        >↺</button>

        {/* TAP / AUTO mode toggle */}
        <div style={styles.bpmRowModeToggle}>
          <button
            style={{ ...styles.bpmRowModeBtn, ...(bpmMode === 'tap' ? styles.modeBtnActive : {}) }}
            onPointerDown={(e) => { e.preventDefault(); setBpmMode('tap'); }}
          >TAP</button>
          <button
            style={{ ...styles.bpmRowModeBtn, ...(bpmMode === 'auto' ? styles.modeBtnActive : {}) }}
            onPointerDown={(e) => { e.preventDefault(); setBpmMode('auto'); }}
          >AUTO</button>
        </div>

        {bpmMode === 'tap' ? (
          <button
            style={{ ...styles.bpmRowTapBtn, ...(tapFlash ? styles.tapBtnFlash : {}) }}
            onPointerDown={(e) => { e.preventDefault(); tapRef.current(); }}
          >TAP</button>
        ) : (
          <AutoBpmControls
            status={autoBpmStatus}
            config={autoBpmConfig}
            devices={audioDevices}
            deviceId={autoBpmAudioDeviceId}
            error={autoBpmError}
            onDeviceChange={setAutoBpmAudioDeviceId}
            onConfigChange={setAutoBpmConfig}
            onResetHistory={() => getAutoBpmSvc().resetHistory()}
            onRestartBar={() => { getAutoBpmSvc().restartBar(); resetRef.current(); }}
          />
        )}

        <div style={{ flex: 1 }} />

        {/* All protocols + network at a glance: white = connected, grey = not */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {PROTO_BADGES.map((b) => (
            <StatusBadge key={b.type} label={b.label} connected={!!connectedProtocols[b.key]} />
          ))}
          <StatusBadge label="NET" connected={networkEnabled} />
        </div>
      </div>
    </div>
  );
}

// Small status pill — lit when the protocol/network is live, dim when only configured.
const PROTO_BADGES: { type: string; label: string; key: string }[] = [
  { type: 'midi',      label: 'MIDI', key: 'midi' },
  { type: 'midiInput', label: 'M·IN', key: 'midiInput' },
  { type: 'osc',       label: 'OSC',  key: 'osc' },
  { type: 'artnet',    label: 'ART',  key: 'artnet' },
  { type: 'sacn',      label: 'sACN', key: 'sacn' },
  { type: 'enttecDmx', label: 'DMX',  key: 'enttec' },
];

function StatusBadge({ label, connected }: { label: string; connected: boolean }): React.JSX.Element {
  return (
    <span
      title={connected ? `${label} — connected` : `${label} — not connected`}
      style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.5, fontFamily: 'monospace',
        padding: '2px 6px', borderRadius: 3, lineHeight: 1, whiteSpace: 'nowrap',
        color: connected ? '#ffffff' : '#3a3a3a',
        background: connected ? 'rgba(255,255,255,0.12)' : 'transparent',
        border: `1px solid ${connected ? 'rgba(255,255,255,0.55)' : 'var(--color-border)'}`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Auto BPM controls ────────────────────────────────────────────────────────

function AutoBpmControls({ status, config, devices, deviceId, error, onDeviceChange, onConfigChange, onResetHistory, onRestartBar }: {
  status: { locked: boolean; confidence: number; rawBpm: number; onsetStrength: number; dropArmed: boolean };
  config: AutoBpmConfig;
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  error: string | null;
  onDeviceChange: (id: string | null) => void;
  onConfigChange: (patch: Partial<AutoBpmConfig>) => void;
  onResetHistory: () => void;
  onRestartBar: () => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showConfig) return;
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setShowConfig(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showConfig]);

  const dotColor = error ? '#ff4444' : status.locked ? '#4efa6a' : '#ffaa22';
  const dotTitle = error ? `Error: ${error}` : status.locked ? `Locked · conf ${(status.confidence*100).toFixed(0)}%` : 'Acquiring…';
  const confPct = Math.round(status.confidence * 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      {/* Lock indicator + confidence */}
      <div title={dotTitle} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 4px ${dotColor}`, flexShrink: 0 }} />
        <div style={{ width: 36, height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${confPct}%`, height: '100%', background: dotColor, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Audio device selector */}
      <select
        title="Audio input device"
        style={{ ...autoSelectStyle, maxWidth: 130 }}
        value={deviceId ?? ''}
        onChange={(e) => onDeviceChange(e.target.value || null)}
      >
        <option value="">Default input</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${d.deviceId.slice(0,6)}`}</option>
        ))}
      </select>

      {/* Club mode quick toggle */}
      <button
        title="Club Mode: round BPM to nearest integer, bias toward 120–128"
        style={{ ...autoIconBtn, ...(config.clubMode ? { color: 'var(--color-accent)', border: '1px solid var(--color-accent)' } : {}) }}
        onPointerDown={(e) => { e.preventDefault(); onConfigChange({ clubMode: !config.clubMode }); }}
      >CLUB</button>

      {/* Drop armed indicator */}
      {status.dropArmed && (
        <span style={{ fontSize: 9, color: '#ffaa22', padding: '0 3px', fontWeight: 700, letterSpacing: '0.05em', animation: 'none' }}>
          DROP
        </span>
      )}

      {/* Reset history */}
      <button title="Reset BPM history" style={autoIconBtn} onPointerDown={(e) => { e.preventDefault(); onResetHistory(); }}>↺H</button>

      {/* Restart bar */}
      <button title="Restart bar (re-align beat)" style={autoIconBtn} onPointerDown={(e) => { e.preventDefault(); onRestartBar(); }}>⟳</button>

      {/* Config popover toggle */}
      <button title="Auto BPM settings" style={{ ...autoIconBtn, ...(showConfig ? { color: 'var(--color-accent)', border: '1px solid var(--color-accent)' } : {}) }}
        onPointerDown={(e) => { e.preventDefault(); setShowConfig((v) => !v); }}>⚙</button>

      {showConfig && (
        <div ref={popRef} style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', right: 0,
          background: 'var(--color-surface)', border: '1px solid var(--color-border-bright)',
          borderRadius: 4, padding: '10px 12px', zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 7, minWidth: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-accent)', marginBottom: 2 }}>AUTO BPM CONFIG</div>
          <CfgRow label="Min BPM">
            <NumCfg value={config.minBpm} onChange={(v) => onConfigChange({ minBpm: Math.max(30, Math.min(config.maxBpm - 1, v)) })} />
          </CfgRow>
          <CfgRow label="Max BPM">
            <NumCfg value={config.maxBpm} onChange={(v) => onConfigChange({ maxBpm: Math.max(config.minBpm + 1, Math.min(300, v)) })} />
          </CfgRow>
          <CfgRow label="Sensitivity">
            <NumCfg value={config.sensitivity} onChange={(v) => onConfigChange({ sensitivity: Math.max(0.2, Math.min(3, v)) })} step={0.1} />
          </CfgRow>
          <CfgRow label="Stability">
            <NumCfg value={config.stability} onChange={(v) => onConfigChange({ stability: Math.max(0, Math.min(0.995, v)) })} step={0.01} />
          </CfgRow>
          <CfgRow label="Window (s)">
            <NumCfg value={config.analysisWindowSec} onChange={(v) => onConfigChange({ analysisWindowSec: Math.max(2, Math.min(32, v)) })} />
          </CfgRow>
          <CfgRow label="Attack (ms)">
            <NumCfg value={config.attackMs} onChange={(v) => onConfigChange({ attackMs: Math.max(0.5, Math.min(50, v)) })} step={0.5} />
          </CfgRow>
          <CfgRow label="Release (ms)">
            <NumCfg value={config.releaseMs} onChange={(v) => onConfigChange({ releaseMs: Math.max(10, Math.min(500, v)) })} step={5} />
          </CfgRow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Toggle label="Club Mode" value={config.clubMode} onChange={(v) => onConfigChange({ clubMode: v })} />
            <Toggle label="Mic Mode"  value={config.micMode}  onChange={(v) => onConfigChange({ micMode: v })} />
            <Toggle label="Auto Drop Restart" value={config.autoDropRestart} onChange={(v) => onConfigChange({ autoDropRestart: v })} />
          </div>
          {status.rawBpm > 0 && (
            <div style={{ fontSize: 9, color: 'var(--color-text-dim)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              raw {status.rawBpm.toFixed(1)} · conf {confPct}% · onset {(status.onsetStrength * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const autoSelectStyle: React.CSSProperties = {
  height: 20, fontSize: 9, padding: '0 3px',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit',
};
const autoIconBtn: React.CSSProperties = {
  height: 20, padding: '0 5px', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer',
  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-dim)', borderRadius: 'var(--radius-sm)',
  display: 'flex', alignItems: 'center',
};

function CfgRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function NumCfg({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
      style={{ width: 64, height: 24, textAlign: 'right', fontSize: 10, padding: '0 4px',
        background: '#000', border: '1px solid var(--color-border)', color: 'var(--color-accent)',
        borderRadius: 2, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-dim)' }}>{label}</span>
      <button
        onPointerDown={(e) => { e.preventDefault(); onChange(!value); }}
        style={{
          width: 36, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', position: 'relative',
          background: value ? 'var(--color-accent)' : 'var(--color-border)', transition: 'background 0.15s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 18 : 3,
          width: 12, height: 12, borderRadius: '50%', background: value ? '#000' : 'var(--color-text-dim)',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  );
}

// ─── Page button ──────────────────────────────────────────────────────────────

function PageBtn({ label, title, active, dimmed, bg, wide, onClick }: {
  label: string;
  title: string;
  active: boolean;
  dimmed: boolean;
  bg: string;
  wide?: boolean;
  onClick: () => void;
}) {
  const fgColor = active ? contrastColor(bg.startsWith('#') ? bg : '#111') : 'var(--color-text-dim)';
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: wide ? 72 : 42,
        height: 40,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'inherit',
        letterSpacing: '0.04em',
        cursor: dimmed ? 'default' : 'pointer',
        borderRadius: 'var(--radius-sm)',
        background: active ? bg : 'var(--color-surface-2)',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        color: fgColor,
        opacity: dimmed ? 0.3 : 1,
        transition: 'background 0.08s, color 0.08s',
        pointerEvents: dimmed ? 'none' : undefined,
      }}
    >
      {label}
    </button>
  );
}

// ─── Generic bar button ───────────────────────────────────────────────────────

function Btn({
  children, onClick, disabled, active, accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.btn,
        ...(accent   ? styles.btnAccent   : {}),
        ...(active   ? styles.btnActive   : {}),
        ...(disabled ? styles.btnDisabled : {}),
      }}
    >
      {children}
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  outerBar: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border-bright)',
    fontFamily: 'inherit',
  },
  bar: {
    height: 50,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 12px',
    position: 'relative',
  },
  bpmRow: {
    height: 26,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    borderTop: '1px solid var(--color-border)',
  },
  pageCenter: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    pointerEvents: 'auto',
  },
  logo: {
    fontWeight: 700,
    fontSize: 13,
    marginRight: 4,
    color: 'var(--color-accent)',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
  },
  sep: {
    width: 1,
    height: 16,
    background: 'var(--color-border)',
    margin: '0 2px',
  },
  btn: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 14px',
    height: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-md)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.05em',
    boxSizing: 'border-box',
  },
  btnAccent: {
    background: 'var(--color-accent)',
    border: '1px solid var(--color-accent)',
    color: '#000',
    fontWeight: 700,
  },
  btnActive: {
    background: 'var(--color-accent-dim)',
    border: '1px solid var(--color-accent)',
    color: 'var(--color-accent)',
  },
  btnDisabled: {
    opacity: 0.3,
    cursor: 'default',
    pointerEvents: 'none',
  },
  bpmInput: {
    width: 70,
    height: 42,
    textAlign: 'center',
    borderRadius: 1,
    padding: '0 6px',
    background: '#000',
    border: '1px solid var(--color-border)',
    color: 'var(--color-accent)',
    fontSize: 16,
    fontFamily: 'inherit',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  bpmRowInput: {
    width: 62,
    height: 20,
    textAlign: 'center',
    borderRadius: 1,
    padding: '0 4px',
    background: '#000',
    border: '1px solid var(--color-border)',
    color: 'var(--color-accent)',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  bpmLabel: {
    fontSize: 9,
    color: 'var(--color-text-dim)',
    marginLeft: -3,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  restartBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 6px',
    height: 42,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  bpmRowRestartBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 4px',
    height: 20,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  tapBtn: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-dim)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 14px',
    height: 42,
    display: 'flex',
    alignItems: 'center',
    fontSize: 12,
    fontFamily: 'inherit',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.05s, color 0.05s, border-color 0.05s',
    boxSizing: 'border-box',
  },
  bpmRowTapBtn: {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-dim)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 10px',
    height: 20,
    display: 'flex',
    alignItems: 'center',
    fontSize: 10,
    fontFamily: 'inherit',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.05s, color 0.05s, border-color 0.05s',
    boxSizing: 'border-box',
  },
  tapBtnFlash: {
    background: 'var(--color-accent)',
    border: '1px solid var(--color-accent)',
    color: '#000',
  },
  resetBtnFlash: {
    color: '#000',
    background: 'var(--color-accent)',
    borderRadius: 'var(--radius-sm)',
  },
  lockBtn: {
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    height: 42,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  modeToggle: {
    display: 'flex',
    height: 30,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  bpmRowModeToggle: {
    display: 'flex',
    height: 20,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  modeBtn: {
    padding: '0 9px',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'inherit',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    background: 'var(--color-surface-2)',
    border: 'none',
    color: 'var(--color-text-dim)',
    transition: 'background 0.08s, color 0.08s',
  },
  bpmRowModeBtn: {
    padding: '0 7px',
    fontSize: 9,
    fontWeight: 600,
    fontFamily: 'inherit',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    background: 'var(--color-surface-2)',
    border: 'none',
    color: 'var(--color-text-dim)',
    transition: 'background 0.08s, color 0.08s',
  },
  modeBtnActive: {
    background: 'var(--color-accent)',
    color: '#000',
  },
};
