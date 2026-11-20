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
import { mountPaginationDock } from './mountPaginationDock.js?v=3';
import { refreshDockTrapSvgFromTweaks } from '../../universal-features/atlas-header/SidePanelsTrapChrome.js?v=26';

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
 * Idempotent: host the dock inward lip on the cap-row (parallel to outer stroke).
 * Shape path is filled by SidePanelsTrapChrome.syncDockInwardLineShape on apply.
 */
export function ensureDockInwardLine() {
    const cap = document.querySelector('.pagination-dock-top-cap-row');
    if (!cap) return null;
    document.querySelectorAll('.event-page-slider-row > .pagination-dock-inward-line').forEach((el) => {
        el.remove();
    });
    let line = cap.querySelector(':scope > .pagination-dock-inward-line');
    if (!line) {
        line = document.createElement('div');
        line.className = 'pagination-dock-inward-line';
        line.setAttribute('aria-hidden', 'true');
        /* Under trapezoid/buttons — first in cap-row, z-index 1 in CSS. */
        cap.insertBefore(line, cap.firstChild);
    } else if (line !== cap.firstElementChild) {
        cap.insertBefore(line, cap.firstChild);
    }
    if (!line.querySelector('svg.pagination-dock-inward-line__shape')) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('pagination-dock-inward-line__shape');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('pagination-dock-inward-line__path');
        svg.appendChild(path);
        line.replaceChildren(svg);
    }
    return line;
}

/**
 * @returns {HTMLElement} The #eventPagination element (existing or newly built).
 */
export function createEventPagination() {
    const existing = returnExistingOrSweepOrphanNavButtons();
    if (existing) {
        ensureDockInwardLine();
        requestAnimationFrame(() => refreshDockTrapSvgFromTweaks());
        return existing;
    }

    const pagination = buildEventPaginationElement();

    /* Initial placement (one-time, no resize listener to avoid accumulation). */
    document.getElementById('content').appendChild(pagination);

    /* Defer dock setup to ensure layout-container exists. */
    requestAnimationFrame(() => {
        mountPaginationDock(pagination);
        ensureDockInwardLine();
        requestAnimationFrame(() => refreshDockTrapSvgFromTweaks());
        /* Trigger resize so globe/map adjusts to the new container size after CSS settles. */
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });

    return pagination;
}
