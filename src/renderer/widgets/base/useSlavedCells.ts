import { useMemo } from 'react';
import { useStore } from '../../store';
import { computeSlavedCellSet } from './links';

// Red outline drawn on a cell that is slaved (driven by a router link).
export const SLAVE_OUTLINE = '2px solid #ff2d2d';

// Set of cell indices of `widgetId` currently slaved by a router link. Recomputes
// only when the project changes (not on every runtime value update).
export function useSlavedCells(widgetId: string): Set<number> {
  const project = useStore((s) => s.project);
  return useMemo(() => computeSlavedCellSet(project, widgetId), [project, widgetId]);
}
