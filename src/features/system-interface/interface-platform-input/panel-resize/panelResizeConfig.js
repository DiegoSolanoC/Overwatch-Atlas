/**
 * Static configuration + width math for the four resizable side panels.
 *
 * - `PANELS`: per-panel ids, edges, and CSS-variable names (the runtime sets the
 *   `--user-panel-*` vars on `:root` and falls back to `--panel-*` defaults).
 * - `LEGACY_STORAGE_KEYS`: pre-rewrite localStorage entries we purge on boot.
 * - Width helpers: read `getComputedStyle(:root)` for defaults/caps, clamp the
 *   current drag value, and clear the user override (called when a panel closes).
 */

export const MOBILE_MQ = '(max-width: 768px)';

export const PANELS = [
    {
        id: 'eventSlide',
        name: 'Event info',
        edge: 'inner-right',
        cssVar: '--user-panel-event-width',
        defaultVar: '--panel-event-width',
        maxVar: '--panel-event-width-max'
    },
    {
        id: 'filtersPanel',
        name: 'Filters',
        edge: 'inner-left',
        cssVar: '--user-panel-filters-width',
        defaultVar: '--panel-filters-width',
        maxVar: '--panel-filters-width-max'
    },
    {
        id: 'musicPanel',
        name: 'Music',
        edge: 'inner-left',
        cssVar: '--user-panel-music-width',
        defaultVar: '--panel-music-width'
    },
    {
        id: 'eventsManagePanel',
        name: 'Manager',
        edge: 'inner-left',
        cssVar: '--user-panel-events-manage-width',
        defaultVar: '--panel-events-manage-width'
    }
];

const LEGACY_STORAGE_KEYS = [
    'overwatch-timeline:panelW:event',
    'overwatch-timeline:panelW:filters',
    'overwatch-timeline:panelW:music',
    'overwatch-timeline:panelW:eventsManage'
];

export function isMobile() {
    return window.matchMedia(MOBILE_MQ).matches;
}

export function getDefaultPx(defaultVar) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(defaultVar).trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 600;
}

/** Optional positive length from `:root` (returns null if missing/invalid). */
export function getOptionalPx(cssVar) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function maxPanelPx() {
    /* Allow nearly full viewport width; small gutter keeps map/map UI usable. */
    return Math.max(400, Math.floor(window.innerWidth * 0.99 - 8));
}

export function maxWidthForPanel(cfg) {
    const cap = maxPanelPx();
    if (cfg && cfg.maxVar) {
        const m = getOptionalPx(cfg.maxVar);
        if (m != null) return Math.min(m, cap);
    }
    return cap;
}

export function clampWidth(px, cfg) {
    const min = getDefaultPx(cfg.defaultVar);
    const max = maxWidthForPanel(cfg);
    return Math.min(Math.max(px, min), max);
}

export function clearUserWidth(cfg) {
    document.documentElement.style.removeProperty(cfg.cssVar);
}

export function currentWidthPx(cfg) {
    const curVar = document.documentElement.style.getPropertyValue(cfg.cssVar).trim();
    if (curVar) {
        const n = parseInt(curVar, 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return getDefaultPx(cfg.defaultVar);
}

export function purgeLegacyStorage() {
    LEGACY_STORAGE_KEYS.forEach(function (key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            /* ignore */
        }
    });
}
