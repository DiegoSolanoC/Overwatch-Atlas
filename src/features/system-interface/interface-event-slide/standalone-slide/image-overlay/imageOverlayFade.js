/**
 * Shared fade-timer bookkeeping for the event image overlay.
 * Interval-based fade-in/out and CSS fades clear each other so they do not fight.
 */

export function clearImageOverlayFadeTimer(slide) {
    if (!slide || typeof slide !== 'object') return;
    if (slide._imageOverlayFadeTimer != null) {
        clearInterval(slide._imageOverlayFadeTimer);
        slide._imageOverlayFadeTimer = null;
    }
}

export function setImageOverlayFadeTimer(slide, timerId) {
    clearImageOverlayFadeTimer(slide);
    if (slide && typeof slide === 'object') {
        slide._imageOverlayFadeTimer = timerId;
    }
}
