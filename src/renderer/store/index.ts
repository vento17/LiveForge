import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createAppSlice, type AppSlice } from './appSlice';
import { createLayoutSlice, type LayoutSlice } from './layoutSlice';
import { createRuntimeSlice, type RuntimeSlice } from './runtimeSlice';

export type StoreState = AppSlice & LayoutSlice & RuntimeSlice;

export const useStore = create<StoreState>()(
  immer((...args) => ({
    ...createAppSlice(...args),
    ...createLayoutSlice(...args),
    ...createRuntimeSlice(...args),
  }))
);

// appSlice.activePageId starts null — sync it from the default project on init
{
  const { project } = useStore.getState();
  if (project.pages.length > 0) {
    useStore.setState({ activePageId: project.activePageId });
  }
}

// ─── Selector hooks (avoid full re-renders) ───────────────────────────────────

export const useMode             = () => useStore((s) => s.mode);
export const useMasterBpm        = () => useStore((s) => s.masterBpm);
export const useIsGlobalPlaying  = () => useStore((s) => s.isGlobalPlaying);
export const useIsLocked        = () => useStore((s) => s.isLocked);
export const useActivePageId    = () => useStore((s) => s.activePageId);
export const useSelectedWidget  = () => useStore((s) => s.selectedWidgetId);
export const useProject         = () => useStore((s) => s.project);
export const useActivePage      = () => useStore((s) =>
  s.project.pages.find((p) => p.id === s.activePageId) ?? null
);
export const useWidgetRuntime   = (widgetId: string) =>
  useStore((s) => s.runtime.widgets[widgetId] ?? null);
