/**
 * wireEventItemInteractions — attach click/keyboard/hover behaviors to a freshly-rendered
 * `.event-item` element.
 *
 * Three behaviors:
 *
 *   1. **Codex hover** — `pointerenter`/`pointerleave` on the thumb forwards to
 *      `window.CodexCanvasService.applyCodexEventThumbnailFilterHover(event, displayEvent)`
 *      so the codex canvas can dim non-matching nodes while the manager card is hovered.
 *
 *   2. **Open-on-globe** — the thumbnail (non-GitHub-Pages) or the whole card
 *      (GitHub-Pages) becomes a `role="button"` that calls
 *      `eventManager.openEventFromList(event, index)`. Clicks on the variant badge bubble
 *      through unrouted so they can hit the cycle handler instead.
 *
 *   3. **Variant cycle** — clicks on `.multi-event-badge` (only present for multi-events)
 *      call `eventManager.cycleEventVariant(index, event, item)`. We also stop `mousedown`
 *      so the surrounding drag handler doesn't initiate a drag on the badge.
 *
 * @param {{
 *   item: HTMLElement,
 *   eventManager: any,
 *   event: Record<string, any>,
 *   displayEvent: Record<string, any>,
 *   index: number,
 *   isMultiEvent: boolean,
 *   isGitHubPages: boolean,
 * }} ctx
 */
export function wireEventItemInteractions(ctx) {
    const { item, eventManager, event, displayEvent, index, isMultiEvent, isGitHubPages } = ctx;

    const thumbBlock = item.querySelector('.event-item__thumb-block');

    if (thumbBlock) {
        thumbBlock.addEventListener('pointerenter', () => {
            const cx = typeof window !== 'undefined' ? window.CodexCanvasService : null;
            if (cx && typeof cx.applyCodexEventThumbnailFilterHover === 'function') {
                cx.applyCodexEventThumbnailFilterHover(event, displayEvent);
            }
        });
        thumbBlock.addEventListener('pointerleave', () => {
            const cx = typeof window !== 'undefined' ? window.CodexCanvasService : null;
            if (cx && typeof cx.clearCodexEventThumbnailFilterHover === 'function') {
                cx.clearCodexEventThumbnailFilterHover();
            }
        });
    }

    // Non-GitHub-Pages: clickable thumbnail opens the event on the globe.
    if (thumbBlock && !isGitHubPages) {
        const openLabel = (displayEvent && displayEvent.name)
            ? `Open event on globe: ${String(displayEvent.name)}`
            : `Open event ${index + 1} on globe`;
        thumbBlock.setAttribute('role', 'button');
        thumbBlock.setAttribute('tabindex', '0');
        thumbBlock.setAttribute('aria-label', openLabel);

        const tryOpenFromPreview = (e) => {
            if (e.target.closest('.multi-event-badge')) return;
            if (eventManager.openEventFromList) {
                eventManager.openEventFromList(event, index);
            }
        };

        thumbBlock.addEventListener('click', (e) => tryOpenFromPreview(e));
        thumbBlock.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (e.target.closest('.multi-event-badge')) return;
            if (eventManager.openEventFromList) {
                eventManager.openEventFromList(event, index);
            }
        });
    }

    // GitHub Pages: whole-card is the open target (no edit affordances exist there).
    if (isGitHubPages) {
        const label = (displayEvent && displayEvent.name) ? String(displayEvent.name) : (`Event ${index + 1}`);
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Open event: ${label}`);
        item.addEventListener('click', (e) => {
            if (e.target.closest('.multi-event-badge')) return;
            if (eventManager.openEventFromList) {
                eventManager.openEventFromList(event, index);
            }
        });
        item.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            if (eventManager.openEventFromList) {
                eventManager.openEventFromList(event, index);
            }
        });
        item.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.multi-event-badge')) return;
            e.preventDefault();
        });
    }

    if (isMultiEvent) {
        const badge = item.querySelector('.multi-event-badge');
        if (badge) {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                if (eventManager.cycleEventVariant) {
                    eventManager.cycleEventVariant(index, event, item);
                }
            });
            // Stop drag from claiming the badge click on desktop.
            badge.addEventListener('mousedown', (e) => e.stopPropagation());
        }
    }
}
