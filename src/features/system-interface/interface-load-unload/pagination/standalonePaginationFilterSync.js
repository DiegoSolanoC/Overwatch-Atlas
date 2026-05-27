/**
 * Sync the dock pagination strip (`#eventNumberButtons`) and the slider ticks
 * (`#eventPageSliderTicks`) with the active filter set (`window.standaloneActiveFilters`).
 *
 *   - {@link updateStandalonePaginationForFilters}: locks/unlocks pagination
 *     thumbnails based on whether each event matches the active filters and
 *     re-runs slider tick coloring.
 *   - {@link eventRootSlotMissingDescription}: predicate matching dock-thumb /
 *     event-list rules (first variant, or root, must have non-empty description text).
 *   - {@link updateStandaloneSliderTicks}: tint event ticks/numbers that pass
 *     the current filter set.
 *
 * The pagination-update entry point is also published on `window` for legacy
 * callers (`FilterService`, `EventMarkerManager`) that reach in via the global.
 */

import { shouldEventBeLocked } from '../../interface-globe-markers/filtering/shouldEventBeLocked.js';

/**
 * Same rule as dock thumbs / event list: first variant (or root) must have a
 * non-empty description. Treats the literal sentinel "No description
 * available." as empty.
 *
 * @param {Object} rootEvent
 * @returns {boolean}
 */
export function eventRootSlotMissingDescription(rootEvent) {
    if (!rootEvent) return true;
    const displayEv = rootEvent.variants?.[0] || rootEvent;
    return eventSlotMissingDescription(displayEv);
}

/**
 * Same predicate applied to an already-resolved display event (e.g. the first
 * variant of a multi-variant event). Useful inside thumbnail render loops that
 * have already picked the visible variant.
 *
 * @param {Object} displayEvent
 * @returns {boolean}
 */
export function eventSlotMissingDescription(displayEvent) {
    const d = displayEvent?.description;
    if (!d) return true;
    const textContent = d.replace(/<[^>]*>/g, '').trim();
    if (textContent === 'No description available.' || textContent === 'No description available') {
        return true;
    }
    return textContent.length === 0;
}

/**
 * Lock/unlock pagination thumbnails based on active filters, then refresh the
 * slider tick colorings.
 */
export function updateStandalonePaginationForFilters() {
    const activeFilters = window.standaloneActiveFilters || new Set();
    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');

    if (!buttons.length) return;

    const eventsPerPage = 10;
    const currentPage = window.standaloneEventSlide?.currentPage || 1;
    const startIndex = (currentPage - 1) * eventsPerPage;

    buttons.forEach((btn, index) => {
        const eventIndex = startIndex + index;
        const event = events[eventIndex];

        if (!event) {
            btn.style.display = 'none';
            return;
        }

        const isLocked = activeFilters.size > 0 && shouldEventBeLocked(event, activeFilters);

        if (isLocked) {
            btn.disabled = true;
            btn.classList.add('locked');
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.pointerEvents = 'none';
            btn.title = btn.title.replace(' — Filtered out', '') + ' — Filtered out';
            btn.dataset.isLocked = 'true';
        } else {
            btn.disabled = false;
            btn.classList.remove('locked');
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.display = 'flex';
            btn.style.pointerEvents = 'auto';
            btn.dataset.isLocked = 'false';
            if (btn.title && btn.title.includes(' — Filtered out')) {
                btn.title = btn.title.replace(' — Filtered out', '');
            }
        }
    });

    updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage);

    // NOTE: Do NOT call applyFilters here — it creates an infinite loop:
    //   updateStandalonePaginationForFilters -> applyFilters
    //     -> _syncPaginationUiAfterFilters -> updateStandalonePaginationForFilters
    // applyFilters already calls back here via _syncPaginationUiAfterFilters,
    // so the sync only flows one way.
}

/**
 * Color slider ticks and number labels green for events that pass the current
 * filter set. Sub-ticks (gaps between events) are not styled here.
 *
 * @param {Set<string>} activeFilters
 * @param {Array<Object>} events
 * @param {number} eventsPerPage
 * @param {number} currentPage
 */
export function updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage) {
    const ticksEl = document.getElementById('eventPageSliderTicks');
    if (!ticksEl) return;

    const existingHits = ticksEl.querySelectorAll('.event-page-slider-tick--filter-hit, .event-page-slider-num.filter-hit');
    existingHits.forEach(el => {
        el.classList.remove('event-page-slider-tick--filter-hit', 'filter-hit');
    });

    const totalEvents = events.length;

    const numLabels = ticksEl.querySelectorAll('.event-page-slider-num');
    numLabels.forEach(label => {
        const eventIndex = parseInt(label.dataset.eventIndex, 10);
        const event = eventIndex >= 0 && eventIndex < totalEvents ? events[eventIndex] : null;
        if (event && !shouldEventBeLocked(event, activeFilters)) {
            label.classList.add('filter-hit');
        }
    });

    if (!activeFilters || activeFilters.size === 0) return;

    const eventTicks = ticksEl.querySelectorAll('.event-page-slider-tick--event');
    eventTicks.forEach(tick => {
        const eventIndex = parseInt(tick.dataset.eventIndex, 10);
        const event = eventIndex >= 0 && eventIndex < totalEvents ? events[eventIndex] : null;
        if (event && !shouldEventBeLocked(event, activeFilters)) {
            tick.classList.add('event-page-slider-tick--filter-hit');
        }
    });
}

if (typeof window !== 'undefined') {
    window.updateStandalonePaginationForFilters = updateStandalonePaginationForFilters;
}
