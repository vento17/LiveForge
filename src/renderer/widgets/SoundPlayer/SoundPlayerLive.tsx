import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { SoundPlayerWidget } from '../../../shared/types/project';
import { useStore } from '../../store';
import CellLinkMenu from '../base/CellLinkMenu';
import { dispatchValue } from '../../ipc/dispatch';

interface TrackState {
  playing: boolean;
  paused: boolean;   // paused mid-track (resume from position)
  currentTime: number;
  duration: number;
}

function makeTrackState(): TrackState {
  return { playing: false, paused: false, currentTime: 0, duration: 0 };
}

export default function SoundPlayerLive({ widget }: { widget: SoundPlayerWidget }): React.JSX.Element {
  const widgetRef = useRef(widget);
  widgetRef.current = widget;

  // One Audio element per track (keyed by track id)
  const audioRefs  = useRef<Record<string, HTMLAudioElement>>({});
  const [states, setStates] = useState<TrackState[]>(() => widget.tracks.map(makeTrackState));
  // Each track is cells[i]: a rising edge plays it, a falling edge stops it. The
  // wiring was there but there was no way to Learn onto it — no context menu.
  const [contextMenu, setContextMenu] = useState<{ cellIndex: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [contextMenu]);

  const statesRef  = useRef(states);
  statesRef.current = states;

  // Keep states array in sync when tracks change
  useEffect(() => {
    setStates((prev) => widget.tracks.map((_t, i) => prev[i] ?? makeTrackState()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.tracks.length]);

  // Build / teardown Audio elements when tracks change
  useEffect(() => {
    const current = audioRefs.current;
    const newMap: Record<string, HTMLAudioElement> = {};

    widget.tracks.forEach((track, i) => {
      if (current[track.id]) {
        newMap[track.id] = current[track.id];
        newMap[track.id].volume = track.volume * widget.masterVolume;
      } else if (track.src) {
        const audio = new Audio(track.src);
        audio.volume = track.volume * widget.masterVolume;
        audio.addEventListener('ended', () => handleStop(i));
        audio.addEventListener('timeupdate', () => {
          setStates((prev) => {
            const next = [...prev];
            if (next[i]) next[i] = { ...next[i], currentTime: audio.currentTime, duration: audio.duration || 0 };
            return next;
          });
        });
        newMap[track.id] = audio;
      }
    });

    // Remove stale audio elements
    Object.keys(current).forEach((id) => {
      if (!newMap[id]) {
        current[id].pause();
        current[id].src = '';
      }
    });

    audioRefs.current = newMap;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.tracks]);

  // Update volumes when they change
  useEffect(() => {
    widget.tracks.forEach((track) => {
      const audio = audioRefs.current[track.id];
      if (audio) audio.volume = Math.max(0, Math.min(1, track.volume * widget.masterVolume));
    });
  }, [widget.tracks, widget.masterVolume]);

  const handlePlay = useCallback((i: number) => {
    const track = widgetRef.current.tracks[i];
    if (!track) return;
    const audio = audioRefs.current[track.id];
    if (!audio) return;

    // Stop all other tracks
    widgetRef.current.tracks.forEach((t, j) => {
      if (j !== i) {
        const a = audioRefs.current[t.id];
        if (a) { a.pause(); a.currentTime = 0; }
        useStore.getState().setCellValue(widgetRef.current.id, j, 0);
      }
    });

    const isPaused = statesRef.current[i]?.paused;
    if (!isPaused) audio.currentTime = 0;
    audio.play().catch(() => {});

    setStates((prev) => {
      const next = prev.map((s, j) => j === i
        ? { ...s, playing: true, paused: false }
        : { ...s, playing: false, paused: false });
      return next;
    });

    useStore.getState().setCellValue(widgetRef.current.id, i, 1);
    if (track.playMapping) dispatchValue(track.playMapping, 1);
  }, []);

  const handlePause = useCallback((i: number) => {
    const track = widgetRef.current.tracks[i];
    if (!track) return;
    const audio = audioRefs.current[track.id];
    if (!audio) return;
    audio.pause();
    setStates((prev) => {
      const next = [...prev];
      if (next[i]) next[i] = { ...next[i], playing: false, paused: true };
      return next;
    });
    useStore.getState().setCellValue(widgetRef.current.id, i, 0);
  }, []);

  const handleStop = useCallback((i: number) => {
    const track = widgetRef.current.tracks[i];
    if (!track) return;
    const audio = audioRefs.current[track.id];
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setStates((prev) => {
      const next = [...prev];
      if (next[i]) next[i] = { ...next[i], playing: false, paused: false, currentTime: 0 };
      return next;
    });
    useStore.getState().setCellValue(widgetRef.current.id, i, 0);
    const mapping = widgetRef.current.tracks[i]?.playMapping;
    if (mapping) dispatchValue(mapping, 0);
  }, []);

  // Subscribe to own runtime cells for Router-driven play triggers
  useEffect(() => {
    const prevCellValues = new Array(widget.tracks.length).fill(0);

    const unsubscribe = useStore.subscribe((state) => {
      const wr = state.runtime.widgets[widgetRef.current.id];
      if (!wr) return;
      wr.cells.forEach((cell, i) => {
        const prev = prevCellValues[i] ?? 0;
        const v = cell.value ?? 0;
        prevCellValues[i] = v;
        if (prev < 0.5 && v >= 0.5 && !statesRef.current[i]?.playing) {
          handlePlay(i);
        } else if (prev >= 0.5 && v < 0.5 && statesRef.current[i]?.playing) {
          handleStop(i);
        }
      });
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id]);

  const color = widget.style.foregroundColor;
  const fs = widget.style.fontSize || 13;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', fontFamily: 'monospace', overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', borderBottom: '1px solid #1e1e1e', flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#505050', textTransform: 'uppercase' }}>
          ◈ sound player
        </span>
        <span style={{ fontSize: 9, color: '#444' }}>
          vol {Math.round(widget.masterVolume * 100)}%
        </span>
      </div>

      {/* Track list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {widget.tracks.length === 0 ? (
          <div style={{ fontSize: 10, color: '#303030', fontStyle: 'italic', padding: '8px 10px' }}>
            no tracks — add in inspector
          </div>
        ) : widget.tracks.map((track, i) => {
          const st = states[i] ?? makeTrackState();
          const pct = st.duration > 0 ? st.currentTime / st.duration : 0;
          return (
            <TrackRow
              key={track.id}
              index={i}
              widgetId={widget.id}
              label={track.label || track.fileName || `Track ${i + 1}`}
              playing={st.playing}
              paused={st.paused}
              progress={pct}
              volume={track.volume}
              color={color}
              fs={fs}
              onPlay={() => handlePlay(i)}
              onPause={() => handlePause(i)}
              onStop={() => handleStop(i)}
              onVolume={(v) => {
                const tracks = widgetRef.current.tracks.map((t, j) =>
                  j === i ? { ...t, volume: v } : t,
                );
                useStore.getState().updateWidget(
                  useStore.getState().activePageId!,
                  widget.id,
                  { tracks } as never,
                );
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ cellIndex: i, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}
      </div>
      {contextMenu && (
        <CellLinkMenu
          x={contextMenu.x}
          y={contextMenu.y}
          widgetId={widget.id}
          cellIndex={contextMenu.cellIndex}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function TrackRow({ index, widgetId, label, playing, paused, progress, volume, color, fs,
  onPlay, onPause, onStop, onVolume, onContextMenu }: {
  index: number; widgetId: string; label: string; playing: boolean; paused: boolean; progress: number;
  volume: number; color: string; fs: number;
  onPlay: () => void; onPause: () => void; onStop: () => void; onVolume: (v: number) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px',
    fontSize: 11, color: active ? color : '#555',
    lineHeight: 1,
  });

  return (
    <div
      data-lf-widget={widgetId} data-lf-cell={index}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 8px',
        background: playing ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: playing ? `2px solid ${color}` : '2px solid transparent',
      }}>
      {/* Index */}
      <span style={{ fontSize: 9, color: '#444', width: 14, textAlign: 'right', flexShrink: 0 }}>
        {index + 1}
      </span>

      {/* Controls */}
      <button style={btnStyle(playing && !paused)} onClick={playing && !paused ? onPause : onPlay}>
        {playing && !paused ? '⏸' : '▶'}
      </button>
      <button style={btnStyle()} onClick={onStop}>■</button>

      {/* Label + progress bar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{
          fontSize: fs, color: playing ? '#ddd' : '#666',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: color + '80', transition: 'width 0.2s linear' }} />
        </div>
      </div>

      {/* Volume */}
      <input type="range" min={0} max={1} step={0.01} value={volume}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        style={{ width: 48, accentColor: color, flexShrink: 0 }}
      />
    </div>
  );
}
