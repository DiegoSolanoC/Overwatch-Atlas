/**
 * Per-hero look ↔ story-event ranges (start + end event names), persisted in localStorage.
 */

const STORAGE_KEY = 'overwatchAtlas.heroBiographyLookRanges';

/** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
export const HERO_BIO_LOOK_RANGE_DEFAULTS = {
    Ana: {
        Heroic: { startEvent: 'Lost Ghosts', endEvent: 'From the Ashes' },
        Classic: { startEvent: 'Heroes Never Die', endEvent: 'Lost Family' },
    },
};

/** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>> | null} */
let cached = null;

/**
 * @param {string} name
 * @returns {string}
 */
export function normalizeEventNameForMatch(name) {
    return String(name || '')
        .replace(/<[^>]*>/g, '')
        .trim()
        .toLowerCase();
}

/**
 * @returns {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>}
 */
export function loadHeroBiographyLookRanges() {
    if (cached) return cached;

    /** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
    let stored = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') stored = parsed;
        }
    } catch {
        stored = {};
    }

    cached = mergeLookRangeMaps(HERO_BIO_LOOK_RANGE_DEFAULTS, stored);
    return cached;
}

/**
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} base
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} overrides
 */
function mergeLookRangeMaps(base, overrides) {
    /** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
    const out = {};
    const heroIds = new Set([
        ...Object.keys(base || {}),
        ...Object.keys(overrides || {}),
    ]);

    for (const heroId of heroIds) {
        const baseLooks = base?.[heroId] || {};
        const overrideLooks = overrides?.[heroId] || {};
        const lookNames = new Set([
            ...Object.keys(baseLooks),
            ...Object.keys(overrideLooks),
        ]);
        out[heroId] = {};
        for (const look of lookNames) {
            const merged = {
                ...baseLooks[look],
                ...overrideLooks[look],
            };
            if (merged.startEvent || merged.endEvent) {
                out[heroId][look] = {
                    startEvent: String(merged.startEvent || '').trim(),
                    endEvent: String(merged.endEvent || '').trim(),
                };
            }
        }
        if (!Object.keys(out[heroId]).length) delete out[heroId];
    }
    return out;
}

/**
 * @param {string} heroFilterKey
 * @param {string} lookName
 * @param {{ startEvent?: string, endEvent?: string }} range
 */
export function saveHeroBiographyLookRange(heroFilterKey, lookName, range) {
    const heroId = String(heroFilterKey || '').trim();
    const look = String(lookName || '').trim();
    if (!heroId || !look) return;

    const all = { ...loadHeroBiographyLookRanges() };
    if (!all[heroId]) all[heroId] = {};

    const startEvent = String(range?.startEvent || '').trim();
    const endEvent = String(range?.endEvent || '').trim();

    if (!startEvent && !endEvent) {
        delete all[heroId][look];
        if (!Object.keys(all[heroId]).length) delete all[heroId];
    } else {
        all[heroId][look] = { startEvent, endEvent };
    }

    const toStore = stripDefaultsFromStored(all);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
        console.warn('[hero-biography] Could not save look ranges:', err);
    }

    cached = all;
    window.dispatchEvent(new CustomEvent('heroBiographyLookRangesUpdated', {
        detail: { heroId, look },
    }));
}

/**
 * Only persist values that differ from shipped defaults (keeps localStorage small).
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} merged
 */
function stripDefaultsFromStored(merged) {
    /** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
    const out = {};

    for (const [heroId, looks] of Object.entries(merged)) {
        for (const [look, range] of Object.entries(looks || {})) {
            const def = HERO_BIO_LOOK_RANGE_DEFAULTS[heroId]?.[look];
            const sameAsDefault =
                def &&
                normalizeEventNameForMatch(def.startEvent) === normalizeEventNameForMatch(range.startEvent) &&
                normalizeEventNameForMatch(def.endEvent) === normalizeEventNameForMatch(range.endEvent);

            if (sameAsDefault) continue;

            if (!out[heroId]) out[heroId] = {};
            out[heroId][look] = { ...range };
        }
    }
    return out;
}

/**
 * @param {string} heroFilterKey
 * @param {string} lookName
 * @returns {{ startEvent: string, endEvent: string } | null}
 */
export function getHeroBiographyLookRange(heroFilterKey, lookName) {
    const heroId = String(heroFilterKey || '').trim();
    const look = String(lookName || '').trim();
    if (!heroId || !look) return null;

    const range = loadHeroBiographyLookRanges()[heroId]?.[look];
    if (!range) return null;

    return {
        startEvent: String(range.startEvent || '').trim(),
        endEvent: String(range.endEvent || '').trim(),
    };
}

export function clearHeroBiographyLookRangesCache() {
    cached = null;
}
