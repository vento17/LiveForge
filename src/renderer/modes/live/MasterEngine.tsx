import { useEffect } from 'react';
import type { MasterLevelWidget } from '../../../shared/types/project';
import { useStore } from '../../store';
import { setMasterGain, clearMasterGain, resetMasterGains } from '../../ipc/dispatch';

const PROTOCOLS = ['midi', 'osc', 'artnet', 'sacn', 'enttec'] as const;

// Headless engine: applies every MasterLevel's runtime value as a per-protocol
// output gain, across ALL pages. This is what makes a master cross-page — its
// gain is honored even while its own page isn't shown (drive it from an Instance
// on another page). Absent protocols are cleared so deleting a master restores
// full output.
function applyGains(): void {
  const state = useStore.getState();
  const desired: Partial<Record<typeof PROTOCOLS[number], number>> = {};
  for (const page of state.project.pages) {
    for (const w of page.widgets) {
      if (w.kind !== 'masterLevel') continue;
      const m = w as MasterLevelWidget;
      const v = state.runtime.widgets[m.id]?.cells[0]?.value ?? 1;
      desired[m.protocol] = v;   // last master wins for a shared protocol
    }
  }
  for (const p of PROTOCOLS) {
    if (desired[p] !== undefined) setMasterGain(p, desired[p]!);
    else clearMasterGain(p);
  }
}

export default function MasterEngine(): null {
  useEffect(() => {
    applyGains();
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.runtime.widgets !== prev.runtime.widgets || state.project !== prev.project) {
        applyGains();
      }
    });
    return () => { unsubscribe(); resetMasterGains(); };
  }, []);
  return null;
}
