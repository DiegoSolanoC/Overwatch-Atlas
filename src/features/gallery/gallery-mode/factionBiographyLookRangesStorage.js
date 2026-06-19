/**
 * Per-faction logo look ↔ story-event ranges (start + end event names), persisted in localStorage.
 */

import { normalizeEventNameForMatch } from './heroBiographyLookRangesStorage.js';

const STORAGE_KEY = 'overwatchAtlas.factionBiographyLookRanges';

/** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
export const FACTION_BIO_LOOK_RANGE_DEFAULTS = {};

/** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>> | null} */
let cached = null;

/**
 * @returns {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>}
 */
export function loadFactionBiographyLookRanges() {
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

    cached = mergeLookRangeMaps(FACTION_BIO_LOOK_RANGE_DEFAULTS, stored);
    return cached;
}

/**
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} base
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} overrides
 */
function mergeLookRangeMaps(base, overrides) {
    /** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
    const out = {};
    const entityIds = new Set([
        ...Object.keys(base || {}),
        ...Object.keys(overrides || {}),
    ]);

    for (const entityId of entityIds) {
        const baseLooks = base?.[entityId] || {};
        const overrideLooks = overrides?.[entityId] || {};
        const lookNames = new Set([
            ...Object.keys(baseLooks),
            ...Object.keys(overrideLooks),
        ]);
        out[entityId] = {};
        for (const look of lookNames) {
            const merged = {
                ...baseLooks[look],
                ...overrideLooks[look],
            };
            if (merged.startEvent || merged.endEvent) {
                out[entityId][look] = {
                    startEvent: String(merged.startEvent || '').trim(),
                    endEvent: String(merged.endEvent || '').trim(),
                };
            }
        }
        if (!Object.keys(out[entityId]).length) delete out[entityId];
    }
    return out;
}

/**
 * @param {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} merged
 */
function stripDefaultsFromStored(merged) {
    /** @type {Record<string, Record<string, { startEvent?: string, endEvent?: string }>>} */
    const out = {};

    for (const [entityId, looks] of Object.entries(merged)) {
        for (const [look, range] of Object.entries(looks || {})) {
            const def = FACTION_BIO_LOOK_RANGE_DEFAULTS[entityId]?.[look];
            const sameAsDefault =
                def &&
                normalizeEventNameForMatch(def.startEvent) === normalizeEventNameForMatch(range.startEvent) &&
                normalizeEventNameForMatch(def.endEvent) === normalizeEventNameForMatch(range.endEvent);

            if (sameAsDefault) continue;

            if (!out[entityId]) out[entityId] = {};
            out[entityId][look] = { ...range };
        }
    }
    return out;
}

/**
 * @param {string} factionFilename
 * @param {string} lookName
 * @param {{ startEvent?: string, endEvent?: string }} range
 */
export function saveFactionBiographyLookRange(factionFilename, lookName, range) {
    const entityId = String(factionFilename || '').trim();
    const look = String(lookName || '').trim();
    if (!entityId || !look) return;

    const all = { ...loadFactionBiographyLookRanges() };
    if (!all[entityId]) all[entityId] = {};

    const startEvent = String(range?.startEvent || '').trim();
    const endEvent = String(range?.endEvent || '').trim();

    if (!startEvent && !endEvent) {
        delete all[entityId][look];
        if (!Object.keys(all[entityId]).length) delete all[entityId];
    } else {
        all[entityId][look] = { startEvent, endEvent };
    }

    const toStore = stripDefaultsFromStored(all);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
        console.warn('[gallery] Could not save faction look ranges:', err);
    }

    cached = all;
    window.dispatchEvent(new CustomEvent('bioBiographyLookRangesUpdated', {
        detail: { category: 'factions', entityId, look },
    }));
}

/**
 * @param {string} factionFilename
 * @param {string} lookName
 * @returns {{ startEvent: string, endEvent: string } | null}
 */
export function getFactionBiographyLookRange(factionFilename, lookName) {
    const entityId = String(factionFilename || '').trim();
    const look = String(lookName || '').trim();
    if (!entityId || !look) return null;

    const range = loadFactionBiographyLookRanges()[entityId]?.[look];
    if (!range) return null;

    return {
        startEvent: String(range.startEvent || '').trim(),
        endEvent: String(range.endEvent || '').trim(),
    };
}

export function clearFactionBiographyLookRangesCache() {
    cached = null;
}
