import { useStore } from '../../store';

/**
 * Create a Router widget on a page and park it in the bottom-right corner.
 *
 * Lives apart from links.ts because that module is pure (project in, data out)
 * while this one writes to the store. Shared by the right-click link menu and
 * by the header learn buttons, so a router made either way looks the same.
 */
export function createRouterOn(pageId: string): string {
  const store = useStore.getState();
  const id = store.addWidget(pageId, 'router');

  const fresh = useStore.getState();
  const page = fresh.project.pages.find((p) => p.id === pageId);
  const created = page?.widgets.find((w) => w.id === id);
  if (page && created) {
    const margin = 16;
    fresh.updateWidgetRect(pageId, id, {
      x: Math.max(0, page.width - created.rect.width - margin),
      y: Math.max(0, page.height - created.rect.height - margin),
    });
  }
  return id;
}
