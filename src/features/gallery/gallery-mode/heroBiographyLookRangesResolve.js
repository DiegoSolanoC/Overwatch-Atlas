/**
 * Resolve which biography look applies at a story event (heroes or factions).
 */

import { getBioBiographyLookRange } from './bioBiographyLookRangesStorage.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import { normalizeEventNameForMatch } from './heroBiographyLookRangesStorage.js';

/**
 * @returns {object[]}
 */
function getStoryTimelineEvents() {
    return window.eventManager?.getDockTimelineEvents?.() || [];
}

/**
 * @param {string} eventName
 * @returns {number}
 */
export function findStoryTimelineIndexByEventName(eventName) {
    const needle = normalizeEventNameForMatch(eventName);
    if (!needle) return -1;

    const events = getStoryTimelineEvents();
    return events.findIndex((e) => normalizeEventNameForMatch(e?.name) === needle);
}

/**
 * @param {object} event
 * @returns {number}
 */
export function getStoryTimelineIndexForEvent(event) {
    if (!event) return -1;

    const events = getStoryTimelineEvents();
    const idx = events.indexOf(event);
    if (idx >= 0) return idx;

    const byName = findStoryTimelineIndexByEventName(event.name);
    if (byName >= 0) return byName;

    if (event.lat != null && event.lon != null) {
        const lat = event.lat;
        const lon = event.lon;
        const nameNorm = normalizeEventNameForMatch(event.name);
        return events.findIndex((e) => {
            if (e.lat !== lat || e.lon !== lon) return false;
            if (!nameNorm) return true;
            return normalizeEventNameForMatch(e?.name) === nameNorm;
        });
    }

    return -1;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {string} lookName
 * @returns {{ lo: number, hi: number } | null}
 */
export function getLookRangeTimelineBounds(category, entityKey, lookName) {
    const range = getBioBiographyLookRange(category, entityKey, lookName);
    if (!range) return null;

    const hasStart = !!(range.startEvent && String(range.startEvent).trim());
    const hasEnd = !!(range.endEvent && String(range.endEvent).trim());
    if (!hasStart && !hasEnd) return null;

    const startIdx = hasStart ? findStoryTimelineIndexByEventName(range.startEvent) : -1;
    const endIdx = hasEnd ? findStoryTimelineIndexByEventName(range.endEvent) : -1;
    if (startIdx < 0 && endIdx < 0) return null;

    const events = getStoryTimelineEvents();
    const lastIdx = Math.max(0, events.length - 1);

    if (startIdx >= 0 && endIdx >= 0) {
        return {
            lo: Math.min(startIdx, endIdx),
            hi: Math.max(startIdx, endIdx),
        };
    }

    if (startIdx >= 0) {
        return { lo: startIdx, hi: lastIdx };
    }

    return { lo: 0, hi: endIdx };
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {string} lookName
 * @returns {{ span: number, explicitSingle: boolean } | null}
 */
export function getLookRangePriorityMeta(category, entityKey, lookName) {
    const bounds = getLookRangeTimelineBounds(category, entityKey, lookName);
    if (!bounds) return null;

    const range = getBioBiographyLookRange(category, entityKey, lookName);
    const span = bounds.hi - bounds.lo;
    const explicitSingle = !!(
        range?.startEvent &&
        range?.endEvent &&
        normalizeEventNameForMatch(range.startEvent) === normalizeEventNameForMatch(range.endEvent)
    );

    return { span, explicitSingle };
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {number} timelineIndex
 * @param {string[]} lookNames
 * @returns {string | null}
 */
export function resolveLookForTimelineIndex(category, entityKey, timelineIndex, lookNames) {
    const cat = normalizeBioBiographyCategory(category);
    if (!entityKey || timelineIndex < 0 || !lookNames?.length) return null;
    if (cat !== 'heroes' && cat !== 'factions') return null;

    /** @type {{ look: string, span: number, explicitSingle: boolean }[]} */
    const matches = [];

    for (const look of lookNames) {
        const bounds = getLookRangeTimelineBounds(cat, entityKey, look);
        if (!bounds) continue;
        if (timelineIndex < bounds.lo || timelineIndex > bounds.hi) continue;

        const meta = getLookRangePriorityMeta(cat, entityKey, look);
        if (!meta) continue;

        matches.push({
            look,
            span: meta.span,
            explicitSingle: meta.explicitSingle,
        });
    }

    if (!matches.length) return null;

    matches.sort((a, b) => {
        if (a.span !== b.span) return a.span - b.span;
        if (a.explicitSingle !== b.explicitSingle) return a.explicitSingle ? -1 : 1;
        return a.look.localeCompare(b.look, undefined, { sensitivity: 'base', numeric: true });
    });

    return matches[0].look;
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} entityKey
 * @param {object} event
 * @param {string[]} lookNames
 * @returns {string | null}
 */
export function resolveLookForStoryEvent(category, entityKey, event, lookNames) {
    const idx = getStoryTimelineIndexForEvent(event);
    if (idx < 0) return null;
    return resolveLookForTimelineIndex(category, entityKey, idx, lookNames);
}
