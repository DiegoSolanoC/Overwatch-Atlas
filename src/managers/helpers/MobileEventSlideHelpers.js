/**
 * MobileEventSlideHelpers - Mobile-specific DOM manipulations for event slide
 * Extracted from EventSlideManager
 */

/**
 * Mobile-specific constants
 */
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_PORTRAIT_ZOOM = 7.0;
export const DEFAULT_ZOOM = 3.5;

let portraitLayoutListenerBound = false;

/**
 * Check if device is mobile
 * @returns {boolean}
 */
export function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

/**
 * Check if device is mobile portrait
 * @returns {boolean}
 */
export function isMobilePortrait() {
    return window.innerWidth <= MOBILE_BREAKPOINT && window.innerHeight > window.innerWidth;
}

/**
 * Get default camera zoom based on device type
 * @returns {number}
 */
export function getDefaultZoom() {
    return isMobilePortrait() ? MOBILE_PORTRAIT_ZOOM : DEFAULT_ZOOM;
}

/**
 * Reset mobile full-text sheet mode (class + toggle label).
 */
export function resetMobileFullTextUi() {
    const slide = document.getElementById('eventSlide');
    const btn = document.getElementById('eventFullTextToggle');
    if (slide) {
        slide.classList.remove('event-slide--mobile-full-text');
    }
    if (btn) {
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = FULL_TEXT_LABEL_OFF;
    }
}

function ensureMobileFullTextViewportListener() {
    if (typeof window === 'undefined' || window.__mobileFullTextViewportBound) {
        return;
    }
    window.__mobileFullTextViewportBound = true;
    window.addEventListener('resize', function () {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
            resetMobileFullTextUi();
        }
    });
}

/**
 * Move title, location (flag), and timeline meta into the scrollable column (portrait only).
 * Restores to .event-slide-top when not portrait or not mobile.
 */
export function syncMobileEventSlidePortraitLayout() {
    const scroll = document.getElementById('eventSlideScrollable');
    const text = document.getElementById('eventSlideText');
    const top = document.getElementById('eventSlideTop');
    const titleRow = document.getElementById('eventSlideTitleRow');
    const title = document.getElementById('eventSlideTitle');
    const loc = document.getElementById('eventSlideLocation');
    const meta = document.getElementById('eventSlideTimelineMeta');

    if (!scroll || !text || !top || !title) {
        return;
    }

    if (!isMobile() || !isMobilePortrait()) {
        restorePortraitMetaToTop();
        return;
    }

    const titleBlock = titleRow || title;
    if (titleBlock.parentElement === scroll) {
        return;
    }

    scroll.insertBefore(titleBlock, text);
    if (loc) {
        scroll.insertBefore(loc, text);
    }
    if (meta) {
        scroll.insertBefore(meta, text);
    }
}

/**
 * Put title / location / timeline back under .event-slide-top (after variant toggles or era).
 */
export function restorePortraitMetaToTop() {
    const top = document.getElementById('eventSlideTop');
    const titleRow = document.getElementById('eventSlideTitleRow');
    const title = document.getElementById('eventSlideTitle');
    const loc = document.getElementById('eventSlideLocation');
    const meta = document.getElementById('eventSlideTimelineMeta');
    const titleBlock = titleRow || title;
    if (!top || !titleBlock || titleBlock.parentElement === top) {
        return;
    }

    const variants = document.getElementById('eventVariantToggles');
    const era = document.getElementById('eventSlideEra');
    const anchor =
        variants && variants.parentNode === top ? variants : era && era.parentNode === top ? era : null;

    if (anchor) {
        top.insertBefore(titleBlock, anchor.nextSibling);
    } else {
        top.insertBefore(titleBlock, top.firstChild);
    }

    if (loc) {
        top.insertBefore(loc, titleBlock.nextSibling);
    }
    if (meta) {
        const after = loc || titleBlock;
        top.insertBefore(meta, after.nextSibling);
    }
}

function ensurePortraitLayoutListener() {
    if (typeof window === 'undefined' || portraitLayoutListenerBound) {
        return;
    }
    portraitLayoutListenerBound = true;

    const run = () => {
        const slide = document.getElementById('eventSlide');
        if (!slide || !slide.classList.contains('open')) {
            return;
        }
        syncMobileEventSlidePortraitLayout();
    };

    window.addEventListener('resize', run);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(run, 120);
    });
}

/**
 * Setup mobile-specific DOM when opening event slide
 */
export function setupMobileEventSlide() {
    ensurePortraitLayoutListener();
    if (!isMobile()) {
        return;
    }
    syncMobileEventSlidePortraitLayout();
}

/**
 * Cleanup mobile-specific DOM when closing event slide
 */
export function cleanupMobileEventSlide() {
    resetMobileFullTextUi();
    restorePortraitMetaToTop();
}
