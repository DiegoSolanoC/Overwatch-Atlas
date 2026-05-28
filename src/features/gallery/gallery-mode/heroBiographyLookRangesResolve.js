/**
 * Resolve which hero bio look applies at a story event (by event name / index).
 */

import {
    getHeroBiographyLookRange,
    normalizeEventNameForMatch,
} from './heroBiographyLookRangesStorage.js';

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
 * @param {string} heroFilterKey
 * @param {string} lookName
 * @returns {{ lo: number, hi: number } | null}
 */
export function getLookRangeTimelineBounds(heroFilterKey, lookName) {
    const range = getHeroBiographyLookRange(heroFilterKey, lookName);
    if (!range) return null;

    const startIdx = findStoryTimelineIndexByEventName(range.startEvent);
    const endIdx = findStoryTimelineIndexByEventName(range.endEvent);
    if (startIdx < 0 && endIdx < 0) return null;

    const lo = startIdx >= 0 && endIdx >= 0
        ? Math.min(startIdx, endIdx)
        : (startIdx >= 0 ? startIdx : endIdx);
    const hi = startIdx >= 0 && endIdx >= 0
        ? Math.max(startIdx, endIdx)
        : (startIdx >= 0 ? startIdx : endIdx);

    return { lo, hi };
}

/**
 * Narrow / single-event ranges beat broad ones (e.g. Merciful @ one event inside Captain's span).
 * @param {string} heroFilterKey
 * @param {string} lookName
 * @returns {{ span: number, explicitSingle: boolean } | null}
 */
export function getLookRangePriorityMeta(heroFilterKey, lookName) {
    const bounds = getLookRangeTimelineBounds(heroFilterKey, lookName);
    if (!bounds) return null;

    const range = getHeroBiographyLookRange(heroFilterKey, lookName);
    const span = bounds.hi - bounds.lo;
    const explicitSingle = !!(
        range?.startEvent &&
        range?.endEvent &&
        normalizeEventNameForMatch(range.startEvent) === normalizeEventNameForMatch(range.endEvent)
    );

    return { span, explicitSingle };
}

/**
 * @param {string} heroFilterKey
 * @param {number} timelineIndex
 * @param {string[]} lookNames
 * @returns {string | null}
 */
export function resolveLookForTimelineIndex(heroFilterKey, timelineIndex, lookNames) {
    if (!heroFilterKey || timelineIndex < 0 || !lookNames?.length) return null;

    /** @type {{ look: string, span: number, explicitSingle: boolean }[]} */
    const matches = [];

    for (const look of lookNames) {
        const bounds = getLookRangeTimelineBounds(heroFilterKey, look);
        if (!bounds) continue;
        if (timelineIndex < bounds.lo || timelineIndex > bounds.hi) continue;

        const meta = getLookRangePriorityMeta(heroFilterKey, look);
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
 * @param {string} heroFilterKey
 * @param {object} event
 * @param {string[]} lookNames
 * @returns {string | null}
 */
export function resolveLookForStoryEvent(heroFilterKey, event, lookNames) {
    const idx = getStoryTimelineIndexForEvent(event);
    if (idx < 0) return null;
    return resolveLookForTimelineIndex(heroFilterKey, idx, lookNames);
}
