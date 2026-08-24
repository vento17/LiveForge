import type { Project, Widget } from '../../../shared/types/project';

// What a Cues widget records and recalls. Both dropdowns default to "all", so
// out of the box a cue is a snapshot of the whole desk across every page —
// scoping it down is the exception, not the setup step.
export const CUE_SCOPE_ALL = 'all';

// Widgets that hold no state worth storing in a cue.
function isSnapshottable(w: Widget): boolean {
  return w.kind !== 'textWidget' && w.kind !== 'imageWidget'
      && w.kind !== 'cues' && w.kind !== 'manual';
}

export function cueScopePages(project: Project): { id: string; label: string }[] {
  return [
    { id: CUE_SCOPE_ALL, label: 'All pages' },
    ...project.pages.map((p) => ({ id: p.id, label: p.name })),
  ];
}

// The widget list follows the page choice, so picking a page narrows this one
// automatically instead of leaving a stale selection behind.
export function cueScopeWidgets(project: Project, scopePageId?: string): { id: string; label: string }[] {
  const pages = (!scopePageId || scopePageId === CUE_SCOPE_ALL)
    ? project.pages
    : project.pages.filter((p) => p.id === scopePageId);
  const many = project.pages.length > 1 && (!scopePageId || scopePageId === CUE_SCOPE_ALL);
  return [
    { id: CUE_SCOPE_ALL, label: 'ALL WIDGETS' },
    ...pages.flatMap((p) => p.widgets.filter(isSnapshottable).map((w) => ({
      id: w.id,
      label: many ? `${p.name} · ${w.label}` : w.label,
    }))),
  ];
}

// The widgets a cue should actually capture, given its scope.
export function widgetsInScope(project: Project, scopePageId?: string, scopeWidgetId?: string): Widget[] {
  const pages = (!scopePageId || scopePageId === CUE_SCOPE_ALL)
    ? project.pages
    : project.pages.filter((p) => p.id === scopePageId);
  const all = pages.flatMap((p) => p.widgets).filter(isSnapshottable);
  if (!scopeWidgetId || scopeWidgetId === CUE_SCOPE_ALL) return all;
  // A widget picked and then deleted (or moved off the scoped page) narrows the
  // cue to nothing rather than silently falling back to everything.
  return all.filter((w) => w.id === scopeWidgetId);
}
