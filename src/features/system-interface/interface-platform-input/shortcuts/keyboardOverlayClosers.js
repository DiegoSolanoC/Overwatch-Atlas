/**
 * Escape / Q / outside-double-click cascade dismissal.
 *
 * `closeTopOverlay` peels exactly one overlay in this order:
 *   1. external link confirm modal
 *   2. event slide + image overlay (also resets the camera if it had been
 *      following a station/ship — matches the X button)
 *   3. palette menu (`_closePaletteMenu` if available; else strip class)
 *   4. filters / music / manage panels (close button if present, else class)
 *   5. sidebar
 *
 * `closeAllOverlayLayers` re-peels until nothing closes (guarded at 24 passes)
 * so a single Escape clears all of the above in one keystroke.
 *
 * `onDoubleClick` is the same idea but only for the side panels (no event slide
 * because double-clicking inside slide content would close it accidentally).
 */

import { codexOrGlobeUiView } from './keyboardModeResolution.js';

function clearHackedOverlays() {
    document.querySelectorAll('.hacked-overlay').forEach(function (el) { el.remove(); });
}

export function hideEventSlideIfOpen() {
    const slide = document.getElementById('eventSlide');
    const overlay = document.getElementById('eventImageOverlay');
    const slideOpen = slide && slide.classList.contains('open');
    const overlayOpen = overlay && overlay.classList.contains('open');

    if (!slideOpen && !overlayOpen) return false;

    let closed = false;
    try {
        const uiHide = codexOrGlobeUiView();
        if (uiHide && typeof uiHide.hideEventSlide === 'function') {
            clearHackedOverlays();
            uiHide.hideEventSlide();
            if (uiHide.hideImageOverlay) uiHide.hideImageOverlay();
            closed = true;
        }
    } catch (_) {}

    if (!closed && slideOpen) {
        slide.classList.remove('open');
        if (overlay) overlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
        closed = true;
    }
    if (!closed && overlayOpen) {
        overlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
        closed = true;
    }

    /* Reset camera so a station/ship "follow" doesn't keep tracking after dismiss. */
    if (closed) {
        if (window.globeController?.interactionController) {
            window.globeController.interactionController.stopFollowingStation();
            window.globeController.interactionController.restorePlanesVisibility?.();
        }
        if (window.globeController?.cameraControlService) {
            window.globeController.cameraControlService.resetCameraToDefault();
        }
    }
    return closed;
}

/** @returns {boolean} whether something was closed. */
export function closeTopOverlay() {
    const ext = document.getElementById('externalLinkConfirmOverlay');
    if (ext && ext.classList.contains('is-open')) {
        const cancel = document.getElementById('externalLinkConfirmCancel');
        if (cancel) cancel.click();
        else ext.classList.remove('is-open');
        return true;
    }
    if (hideEventSlideIfOpen()) return true;

    const palette = document.getElementById('paletteMenu');
    if (palette && palette.classList.contains('open')) {
        if (typeof window._closePaletteMenu === 'function') {
            window._closePaletteMenu();
        } else {
            palette.classList.remove('open');
            const paletteToggle = document.getElementById('colorPaletteToggle');
            if (paletteToggle) paletteToggle.classList.remove('active');
        }
        return true;
    }

    const filters = document.getElementById('filtersPanel');
    if (filters && filters.classList.contains('open')) {
        const fc = document.getElementById('filtersPanelClose');
        if (fc) fc.click();
        else filters.classList.remove('open');
        return true;
    }

    const music = document.getElementById('musicPanel');
    if (music && music.classList.contains('open')) {
        const mc = document.getElementById('musicPanelClose');
        if (mc) mc.click();
        else music.classList.remove('open');
        return true;
    }

    const manage = document.getElementById('eventsManagePanel');
    if (manage && manage.classList.contains('open')) {
        const mClose = document.getElementById('eventsManageClose');
        if (mClose) mClose.click();
        else manage.classList.remove('open');
        return true;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('visible')) {
        sidebar.classList.remove('visible');
        try { localStorage.setItem('sidebarOpen', 'false'); } catch (_) {}
        return true;
    }
    return false;
}

/** Repeatedly peel {@link closeTopOverlay} so one keypress clears everything. */
export function closeAllOverlayLayers() {
    let any = false;
    let guard = 24;
    while (guard-- > 0 && closeTopOverlay()) any = true;
    return any;
}

/** Double-click outside any panel closes music / filters / events-manage panels. */
export function onDoubleClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;

    const inFilters = t.closest('#filtersPanel');
    const inMusic = t.closest('#musicPanel');
    const inEventsManage = t.closest('#eventsManagePanel');
    const inEventSlide = t.closest('#eventSlide');
    const inPalette = t.closest('#paletteMenu');
    if (inFilters || inMusic || inEventsManage || inEventSlide || inPalette) return;

    const filters = document.getElementById('filtersPanel');
    const music = document.getElementById('musicPanel');
    const manage = document.getElementById('eventsManagePanel');
    let closed = false;

    if (filters && filters.classList.contains('open')) {
        const fc = document.getElementById('filtersPanelClose');
        if (fc) fc.click();
        else filters.classList.remove('open');
        closed = true;
    }
    if (music && music.classList.contains('open')) {
        const mc = document.getElementById('musicPanelClose');
        if (mc) mc.click();
        else music.classList.remove('open');
        closed = true;
    }
    if (manage && manage.classList.contains('open')) {
        const mClose = document.getElementById('eventsManageClose');
        if (mClose) mClose.click();
        else manage.classList.remove('open');
        closed = true;
    }

    if (closed) {
        e.preventDefault();
        e.stopPropagation();
    }
}
