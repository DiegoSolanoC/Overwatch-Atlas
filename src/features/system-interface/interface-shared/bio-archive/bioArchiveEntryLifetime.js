/**
 * Optional lifespan on bio archive entries (heroes / factions / NPCs).
 *
 *   - `startEvent` omitted — existed before the timeline or for an unknown time.
 *   - `endEvent` omitted — still active through the latest story entry.
 */

import { buildStoryEventIndexByName } from './bioArchiveConnectionRanges.js';

/**
 * @typedef {{
 *   startEvent?: string,
 *   endEvent?: string,
 * }} BioArchiveEntryLifetimeRange
 */

/**
 * @param {unknown} raw
 * @returns {BioArchiveEntryLifetimeRange | null}
 */
export function normalizeBioArchiveEntryLifetimeRange(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const startEvent = String(raw.startEvent ?? '').trim();
    const endEvent = raw.endEvent != null ? String(raw.endEvent).trim() : '';
    if (!startEvent && !endEvent) return null;

    /** @type {BioArchiveEntryLifetimeRange} */
    const out = {};
    if (startEvent) out.startEvent = startEvent;
    if (endEvent) out.endEvent = endEvent;
    return out;
}

/**
 * @param {BioArchiveEntryLifetimeRange} lifetime
 * @param {number} spanStart
 * @param {number} spanEnd
 * @param {(eventName: string) => number} indexByEventName
 * @returns {'active' | 'before' | 'after'}
 */
export function resolveEntryLifetimePageStatus(lifetime, spanStart, spanEnd, indexByEventName) {
    if (!lifetime || spanStart < 0 || spanEnd < spanStart) return 'active';

    const startName = String(lifetime.startEvent || '').trim();
    const endName = String(lifetime.endEvent || '').trim();

    let startIdx = 0;
    if (startName) {
        startIdx = indexByEventName(startName);
        if (startIdx < 0) return 'active';
    }

    let endIdx = Number.POSITIVE_INFINITY;
    if (endName) {
        endIdx = indexByEventName(endName);
        if (endIdx < 0) return 'active';
    }

    if (spanEnd < startIdx) return 'before';
    if (spanStart > endIdx) return 'after';
    return 'active';
}

export { buildStoryEventIndexByName };
