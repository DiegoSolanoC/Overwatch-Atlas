/**
 * Blocks mobile landscape — Atlas is portrait-only on phones/tablets (short edge ≤768).
 * Shows a full-screen rotate prompt; optional Screen Orientation API lock where supported.
 */

const HTML_CLASS = 'mobile-landscape-blocked';
const GATE_ID = 'mobilePortraitGate';

/** @returns {boolean} True when a touch-class device is landscape with phone-sized short edge. */
export function isMobileLandscapeBlocked() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= h) return false;

    const shortEdge = Math.min(w, h);
    if (shortEdge > 768) return false;

    const touchDevice =
        (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0) ||
        (typeof window.matchMedia === 'function' &&
            window.matchMedia('(hover: none) and (pointer: coarse)').matches);

    return touchDevice;
}

function syncMobilePortraitGateDom() {
    const blocked = isMobileLandscapeBlocked();
    document.documentElement.classList.toggle(HTML_CLASS, blocked);

    const gate = document.getElementById(GATE_ID);
    if (gate) {
        gate.setAttribute('aria-hidden', blocked ? 'false' : 'true');
    }
}

async function tryLockPortraitOrientation() {
    if (!isMobileLandscapeBlocked()) return;
    try {
        const orientation = screen.orientation;
        if (orientation && typeof orientation.lock === 'function') {
            await orientation.lock('portrait-primary');
            syncMobilePortraitGateDom();
        }
    } catch (_) {
        /* Full lock needs installed PWA / fullscreen on most browsers — overlay is the fallback. */
    }
}

/**
 * Install portrait gate listeners. Idempotent.
 */
export function initMobilePortraitGate() {
    if (document.documentElement.dataset.mobilePortraitGateInit === '1') return;
    document.documentElement.dataset.mobilePortraitGateInit = '1';

    syncMobilePortraitGateDom();

    const onLayout = () => {
        syncMobilePortraitGateDom();
    };
    window.addEventListener('resize', onLayout);
    window.addEventListener('orientationchange', onLayout);
    if (typeof window.visualViewport !== 'undefined' && window.visualViewport) {
        window.visualViewport.addEventListener('resize', onLayout);
    }

    void tryLockPortraitOrientation();
}

if (typeof window !== 'undefined') {
    window.MobilePortraitGate = {
        init: initMobilePortraitGate,
        isBlocked: isMobileLandscapeBlocked,
        sync: syncMobilePortraitGateDom,
    };
}
