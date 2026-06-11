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
 *   2. **Story archive summary badge** — list + timeline previews show the same hover
 *      badge as dock pagination thumbs when `#eventsManagePanel` is embedded in story mode.
 *
 *   3. **Open-on-globe** — the thumbnail (non-GitHub-Pages) or the whole card
 *      (GitHub-Pages) becomes a `role="button"` that calls
 *      `eventManager.openEventFromList(event, index)`. Clicks on the variant badge bubble
 *      through unrouted so they can hit the cycle handler instead.
 *
 *   4. **Variant cycle** — clicks on `.multi-event-badge` (only present for multi-events)
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
 *   isViewOnly: boolean,
 * }} ctx
 */

function isStoryArchivePreviewContext() {
    try {
        const panel = document.getElementById('eventsManagePanel');
        return !!panel?.classList.contains('story-viewer-panel-embedded');
    } catch (_) {
        return false;
    }
}

/**
 * @param {Record<string, any>} event
 * @param {number} index
 */
function showStoryArchiveSummaryBadge(event, index) {
    const badge = typeof window !== 'undefined' ? window.SummaryInfoBadge : null;
    if (!badge?.show || !event) return;

    const hoverLines = badge.getHoverPreviewLines
        ? badge.getHoverPreviewLines(event)
        : {
            primary: '',
            otherVariants: [],
            era: '',
            primaryRowFlag: null,
            otherRowFlags: [],
            yearLine: 'Year Unknown',
        };

    badge.show(
        index + 1,
        hoverLines.primary || (badge.getPlainTitle ? badge.getPlainTitle(event) : ''),
        hoverLines.otherVariants || [],
        hoverLines.era || '',
        hoverLines.primaryRowFlag || null,
        hoverLines.otherRowFlags || [],
        hoverLines.yearLine || 'Year Unknown',
    );
}

function hideStoryArchiveSummaryBadge() {
    window.SummaryInfoBadge?.hide?.();
}
export function wireEventItemInteractions(ctx) {
    const { item, eventManager, event, displayEvent, index, isMultiEvent, isViewOnly } = ctx;

    const thumbBlock = item.querySelector('.event-item__thumb-block');
    const storyArchivePreview = isStoryArchivePreviewContext();

    if (storyArchivePreview) {
        item.addEventListener('pointerenter', () => {
            showStoryArchiveSummaryBadge(event, index);
        });
        item.addEventListener('pointerleave', () => {
            hideStoryArchiveSummaryBadge();
        });
    }

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
    if (thumbBlock && !isViewOnly) {
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
    if (isViewOnly) {
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
