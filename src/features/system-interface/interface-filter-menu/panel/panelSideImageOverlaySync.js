/**
 * Center-stage image overlay helpers for the filters/music panel lifecycle.
 * Opening filters or music fully closes the info slide; restore only runs if
 * the slide is still open when the side panel closes.
 *
 * Story entries use `currentImagePath`; Dialogue Theater uses the stage bridge.
 */

import {
    isDialogueTheaterImageOverlayContext,
} from '../../../dialogue-theater/dialogue-theater-stage/dialogueTheaterImageOverlayBridge.js';

function isGlobalImageToggleOn() {
    return localStorage.getItem('globalImageToggle') !== 'false';
}

function getStandaloneSlide() {
    return window.standaloneEventSlide || null;
}

function isEventSlideOpen() {
    return !!document.getElementById('eventSlide')?.classList.contains('open');
}

function isEventImageOverlayOpen() {
    const overlay = document.getElementById('eventImageOverlay');
    return !!(overlay && overlay.classList.contains('open'));
}

/**
 * Fade out the stage/image overlay when a side panel opens over the event slide.
 */
export function hideEventImageOverlayForSidePanel() {
    if (!isEventSlideOpen() || !isEventImageOverlayOpen()) return;

    const slide = getStandaloneSlide();
    if (slide?.hideImageOverlayGradually) {
        slide.hideImageOverlayGradually(600);
    } else if (slide?.hideImageOverlay) {
        slide.hideImageOverlay();
    }
}

/**
 * Fade the stage/image back in after the filters/music panel closes.
 */
export function restoreEventImageOverlayAfterSidePanel() {
    if (!isEventSlideOpen() || !isGlobalImageToggleOn()) return;
    if (isEventImageOverlayOpen()) return;

    const slide = getStandaloneSlide();
    if (!slide?.showImageOverlayGradually) return;

    if (isDialogueTheaterImageOverlayContext()) {
        void slide.showImageOverlayGradually('', 600);
        return;
    }

    const path = slide.currentImagePath?.trim();
    if (path) {
        void slide.showImageOverlayGradually(path, 600);
    }
}
