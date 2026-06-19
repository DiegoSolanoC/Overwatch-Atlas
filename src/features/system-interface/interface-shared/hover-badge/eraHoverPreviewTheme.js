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

/** Label color for the dock era picker title (`complete` = neutral white). */
export function getEraDockLabelColorHex(eraSlugOrId) {
    const id = String(eraSlugOrId || '').trim();
    if (!id || id === 'complete') return '#f0f0f0';
    return STRIPE_HEX_BY_SLUG[id] || '#f0f0f0';
}

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

/**
 * @param {string} color
 * @returns {[number, number, number]}
 */
function parseColorToRgb(color) {
    if (typeof color !== 'string') return [128, 128, 128];
    if (color.startsWith('rgba') || color.startsWith('rgb')) {
        const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
    }
    const hex = color.replace('#', '').trim();
    if (hex.length === 6) {
        return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
        ];
    }
    return [128, 128, 128];
}

/**
 * @param {string} a
 * @param {string} b
 * @param {number} t 0..1
 * @returns {string} `#rrggbb`
 */
function lerpHexColor(a, b, t) {
    const clamped = Math.max(0, Math.min(1, t));
    const [r0, g0, b0] = parseColorToRgb(a);
    const [r1, g1, b1] = parseColorToRgb(b);
    const r = Math.round(r0 + (r1 - r0) * clamped);
    const g = Math.round(g0 + (g1 - g0) * clamped);
    const bChannel = Math.round(b0 + (b1 - b0) * clamped);
    return `#${[r, g, bChannel].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Sample era stripe color along JSON event order (0 = first event, 1 = last).
 * @param {object[]|null|undefined} allEvents
 * @param {number} progress
 * @returns {string} `#rrggbb`
 */
export function sampleEraStripeColorAtLinearProgress(allEvents, progress) {
    const events = Array.isArray(allEvents) ? allEvents : [];
    const n = events.length;
    if (n === 0) return '#808080';
    const t = Math.max(0, Math.min(1, Number(progress) || 0)) * n;
    const idx = Math.min(n - 1, Math.floor(t));
    const frac = t - idx;
    const c0 = getEraStripeColorHexForEvent(events[idx]);
    const c1 = getEraStripeColorHexForEvent(events[Math.min(n - 1, idx + 1)]);
    return lerpHexColor(c0, c1, frac);
}

/**
 * Era-colored main timeline bar — one flat segment per event, split at midpoints
 * (same palette as the dock era strip under the page slider).
 *
 * @param {object[]|null|undefined} events
 * @param {{ x: number }[]|null|undefined} positions
 * @param {number} trackWidth
 * @returns {string|null}
 */
export function buildTimelineEraLineGradient(events, positions, trackWidth) {
    const list = Array.isArray(events) ? events : [];
    const width = Math.max(1, Number(trackWidth) || 1);
    /** @type {{ x: number, i: number }[]} */
    const placed = [];

    if (Array.isArray(positions)) {
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!pos || !Number.isFinite(pos.x)) continue;
            placed.push({ x: pos.x, i });
        }
    }

    if (!placed.length) return null;

    placed.sort((a, b) => a.x - b.x);
    const parts = [];

    for (let k = 0; k < placed.length; k += 1) {
        const { x, i } = placed[k];
        const leftX = k === 0 ? 0 : (placed[k - 1].x + x) / 2;
        const rightX = k === placed.length - 1 ? width : (x + placed[k + 1].x) / 2;
        const color = getEraStripeColorHexForEvent(list[i]);
        const leftPct = Math.max(0, Math.min(100, (leftX / width) * 100));
        const rightPct = Math.max(0, Math.min(100, (rightX / width) * 100));
        parts.push(`${color} ${leftPct}%`, `${color} ${rightPct}%`);
    }

    return `linear-gradient(to right, ${parts.join(', ')})`;
}

/**
 * @param {string} hex
 * @returns {string} `r, g, b` for CSS `rgb(var(--x) / alpha)`
 */
export function hexColorToRgbCsv(hex) {
    const [r, g, b] = parseColorToRgb(hex);
    return `${r}, ${g}, ${b}`;
}

// Make available globally for non-module usage
if (typeof window !== 'undefined') {
    window.EraHoverPreviewTheme = {
        getEraHoverPreviewSlug,
        ERA_STRIPE_NEUTRAL,
        getEraStripeColorHexForEvent,
        buildGlobalEraStripeBackgroundLinearGradient,
        buildTimelineEraLineGradient,
        sampleEraStripeColorAtLinearProgress,
        hexColorToRgbCsv,
    };
}
