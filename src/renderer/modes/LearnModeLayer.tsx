import { useEffect } from 'react';
import { useStore } from '../store';

/**
 * Learn mode — arm the whole UI instead of one cell at a time.
 *
 * Right-clicking every fader to pick "Learn" is fine for one control and
 * painful for a desk. With learn mode on you tap a cell, move the physical
 * knob, tap the next cell, and so on without ever leaving the surface — which
 * matters on a touchscreen, where there is no right-click at all.
 *
 * Cells opt in by carrying data-lf-widget / data-lf-cell. This component owns
 * the whole interaction: it captures the pointer before the widget can act on
 * it, so tapping a button while patching does not also fire it.
 */
export default function LearnModeLayer(): null {
  const learnMode = useStore((s) => s.learnMode);

  useEffect(() => {
    if (!learnMode) {
      document.body.classList.remove('lf-learn');
      document.querySelectorAll('[data-lf-armed]').forEach((el) => el.removeAttribute('data-lf-armed'));
      return;
    }
    document.body.classList.add('lf-learn');
    const protocol = learnMode;

    function cellOf(e: Event): HTMLElement | null {
      return ((e.target as HTMLElement | null)?.closest?.('[data-lf-cell]') as HTMLElement | null) ?? null;
    }

    // Arming happens on pointerdown, but pointerdown alone is not enough to
    // silence the widget: several controls act on click, and preventing a
    // pointerdown does not cancel the click that follows it. So every pointer
    // event that lands inside a cell is swallowed while learn mode is on.
    function swallow(e: Event) {
      if (!cellOf(e)) return;              // taps outside a cell behave normally
      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerDown(e: PointerEvent) {
      const el = cellOf(e);
      if (!el) return;
      // Right-click still belongs to the link menu, which knows how to unlink.
      if (e.button !== 0) return;
      swallow(e);

      const widgetId  = el.getAttribute('data-lf-widget') ?? '';
      const cellIndex = Number(el.getAttribute('data-lf-cell'));
      if (!widgetId || !Number.isFinite(cellIndex)) return;

      const store = useStore.getState();
      // Bind onto the page the widget actually lives on, not the visible one —
      // every page stays mounted in Live mode, so they are not always the same.
      const pageId = store.project.pages.find((p) => p.widgets.some((w) => w.id === widgetId))?.id
                  ?? store.activePageId;
      if (!pageId) return;

      const prev = store.midiLearnTarget;
      // Tapping the armed cell again disarms it.
      if (prev && prev.widgetId === widgetId && prev.cellIndex === cellIndex) {
        store.setMidiLearnTarget(null);
        return;
      }
      store.setMidiLearnTarget({
        pageId, widgetId, cellIndex, protocol,
        routerId: store.learnRouterId ?? undefined,
      });
    }

    // Capture phase, on document: React attaches at its root container and
    // react-rnd on the element, so both sit below us and never see the event.
    const SWALLOWED = ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerup'] as const;
    document.addEventListener('pointerdown', onPointerDown, true);
    SWALLOWED.forEach((t) => document.addEventListener(t, swallow, true));
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      SWALLOWED.forEach((t) => document.removeEventListener(t, swallow, true));
      document.body.classList.remove('lf-learn');
    };
  }, [learnMode]);

  // Highlight the armed cell. Done from the DOM rather than through each
  // widget's render path so no widget needs to know learn mode exists.
  const target = useStore((s) => s.midiLearnTarget);
  useEffect(() => {
    document.querySelectorAll('[data-lf-armed]').forEach((el) => el.removeAttribute('data-lf-armed'));
    if (!learnMode || !target) return;
    const sel = `[data-lf-widget="${CSS.escape(target.widgetId)}"][data-lf-cell="${target.cellIndex}"]`;
    document.querySelectorAll(sel).forEach((el) => el.setAttribute('data-lf-armed', '1'));
  }, [learnMode, target]);

  // Esc leaves learn mode without leaving Live mode.
  useEffect(() => {
    if (!learnMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      useStore.getState().setLearnMode(null);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [learnMode]);

  return null;
}
