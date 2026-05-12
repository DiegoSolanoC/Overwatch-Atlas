/**
 * pageNavigation — filter-aware prev/next page navigation, manual page input
 * handling, and pagination button state updates for the dock.
 *
 *   - clearEventPageSliderSuppressFromGlobe(): unblock the dock slider sync
 *     after scrubbing ends or when a page change comes from elsewhere
 *     (event slide prev/next, keyboard shortcut, etc.).
 *   - pageHasAtLeastOneFilterMatch(dm, page, activeFilters): true if at least
 *     one root event on the page survives the filter set.
 *   - resolveWrappedPageSkippingEmptyFilterPages(dm, current, total, delta):
 *     next/prev page index, skipping pages whose 10 events are all locked.
 *   - handlePrevPageClick / handleNextPageClick / handlePageInputChange:
 *     button + input wiring used by both the dock buttons and the keyboard
 *     shortcut service.
 *   - updatePaginationButtonStates(prevBtn, nextBtn, pageInput, pageTotal, dm):
 *     refresh disabled flags, titles, page number input, and visibility.
 */

import { playNavigationSound } from '../../platform/navigation/playNavigationSound.js';
import { shouldEventBeLocked } from '../../markers/filtering/shouldEventBeLocked.js';
import { updateNewsTickerFromGlobe } from './newsTickerFromGlobe.js';

export function clearEventPageSliderSuppressFromGlobe() {
    try {
        const ui = window.globeController?.uiView || window.__codexEventSlideBridge?.uiView;
        if (ui) {
            ui._suppressEventPageSliderSync = false;
            ui._eventPageSliderPointerActive = false;
        }
    } catch (_) {}
}

/**
 * Confirmed hero/faction filters on the globe (same rules as marker lock).
 * @returns {Set|null} Non-empty Set, or null when skipping pages does not apply
 */
function getNonEmptySceneActiveFilters() {
    try {
        const s = window.globeController?.sceneModel?.activeFilters;
        if (s && typeof s.size === 'number' && s.size > 0) return s;
    } catch (_) {}
    return null;
}

/**
 * True if at least one root event on this page is not locked for the given filter set.
 */
export function pageHasAtLeastOneFilterMatch(dataModel, page1Based, activeFilters) {
    if (!dataModel || !activeFilters || activeFilters.size === 0) return true;
    const per = dataModel.eventsPerPage || 10;
    const start = (page1Based - 1) * per;
    const end = start + per;
    const slice = Array.isArray(dataModel.events) ? dataModel.events.slice(start, end) : [];
    return slice.some((event) => event && !shouldEventBeLocked(event, activeFilters));
}

/**
 * Next/prev target page, skipping pages whose 10 events all fail the active filters (wraps).
 * Falls back to currentPage if no page matches (all locked under current filter set).
 */
export function resolveWrappedPageSkippingEmptyFilterPages(dataModel, currentPage, totalPages, delta) {
    const active = getNonEmptySceneActiveFilters();
    if (!active || totalPages <= 1) {
        if (delta > 0) {
            return currentPage === totalPages ? 1 : currentPage + 1;
        }
        return currentPage === 1 ? totalPages : currentPage - 1;
    }

    for (let k = 1; k <= totalPages; k++) {
        const p =
            delta > 0
                ? ((currentPage - 1 + k + totalPages) % totalPages) + 1
                : ((currentPage - 1 - k + totalPages * 1000) % totalPages) + 1;
        if (pageHasAtLeastOneFilterMatch(dataModel, p, active)) {
            return p;
        }
    }
    return currentPage;
}

function stepWrappedPage(dataModel, wrappedUpdatePaginationUI, onPageChange, delta) {
    clearEventPageSliderSuppressFromGlobe();
    const currentPage = dataModel.getCurrentEventPage();
    const totalPages = dataModel.getTotalEventPages();
    const newPage = resolveWrappedPageSkippingEmptyFilterPages(dataModel, currentPage, totalPages, delta);

    if (newPage === currentPage) {
        wrappedUpdatePaginationUI(false);
        return;
    }

    playNavigationSound('page');
    dataModel.setCurrentEventPage(newPage);
    wrappedUpdatePaginationUI(true); // Animate on page change
    updateNewsTickerFromGlobe();

    if (onPageChange) onPageChange();
}

export function handlePrevPageClick(dataModel, wrappedUpdatePaginationUI, onPageChange) {
    stepWrappedPage(dataModel, wrappedUpdatePaginationUI, onPageChange, -1);
}

export function handleNextPageClick(dataModel, wrappedUpdatePaginationUI, onPageChange) {
    stepWrappedPage(dataModel, wrappedUpdatePaginationUI, onPageChange, 1);
}

/**
 * @param {boolean} [playPageSound=true] - When false, skip page turn SFX
 *        (e.g. scrub bar uses panel gear tick instead).
 */
export function handlePageInputChange(inputValue, dataModel, wrappedUpdatePaginationUI, onPageChange, playPageSound = true) {
    const totalPages = dataModel.getTotalEventPages();

    if (isNaN(inputValue) || inputValue < 1 || inputValue > totalPages) {
        clearEventPageSliderSuppressFromGlobe();
        wrappedUpdatePaginationUI(false);
        return;
    }

    if (playPageSound) {
        clearEventPageSliderSuppressFromGlobe();
    }
    const oldPage = dataModel.getCurrentEventPage();
    const pageChanged = oldPage !== inputValue;
    dataModel.setCurrentEventPage(inputValue);
    wrappedUpdatePaginationUI(pageChanged); // Animate on page change

    updateNewsTickerFromGlobe();

    if (playPageSound && pageChanged) {
        playNavigationSound('page');
    }
    if (onPageChange) onPageChange();
}

export function updatePaginationButtonStates(prevBtn, nextBtn, pageInput, pageTotal, dataModel) {
    const currentPage = dataModel.getCurrentEventPage();
    const totalPages = dataModel.getTotalEventPages();

    pageInput.value = currentPage;
    pageInput.max = totalPages;
    if (pageTotal) pageTotal.textContent = `/ ${totalPages}`;

    /* Icons are images in markup; only titles + disabled update here. */
    if (totalPages > 1) {
        prevBtn.disabled = false;
        prevBtn.title = currentPage === 1 ? 'Go to Last Page' : 'Previous Page';
        nextBtn.disabled = false;
        nextBtn.title = currentPage === totalPages ? 'Go to First Page' : 'Next Page';
    } else {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }

    const pagination = document.getElementById('eventPagination');
    if (pagination) {
        pagination.style.display = totalPages <= 1 ? 'none' : 'flex';
    }
}
