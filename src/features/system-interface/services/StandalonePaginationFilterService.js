/**
 * Standalone pagination filter service — keeps the dock pagination strip
 * (`#eventNumberButtons`) and the slider ticks (`#eventPageSliderTicks`) in
 * sync with the active filter set (`window.standaloneActiveFilters`).
 *
 *   - updateStandalonePaginationForFilters(): locks/unlocks pagination
 *     thumbnails based on whether each event matches the active filters.
 *     Also re-runs slider tick coloring.
 *   - eventRootSlotMissingDescription(): predicate matching dock-thumb /
 *     event-list rules (first variant, or root, must have non-empty
 *     description text).
 *
 * The exported entry point is also published on `window` for legacy callers
 * (FilterService, EventMarkerManager) that reach in via the global.
 *
 * Extracted from main-menu/event-system-load-out/EventSystemLoadOut.js.
 */

import { shouldEventBeLocked } from '../managers/helpers/MarkerCreationHelpers.js';

/**
 * Lock/unlock pagination thumbnails based on active filters.
 * Then refresh the slider tick colorings.
 */
export function updateStandalonePaginationForFilters() {
    const activeFilters = window.standaloneActiveFilters || new Set();
    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');

    const stack = new Error().stack;
    const caller = stack?.split('\n')[2]?.trim() || 'unknown';

    console.log(`[FILTER DEBUG] 🔄 updateStandalonePaginationForFilters() called`);
    console.log(`[FILTER DEBUG]    Caller: ${caller}`);
    console.log(`[FILTER DEBUG]    Active filters: [${Array.from(activeFilters).join(', ')}]`);
    console.log(`[FILTER DEBUG]    Total events: ${events.length}, buttons found: ${buttons.length}`);

    if (!buttons.length) {
        console.log(`[FILTER DEBUG]    No buttons found - skipping update`);
        return;
    }

    const eventsPerPage = 10;
    const currentPage = window.standaloneEventSlide?.currentPage || 1;
    const startIndex = (currentPage - 1) * eventsPerPage;

    let lockedCount = 0;
    let unlockedCount = 0;
    let hiddenCount = 0;

    buttons.forEach((btn, index) => {
        const eventIndex = startIndex + index;
        const event = events[eventIndex];

        if (!event) {
            btn.style.display = 'none';
            hiddenCount++;
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
            lockedCount++;
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
            unlockedCount++;
            console.log(`[VISUAL] Pagination #${eventIndex} UNLOCKED: opacity='${btn.style.opacity}', filter='${btn.style.filter}', classList='${btn.classList.value}'`);
        }
    });

    console.log(`[FILTER DEBUG]    Pagination update complete: ${lockedCount} locked, ${unlockedCount} unlocked, ${hiddenCount} hidden`);

    updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage);

    // NOTE: Do NOT call applyFilters here - it creates an infinite loop:
    // updateStandalonePaginationForFilters -> applyFilters -> _syncPaginationUiAfterFilters -> updateStandalonePaginationForFilters
    // applyFilters already calls back to this function via _syncPaginationUiAfterFilters
    // The sync should only go one way: applyFilters -> updateStandalonePaginationForFilters
}

/**
 * Same rule as dock thumbs / event list: first variant (or root) must have a
 * non-empty description. Treats the literal sentinel "No description
 * available." as empty.
 */
export function eventRootSlotMissingDescription(rootEvent) {
    if (!rootEvent) return true;
    const displayEv = rootEvent.variants?.[0] || rootEvent;
    const d = displayEv?.description;
    if (!d) return true;

    const textContent = d.replace(/<[^>]*>/g, '').trim();

    if (textContent === 'No description available.' || textContent === 'No description available') {
        return true;
    }

    return textContent.length === 0;
}

/**
 * Color slider ticks and number labels green for events that pass the
 * current filter set. Sub-ticks (gaps between events) are not styled here.
 */
export function updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage) {
    const ticksEl = document.getElementById('eventPageSliderTicks');
    if (!ticksEl) return;

    const existingHits = ticksEl.querySelectorAll('.event-page-slider-tick--filter-hit, .event-page-slider-num.filter-hit');
    existingHits.forEach(el => {
        el.classList.remove('event-page-slider-tick--filter-hit', 'filter-hit');
    });

    const totalEvents = events.length;
    const _totalPages = Math.ceil(totalEvents / eventsPerPage);

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
