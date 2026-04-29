/**
 * NavigationPaginationHelpers - Pagination utilities for event navigation
 */

import { playNavigationSound } from './NavigationButtonHelpers.js';
import { shouldEventBeLocked } from './MarkerCreationHelpers.js';

/** Range input max; thumb moves smoothly, pages switch at interval boundaries. */
export const EVENT_PAGE_SLIDER_RESOLUTION = 10000;

export function normalizedProgressFromSliderValue(rawValue) {
    const v = Number(rawValue);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v / EVENT_PAGE_SLIDER_RESOLUTION));
}

/** @param {number} t - Progress 0..1 across all pages */
export function pageFromSliderProgress(t, totalPages) {
    const N = Math.max(1, totalPages | 0);
    if (N <= 1) return 1;
    const x = Math.max(0, Math.min(1, t));
    if (x >= 1) return N;
    return Math.min(N, Math.floor(x * N) + 1);
}

/** Center of the page’s segment on the track (for sync from prev/next/input). */
export function sliderValueForPageCenter(page1Based, totalPages) {
    const N = Math.max(1, totalPages | 0);
    const p = Math.min(Math.max(1, page1Based | 0), N);
    if (N <= 1) return 0;
    const segT = (p - 0.5) / N;
    return Math.round(segT * EVENT_PAGE_SLIDER_RESOLUTION);
}

/** Allow the dock page slider to sync after scrubbing ends or when page changes elsewhere (e.g. event slide prev/next). */
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
 * @param {Object} dataModel
 * @param {number} page1Based
 * @param {Set} activeFilters
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
 * @param {Object} dataModel
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {1|-1} delta
 * @returns {number}
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

/**
 * Update news ticker with headlines from globe's current page
 */
function updateNewsTickerFromGlobe() {
    const dm = window.globeController?.dataModel || window.__codexEventSlideBridge?.dataModel;
    if (dm && window.newsTickerService?.updateTicker) {
        const currentPageEvents = dm.getEventsForCurrentPage();
        window.newsTickerService.updateTicker(currentPageEvents);
    }
}

/**
 * Handles previous page button click with wrap logic
 * @param {Object} dataModel - DataModel instance
 * @param {Function} wrappedUpdatePaginationUI - Wrapped update function
 * @param {Function} onPageChange - Page change callback
 */
export function handlePrevPageClick(dataModel, wrappedUpdatePaginationUI, onPageChange) {
    clearEventPageSliderSuppressFromGlobe();
    const currentPage = dataModel.getCurrentEventPage();
    const totalPages = dataModel.getTotalEventPages();
    const newPage = resolveWrappedPageSkippingEmptyFilterPages(dataModel, currentPage, totalPages, -1);

    if (newPage === currentPage) {
        wrappedUpdatePaginationUI(false);
        return;
    }

    playNavigationSound('page');
    dataModel.setCurrentEventPage(newPage);
    wrappedUpdatePaginationUI(true); // Animate on page change
    updateNewsTickerFromGlobe();

    if (onPageChange) {
        onPageChange();
    }
}

/**
 * Handles next page button click with wrap logic
 * @param {Object} dataModel - DataModel instance
 * @param {Function} wrappedUpdatePaginationUI - Wrapped update function
 * @param {Function} onPageChange - Page change callback
 */
export function handleNextPageClick(dataModel, wrappedUpdatePaginationUI, onPageChange) {
    clearEventPageSliderSuppressFromGlobe();
    const currentPage = dataModel.getCurrentEventPage();
    const totalPages = dataModel.getTotalEventPages();
    const newPage = resolveWrappedPageSkippingEmptyFilterPages(dataModel, currentPage, totalPages, 1);

    if (newPage === currentPage) {
        wrappedUpdatePaginationUI(false);
        return;
    }

    playNavigationSound('page');
    dataModel.setCurrentEventPage(newPage);
    wrappedUpdatePaginationUI(true); // Animate on page change
    updateNewsTickerFromGlobe();

    if (onPageChange) {
        onPageChange();
    }
}

/**
 * Handles manual page input change
 * @param {number} inputValue - Input value
 * @param {Object} dataModel - DataModel instance
 * @param {Function} wrappedUpdatePaginationUI - Wrapped update function
 * @param {Function} onPageChange - Page change callback
 * @param {boolean} [playPageSound=true] - When false, skip page turn SFX (e.g. scrub bar uses panel gear tick)
 */
export function handlePageInputChange(inputValue, dataModel, wrappedUpdatePaginationUI, onPageChange, playPageSound = true) {
    const totalPages = dataModel.getTotalEventPages();

    // Validate and set page
    if (!isNaN(inputValue) && inputValue >= 1 && inputValue <= totalPages) {
        if (playPageSound) {
            clearEventPageSliderSuppressFromGlobe();
        }
        const oldPage = dataModel.getCurrentEventPage();
        const pageChanged = oldPage !== inputValue;
        dataModel.setCurrentEventPage(inputValue);
        wrappedUpdatePaginationUI(pageChanged); // Animate on page change

        // Update news ticker with headlines from new page
        updateNewsTickerFromGlobe();

        if (playPageSound && pageChanged) {
            playNavigationSound('page');
        }
        if (onPageChange) {
            onPageChange();
        }
    } else {
        clearEventPageSliderSuppressFromGlobe();
        wrappedUpdatePaginationUI(false);
    }
}

/**
 * Updates pagination button states (wrap icons, disabled states)
 * @param {HTMLElement} prevBtn - Previous button element
 * @param {HTMLElement} nextBtn - Next button element
 * @param {HTMLElement} pageInput - Page input element
 * @param {HTMLElement|null|undefined} pageTotal - Optional “/ N” span (omitted in current markup)
 * @param {Object} dataModel - DataModel instance
 */
export function updatePaginationButtonStates(prevBtn, nextBtn, pageInput, pageTotal, dataModel) {
    const currentPage = dataModel.getCurrentEventPage();
    const totalPages = dataModel.getTotalEventPages();
    
    // Update input value (without triggering change event)
    pageInput.value = currentPage;
    pageInput.max = totalPages;
    if (pageTotal) pageTotal.textContent = `/ ${totalPages}`;
    
    /* Icons are images in markup; only titles + disabled update here */
    if (totalPages > 1) {
        if (currentPage === 1) {
            prevBtn.disabled = false;
            prevBtn.title = 'Go to Last Page';
        } else {
            prevBtn.disabled = false;
            prevBtn.title = 'Previous Page';
        }
        if (currentPage === totalPages) {
            nextBtn.disabled = false;
            nextBtn.title = 'Go to First Page';
        } else {
            nextBtn.disabled = false;
            nextBtn.title = 'Next Page';
        }
    } else {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }
    
    // Hide pagination if only one page or no events
    const pagination = document.getElementById('eventPagination');
    if (pagination) {
        if (totalPages <= 1) {
            pagination.style.display = 'none';
        } else {
            pagination.style.display = 'flex';
        }
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.NavigationPaginationHelpers) {
        window.NavigationPaginationHelpers = {};
    }
    window.NavigationPaginationHelpers.handlePrevPageClick = handlePrevPageClick;
    window.NavigationPaginationHelpers.handleNextPageClick = handleNextPageClick;
    window.NavigationPaginationHelpers.handlePageInputChange = handlePageInputChange;
    window.NavigationPaginationHelpers.updatePaginationButtonStates = updatePaginationButtonStates;
    window.NavigationPaginationHelpers.updateNewsTickerFromGlobe = updateNewsTickerFromGlobe;
    window.NavigationPaginationHelpers.pageHasAtLeastOneFilterMatch = pageHasAtLeastOneFilterMatch;
    window.NavigationPaginationHelpers.resolveWrappedPageSkippingEmptyFilterPages = resolveWrappedPageSkippingEmptyFilterPages;
    window.NavigationPaginationHelpers.EVENT_PAGE_SLIDER_RESOLUTION = EVENT_PAGE_SLIDER_RESOLUTION;
    window.NavigationPaginationHelpers.normalizedProgressFromSliderValue = normalizedProgressFromSliderValue;
    window.NavigationPaginationHelpers.pageFromSliderProgress = pageFromSliderProgress;
    window.NavigationPaginationHelpers.sliderValueForPageCenter = sliderValueForPageCenter;
}
