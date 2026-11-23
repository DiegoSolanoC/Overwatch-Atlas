/**
 * Desktop viewport fit — shrink `--desktop-scale` on smaller laptop/desktop
 * windows so chrome matches a full-size reference display without asking users
 * to change browser zoom.
 *
 * Phones (coarse pointer) keep the CSS default; only mouse/trackpad desktops
 * are adjusted, and only downward (never larger than the authored 0.5025).
 */

export const DESKTOP_SCALE_BASE = 0.5025;
/** Reference CSS viewport where BASE looks correct (browser chrome included). */
export const DESKTOP_SCALE_REF_WIDTH = 1600;
export const DESKTOP_SCALE_REF_HEIGHT = 900;
/** Floor so tiny windows stay usable. */
export const DESKTOP_SCALE_MIN = 0.38;
/** Treat near-reference sizes as a perfect fit (avoid zooming full-HD chrome). */
const FIT_DEADBAND = 0.94;

/**
 * @returns {boolean}
 */
export function isDesktopPointerDevice() {
    return (
        typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches
    );
}

/**
 * @param {number} scale
 * @returns {string}
 */
export function desktopScaleInversePercent(scale) {
    const s = Number(scale);
    if (!Number.isFinite(s) || s <= 0) {
        return `${100 / DESKTOP_SCALE_BASE}%`;
    }
    return `${100 / s}%`;
}

/**
 * @param {{ width?: number, height?: number }} [viewport]
 * @returns {number}
 */
export function computeDesktopFitScale(viewport = {}) {
    if (!isDesktopPointerDevice()) {
        return DESKTOP_SCALE_BASE;
    }

    const w = Number(viewport.width);
    const h = Number(viewport.height);
    const width = Number.isFinite(w) && w > 0 ? w : window.innerWidth;
    const height = Number.isFinite(h) && h > 0 ? h : window.innerHeight;
    if (!(width > 0) || !(height > 0)) {
        return DESKTOP_SCALE_BASE;
    }

    let fit = Math.min(1, width / DESKTOP_SCALE_REF_WIDTH, height / DESKTOP_SCALE_REF_HEIGHT);
    if (fit >= FIT_DEADBAND) fit = 1;

    const scale = DESKTOP_SCALE_BASE * fit;
    return Math.max(DESKTOP_SCALE_MIN, Math.min(DESKTOP_SCALE_BASE, scale));
}

/**
 * Write --desktop-scale (+ inverse) on :root. Returns true when the value changed.
 * @returns {boolean}
 */
export function applyDesktopViewportFit() {
    if (typeof document === 'undefined') return false;

    const root = document.documentElement;
    const next = computeDesktopFitScale();
    const prevRaw = root.style.getPropertyValue('--desktop-scale').trim();
    const prev = prevRaw ? Number(prevRaw) : NaN;
    const same =
        Number.isFinite(prev) && Math.abs(prev - next) < 0.0005;

    if (same && prevRaw) return false;

    /* Clear inline override when back at base so CSS variables.css owns it. */
    if (Math.abs(next - DESKTOP_SCALE_BASE) < 0.0005) {
        if (!prevRaw) return false;
        root.style.removeProperty('--desktop-scale');
        root.style.removeProperty('--desktop-scale-inverse');
        return true;
    }

    root.style.setProperty('--desktop-scale', String(next));
    root.style.setProperty('--desktop-scale-inverse', desktopScaleInversePercent(next));
    return true;
}

/**
 * Install resize listeners. Idempotent. Safe to call from AppInitializer.
 */
export function initDesktopViewportFit() {
    if (typeof window === 'undefined') return;
    if (document.documentElement.dataset.desktopViewportFitInit === '1') {
        applyDesktopViewportFit();
        return;
    }
    document.documentElement.dataset.desktopViewportFitInit = '1';

    applyDesktopViewportFit();

    let raf = 0;
    let suppressResizeEcho = false;
    const onLayout = () => {
        if (suppressResizeEcho) return;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            raf = 0;
            const changed = applyDesktopViewportFit();
            if (!changed) return;
            /*
             * Notify layout consumers (dock, traps, badges) without re-entering
             * this handler via a synthetic resize echo.
             */
            suppressResizeEcho = true;
            try {
                window.dispatchEvent(new Event('resize'));
            } finally {
                requestAnimationFrame(() => {
                    suppressResizeEcho = false;
                });
            }
        });
    };

    window.addEventListener('resize', onLayout);
    window.addEventListener('orientationchange', onLayout);
    if (typeof window.visualViewport !== 'undefined' && window.visualViewport) {
        window.visualViewport.addEventListener('resize', onLayout);
    }
}

if (typeof window !== 'undefined') {
    window.DesktopViewportFit = {
        init: initDesktopViewportFit,
        apply: applyDesktopViewportFit,
        compute: computeDesktopFitScale,
        BASE: DESKTOP_SCALE_BASE,
    };
}
