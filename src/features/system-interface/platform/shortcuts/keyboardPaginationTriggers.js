/**
 * Bind keyboard A/D + ArrowLeft/Right to the right pagination action depending
 * on what is currently open:
 *   - event slide open: previous/next event (dock rail first, then slide btn)
 *   - manage panel open: previous/next manage page
 *   - otherwise: previous/next timeline page (button click first, then
 *     `NavigationPaginationHelpers` on Codex/globe + a refresh callback)
 */

import {
    canNavigateGlobePages,
    codexOrGlobeDataModel,
    codexOrGlobeUiView
} from './keyboardModeResolution.js';

export function clickIfEnabled(id) {
    const b = document.getElementById(id);
    if (!b || b.disabled) return false;
    b.click();
    return true;
}

function getPaginationOnChange() {
    const ui = codexOrGlobeUiView();
    if (ui && typeof ui._paginationOnPageChange === 'function') return ui._paginationOnPageChange;
    const T = window.TimelineMarkerSync;
    if (T && typeof T.refreshTimelineEventMarkers === 'function') {
        return function () { T.refreshTimelineEventMarkers(); };
    }
    return null;
}

function runGlobePagePrev() {
    if (!canNavigateGlobePages()) return false;
    const dm = codexOrGlobeDataModel();
    const ui = codexOrGlobeUiView();
    const h = window.NavigationPaginationHelpers;
    if (!dm || !ui || typeof ui.updatePaginationUI !== 'function' || !h) return false;
    h.handlePrevPageClick(dm, ui.updatePaginationUI, getPaginationOnChange());
    return true;
}

function runGlobePageNext() {
    if (!canNavigateGlobePages()) return false;
    const dm = codexOrGlobeDataModel();
    const ui = codexOrGlobeUiView();
    const h = window.NavigationPaginationHelpers;
    if (!dm || !ui || typeof ui.updatePaginationUI !== 'function' || !h) return false;
    h.handleNextPageClick(dm, ui.updatePaginationUI, getPaginationOnChange());
    return true;
}

export function triggerPrevPageButtonOrHelpers() {
    const btn = document.getElementById('prevPageBtn');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return runGlobePagePrev();
}

export function triggerNextPageButtonOrHelpers() {
    const btn = document.getElementById('nextPageBtn');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return runGlobePageNext();
}

export function triggerEventSlidePrev() {
    /* Dock rail (standalone / timeline): wired in MenuHelpers with page sync + filtered nav. */
    const dock = document.getElementById('prevEventBtn');
    if (dock && !dock.disabled) { dock.click(); return true; }
    const b = document.getElementById('eventPrevBtn');
    if (!b || b.disabled) return false;
    b.click();
    return true;
}

export function triggerEventSlideNext() {
    const dock = document.getElementById('nextEventBtn');
    if (dock && !dock.disabled) { dock.click(); return true; }
    const b = document.getElementById('eventNextBtn');
    if (!b || b.disabled) return false;
    b.click();
    return true;
}

export function triggerEventsManagePrev() {
    const b = document.getElementById('eventsPrevPage');
    if (!b || b.disabled) return false;
    b.click();
    return true;
}

export function triggerEventsManageNext() {
    const b = document.getElementById('eventsNextPage');
    if (!b || b.disabled) return false;
    b.click();
    return true;
}
