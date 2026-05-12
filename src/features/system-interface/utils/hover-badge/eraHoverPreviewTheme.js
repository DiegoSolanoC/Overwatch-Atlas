/**
 * Maps canonical event `eraName` strings (see data/events.json) to stable `data-era` slugs
 * for hover-preview CSS. Add entries when new eras are introduced.
 */
const SLUG_BY_NORMALIZED = {
    'the age of progress': 'age-progress',
    'the omnic crisis': 'omnic-crisis',
    'the golden age': 'golden-age',
    'the fall of overwatch': 'fall-overwatch',
    'the age of conflict': 'age-conflict',
    'the null sector invasion': 'null-sector',
    'the reign of talon': 'reign-talon',
};

/**
 * @param {string|null|undefined} eraPlain
 * @returns {string} slug for `data-era` or '' if unknown / empty
 */
export function getEraHoverPreviewSlug(eraPlain) {
    if (eraPlain == null || typeof eraPlain !== 'string') return '';
    const k = eraPlain.trim().toLowerCase();
    return SLUG_BY_NORMALIZED[k] || '';
}

/** Unknown / missing era on the page-slider strip */
export const ERA_STRIPE_NEUTRAL = 'rgba(255, 255, 255, 0.32)';

/**
 * Hex colors for the under-slider era bar (keep in sync with music.css hover-preview era names).
 * @type {Record<string, string>}
 */
const STRIPE_HEX_BY_SLUG = {
    'age-progress': '#66bb6a',
    'omnic-crisis': '#ff5722',
    'golden-age': '#ffca28',
    'fall-overwatch': '#4e342e',
    'age-conflict': '#42a5f5',
    'null-sector': '#ba68c8',
    'reign-talon': '#8b1313',
};

/**
 * @param {object|null|undefined} eventData - Root event (era on parent)
 * @returns {string}
 */
export function getEraStripeColorHexForEvent(eventData) {
    const era =
        typeof window !== 'undefined'
        && window.EventTimelineHelpers
        && typeof window.EventTimelineHelpers.getEraNameTrimmed === 'function'
            ? window.EventTimelineHelpers.getEraNameTrimmed(eventData)
            : '';
    const slug = getEraHoverPreviewSlug(era);
    return slug ? STRIPE_HEX_BY_SLUG[slug] : ERA_STRIPE_NEUTRAL;
}

/**
 * Full-bar era map aligned with the page slider: each page gets an equal slice (1/totalPages),
 * each slice is split into one segment per event on that page (same rules as slider sub-ticks).
 * @param {object[]|null|undefined} allEvents - Full ordered list (e.g. dataModel.events)
 * @param {number} eventsPerPage
 * @param {number} totalPages
 * @returns {string} CSS `background` value
 */
export function buildGlobalEraStripeBackgroundLinearGradient(allEvents, eventsPerPage, totalPages) {
    const events = Array.isArray(allEvents) ? allEvents : [];
    const E = Math.max(1, Number(eventsPerPage) || 10);
    const T = Math.max(1, Number(totalPages) || 1);
    const N = events.length;
    if (N === 0) {
        return `linear-gradient(to right, ${ERA_STRIPE_NEUTRAL}, ${ERA_STRIPE_NEUTRAL})`;
    }
    const parts = [];
    for (let p = 0; p < T; p += 1) {
        const onPage = Math.min(E, Math.max(0, N - p * E));
        const pageLeft = (p / T) * 100;
        const pageRight = ((p + 1) / T) * 100;
        const pageW = pageRight - pageLeft;
        if (onPage <= 0) {
            parts.push(`${ERA_STRIPE_NEUTRAL} ${pageLeft}%`, `${ERA_STRIPE_NEUTRAL} ${pageRight}%`);
            continue;
        }
        for (let e = 0; e < onPage; e += 1) {
            const ev = events[p * E + e];
            const c = getEraStripeColorHexForEvent(ev);
            const segLeft = pageLeft + (e / onPage) * pageW;
            const segRight = pageLeft + ((e + 1) / onPage) * pageW;
            parts.push(`${c} ${segLeft}%`, `${c} ${segRight}%`);
        }
    }
    return `linear-gradient(to right, ${parts.join(', ')})`;
}

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.EraHoverPreviewTheme = {
        getEraHoverPreviewSlug,
        ERA_STRIPE_NEUTRAL,
        getEraStripeColorHexForEvent,
        buildGlobalEraStripeBackgroundLinearGradient
    };
}
