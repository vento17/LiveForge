import { useEffect, useRef } from 'react';
import { useStore } from '../../store';

/**
 * Wire a widget transport to the three top-bar buttons.
 *
 * Play, Stop and Reset were only ever reaching the Step Sequencer and the Graph;
 * the LFO listened to the reset tick but ignored Stop entirely, so pressing Stop
 * left it running.
 *
 * What follows the top bar, and what does not:
 *   LFO, Step Sequencer, Graph   follow it
 *   Timeline, Sound Player       stand apart, on purpose
 *
 * A show and its audio run from their own transports: putting the desk into
 * play, stopping it or resetting it must not start, halt or rewind them.
 *
 * The meanings:
 *   Play   start, and restart from the top even if already running
 *   Stop   stop where you are
 *   Reset  return to the start point, keeping whatever play state you had
 *
 * Per-widget play/stop buttons and their own MIDI/OSC mappings are untouched:
 * this only adds a way to drive them all at once.
 */
export function useGlobalTransport(handlers: {
  start?: () => void;
  stop?: () => void;
  reset?: () => void;
}): void {
  const isGlobalPlaying = useStore((s) => s.isGlobalPlaying);
  const globalPlayTick  = useStore((s) => s.globalPlayTick);
  const globalStopTick  = useStore((s) => s.globalStopTick);
  const globalResetTick = useStore((s) => s.globalResetTick);

  // Handlers are re-created every render; a ref keeps the effects from
  // re-subscribing (and re-firing) on each one.
  const h = useRef(handlers);
  h.current = handlers;

  // On mount, follow the desk only when it is already playing: entering Live
  // mode with the transport running should bring widgets up running. The reverse
  // is not true — stopping on mount would override a widget that legitimately
  // comes up playing, as the LFO does.
  const mounted = useRef(false);
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (isGlobalPlaying) h.current.start?.();
    else if (!first)     h.current.stop?.();
  }, [isGlobalPlaying]);

  const firstStop = useRef(true);
  useEffect(() => {
    if (firstStop.current) { firstStop.current = false; return; }
    h.current.stop?.();
  }, [globalStopTick]);

  const firstPlay = useRef(true);
  useEffect(() => {
    if (firstPlay.current) { firstPlay.current = false; return; }
    h.current.reset?.();
    h.current.start?.();
  }, [globalPlayTick]);

  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    h.current.reset?.();
  }, [globalResetTick]);
}
