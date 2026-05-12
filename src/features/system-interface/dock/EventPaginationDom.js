/**
 * EventPaginationDom — entry point for building and mounting the
 * #eventPagination control bar (slider, prev/next page+event buttons, thumb
 * row, mobile page input). Delegates the heavy DOM weaving:
 *
 *   - markup       → eventPaginationMarkup.js (pagination innerHTML, collapse strip)
 *   - mounting     → mountPaginationDock.js   (dock + collapse strip + pattern + cap)
 *   - trapezoid    → dockTrapezoidCap.js      (called by mountPaginationDock)
 *   - thumbnails   → PaginationThumbMarkup.js (called by eventPaginationMarkup)
 *
 * Click wiring (prev/next page, prev/next event, page input) is owned by
 * `NavigationPaginationHelpers.js`. Dock collapse behavior is owned by
 * `./paginationDockCollapse.js`.
 *
 * Idempotent: if `#eventPagination` already exists this returns it without
 * remounting; orphan navigation buttons (e.g. left over from a partial
 * unload) are cleared first so a fresh dock can be built.
 */

import { eventPaginationInnerHtml } from './eventPaginationMarkup.js';
import { mountPaginationDock } from './mountPaginationDock.js';

const ORPHAN_NAV_BUTTON_IDS = ['prevPageBtn', 'prevEventBtn', 'nextEventBtn', 'nextPageBtn'];

function returnExistingOrSweepOrphanNavButtons() {
    const existing = document.getElementById('eventPagination');
    if (existing) return existing;

    const orphanIds = ORPHAN_NAV_BUTTON_IDS.filter((id) => document.getElementById(id));
    if (orphanIds.length === 0) return null;

    const stillExisting = document.getElementById('eventPagination');
    if (stillExisting) return stillExisting;
    orphanIds.forEach((id) => document.getElementById(id)?.remove());
    return null;
}

function buildEventPaginationElement() {
    const pagination = document.createElement('div');
    pagination.id = 'eventPagination';
    pagination.className = 'event-pagination';
    pagination.innerHTML = eventPaginationInnerHtml();
    return pagination;
}

/**
 * @returns {HTMLElement} The #eventPagination element (existing or newly built).
 */
export function createEventPagination() {
    const existing = returnExistingOrSweepOrphanNavButtons();
    if (existing) return existing;

    const pagination = buildEventPaginationElement();

    /* Initial placement (one-time, no resize listener to avoid accumulation). */
    document.getElementById('content').appendChild(pagination);

    /* Defer dock setup to ensure layout-container exists. */
    requestAnimationFrame(() => {
        mountPaginationDock(pagination);
        /* Trigger resize so globe/map adjusts to the new container size after CSS settles. */
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });

    return pagination;
}
