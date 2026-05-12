import { updateEventItemPreview } from './updateEventItemPreview.js';

/**
 * Look up the live timeline UI handle (preferring the full globe controller, falling back
 * to the slide bridge), so we can ask it to repaint the number-buttons strip and the globe
 * pagination thumb when variant state changes.
 */
function resolveTimelineUi() {
    if (typeof window === 'undefined') return null;
    return window.globeController?.uiView || window.__codexEventSlideBridge?.uiView || null;
}

/**
 * Advance the active variant for one multi-event card and repaint the card preview to match.
 *
 * Storage:
 *   - Per-item variant indices live on `eventManager.eventItemVariantIndices`, keyed by
 *     `event-${eventIndex}`. Missing keys default to 0 (the first variant).
 *
 * Side effects:
 *   - Plays the `switchEvent` SFX (matches the existing UI feedback).
 *   - Updates `itemElement` in-place via `updateEventItemPreview`.
 *   - Asks the globe `uiView` to refresh the number buttons and the pagination thumb so the
 *     selection stays in sync if the user has the slide open or hovers the pagination row.
 *
 * @param {any} interactionService Owning EventInteractionService.
 * @param {number} eventIndex Index into `eventManager.events`.
 * @param {*} event Event object (must have `variants[]`).
 * @param {HTMLElement|null} itemElement DOM card to repaint; tolerant of null for headless.
 */
export function cycleEventVariant(interactionService, eventIndex, event, itemElement) {
    if (!interactionService.eventManager || !event.variants || event.variants.length <= 1) return;

    const itemKey = `event-${eventIndex}`;
    let currentIndex = interactionService.eventManager.eventItemVariantIndices.get(itemKey) || 0;

    currentIndex = (currentIndex + 1) % event.variants.length;
    interactionService.eventManager.eventItemVariantIndices.set(itemKey, currentIndex);

    if (window.SoundEffectsManager) {
        window.SoundEffectsManager.play('switchEvent');
    }

    if (itemElement) {
        updateEventItemPreview(interactionService, eventIndex, event, itemElement, currentIndex);
    }

    const ui = resolveTimelineUi();
    if (ui?.updateNumberButtons) ui.updateNumberButtons();
    if (ui?.refreshGlobePaginationThumbHover) ui.refreshGlobePaginationThumbHover(eventIndex);
}

/**
 * Reset every multi-event card back to its first variant.
 *
 * Used after `openEventFromList` so closing one event doesn't leave other cards stranded on
 * a non-default variant. Implementation simply clears the per-item map — `get()` returns
 * `undefined` afterwards, and the `|| 0` defaults take it from there.
 *
 * Triggers a full `renderEvents()` repaint and refreshes the slide number-button strip.
 *
 * @param {any} interactionService Owning EventInteractionService.
 */
export function resetAllEventVariants(interactionService) {
    if (!interactionService.eventManager) return;

    interactionService.eventManager.eventItemVariantIndices.clear();

    if (interactionService.eventManager.renderEvents) {
        interactionService.eventManager.renderEvents();
    }
    const ui = resolveTimelineUi();
    if (ui?.updateNumberButtons) ui.updateNumberButtons();
}
