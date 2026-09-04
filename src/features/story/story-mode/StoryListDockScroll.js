/**
 * Story list view — sync `#eventsList` scroll with the dock page bar / slider,
 * mirroring StoryTimelineView’s dock pan APIs.
 */

import { applyDockEraTimelineFilter } from '../../system-interface/interface-bottom-dock/dockEraTimelineFilter.js';
import { flushVisibleLazyPreviewImages } from '../../system-interface/interface-left-panel/event-system/render/eventManagerImageLazyLoad.js';

const DOCK_EVENTS_PER_PAGE = 10;

/**
 * @returns {boolean}
 */
export function isStoryListViewActive() {
    const panel = document.getElementById('eventsManagePanel');
    return !!panel?.classList.contains('story-viewer-panel-embedded--list-view')
        && window.eventManager?.dataService?.getArchiveSource?.() === 'story';
}

/**
 * @returns {HTMLElement | null}
 */
function getEventsListEl() {
    return document.getElementById('eventsList');
}

/**
 * @returns {unknown[]}
 */
function getCuratedDockEvents() {
    const fromDock = window.standaloneDockPagination?.getDockEvents?.();
    if (Array.isArray(fromDock) && fromDock.length) {
        return fromDock;
    }
    const em = window.eventManager;
    const base = em?.getDockTimelineEvents?.() ?? [];
    return applyDockEraTimelineFilter(Array.isArray(base) ? base : []);
}

/**
 * @returns {{ dockEvents: unknown[], allEvents: unknown[], eventsPerPage: number, totalPages: number }}
 */
function getDockPaginationContext() {
    const eventsPerPage = window.standaloneDockPagination?.eventsPerPage ?? DOCK_EVENTS_PER_PAGE;
    const dockEvents = getCuratedDockEvents();
    const allEvents = window.eventManager?.dataService?.getEvents?.()
        ?? window.eventManager?.events
        ?? [];
    const totalPages = Math.max(1, Math.ceil(dockEvents.length / eventsPerPage));
    return {
        dockEvents,
        allEvents: Array.isArray(allEvents) ? allEvents : [],
        eventsPerPage,
        totalPages,
    };
}

/**
 * First full-archive index for a dock page (same mapping as the timeline).
 *
 * @param {number} page1Based
 * @param {number} [eventsPerPage]
 * @returns {number|null}
 */
function getFirstSourceIndexOnDockPage(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
    const ctx = getDockPaginationContext();
    const perPage = eventsPerPage || ctx.eventsPerPage;
    const page = Math.min(Math.max(1, page1Based | 0), ctx.totalPages);
    const start = (page - 1) * perPage;
    const pageSlice = ctx.dockEvents.slice(start, start + perPage);

    const filtered = window.eventManager?.getFilteredEvents?.();
    const filteredSet = Array.isArray(filtered) && filtered.length
        ? new Set(filtered)
        : null;

    for (const event of pageSlice) {
        const idx = ctx.allEvents.indexOf(event);
        if (idx < 0) continue;
        if (filteredSet && !filteredSet.has(event)) continue;
        return idx;
    }
    return null;
}

/**
 * Ensure the Event Manager page that contains `sourceIndex` is rendered.
 *
 * @param {number} sourceIndex
 * @returns {HTMLElement | null} The `.event-item` for that index, if present.
 */
function ensureSourceIndexVisibleInList(sourceIndex) {
    const em = window.eventManager;
    const listEl = getEventsListEl();
    if (!em || !listEl || sourceIndex < 0) return null;

    const allEvents = em.dataService?.getEvents?.() ?? em.events ?? [];
    const event = allEvents[sourceIndex];
    if (!event) return null;

    const filtered = typeof em.getFilteredEvents === 'function'
        ? em.getFilteredEvents()
        : allEvents;
    const pos = filtered.indexOf(event);
    if (pos < 0) return null;

    const perPage = Math.max(1, em.eventsPerPage || 50);
    const page = Math.floor(pos / perPage) + 1;
    if (em.currentPage !== page) {
        em.currentPage = page;
        em.renderEvents?.();
    }

    return listEl.querySelector(`.event-item[data-index="${sourceIndex}"]`);
}

/**
 * @param {HTMLElement} listEl
 * @param {HTMLElement} card
 * @returns {number}
 */
function scrollTopForCard(listEl, card) {
    const listRect = listEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return listEl.scrollTop + (cardRect.top - listRect.top);
}

/**
 * @param {HTMLElement} listEl
 * @param {HTMLElement} card
 */
function scrollCardToListTop(listEl, card) {
    listEl.scrollTop = scrollTopForCard(listEl, card);
    flushVisibleLazyPreviewImages(listEl);
}

/**
 * Jump list to the first event of a dock page.
 *
 * @param {number} page1Based
 * @param {number} [eventsPerPage]
 */
export function scrollStoryListToDockPage(page1Based, eventsPerPage = DOCK_EVENTS_PER_PAGE) {
    if (!isStoryListViewActive()) return;

    const listEl = getEventsListEl();
    if (!listEl) return;

    const { totalPages } = getDockPaginationContext();
    if (totalPages <= 1) {
        listEl.scrollTop = 0;
        return;
    }

    const sourceIndex = getFirstSourceIndexOnDockPage(page1Based, eventsPerPage);
    if (sourceIndex == null) return;

    const card = ensureSourceIndexVisibleInList(sourceIndex);
    if (card) scrollCardToListTop(listEl, card);
}

/**
 * Continuous scrub: interpolate list scroll between dock page anchors.
 *
 * @param {number} progress 0..1 (same as timeline dock slider)
 */
export function scrollStoryListToDockSliderProgress(progress) {
    if (!isStoryListViewActive()) return;

    const listEl = getEventsListEl();
    if (!listEl) return;

    const { totalPages, eventsPerPage } = getDockPaginationContext();
    if (totalPages <= 1) {
        listEl.scrollTop = 0;
        return;
    }

    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const fractionalPage = t * totalPages;
    const pageLow = Math.min(totalPages - 1, Math.max(0, Math.floor(fractionalPage)));
    const frac = fractionalPage - pageLow;

    const idxLow = getFirstSourceIndexOnDockPage(pageLow + 1, eventsPerPage);
    const idxHigh = pageLow + 1 < totalPages
        ? getFirstSourceIndexOnDockPage(pageLow + 2, eventsPerPage)
        : getFirstSourceIndexOnDockPage(totalPages, eventsPerPage);

    if (idxLow == null && idxHigh == null) return;

    // Prefer showing the EM page for the nearer anchor so both cards can coexist
    // when they fall on the same manager page (typical: 10 dock slots inside 50).
    const preferHigh = frac >= 0.5 && idxHigh != null;
    const primaryIdx = preferHigh ? idxHigh : (idxLow ?? idxHigh);
    if (primaryIdx == null) return;

    ensureSourceIndexVisibleInList(primaryIdx);

    const cardLow = idxLow != null
        ? listEl.querySelector(`.event-item[data-index="${idxLow}"]`)
        : null;
    const cardHigh = idxHigh != null
        ? listEl.querySelector(`.event-item[data-index="${idxHigh}"]`)
        : null;

    if (cardLow && cardHigh && idxLow !== idxHigh) {
        const topLow = scrollTopForCard(listEl, cardLow);
        const topHigh = scrollTopForCard(listEl, cardHigh);
        listEl.scrollTop = topLow + (topHigh - topLow) * frac;
        flushVisibleLazyPreviewImages(listEl);
        return;
    }

    const card = cardLow || cardHigh;
    if (card) scrollCardToListTop(listEl, card);
}

if (typeof window !== 'undefined') {
    window.scrollStoryListToDockPage = scrollStoryListToDockPage;
    window.scrollStoryListToDockSliderProgress = scrollStoryListToDockSliderProgress;
}
