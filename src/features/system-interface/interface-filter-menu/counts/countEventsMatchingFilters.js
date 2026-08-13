/**
 * Count timeline events that match the pending filter selection (same lock
 * rules as the globe / Event Manager: an event matches if root or any variant
 * intersects the active filters).
 */

import { shouldEventBeLocked } from '../../interface-globe-markers/filtering/shouldEventBeLocked.js';

/**
 * @param {Iterable<object>|null|undefined} events
 * @param {Set<string>|null|undefined} activeFilters
 * @returns {number}
 */
export function countEventsMatchingFilters(events, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) return 0;
    const list = Array.isArray(events) ? events : [];
    let n = 0;
    for (let i = 0; i < list.length; i += 1) {
        if (!shouldEventBeLocked(list[i], activeFilters)) n += 1;
    }
    return n;
}

/**
 * Resolve the current timeline event list from the usual global services.
 * @returns {object[]}
 */
export function getTimelineEventsForFilterMatchCount() {
    if (typeof window === 'undefined') return [];
    const fromData = window.EventDataService?.events;
    if (Array.isArray(fromData)) return fromData;
    const fromManager = window.eventManager?.events;
    if (Array.isArray(fromManager)) return fromManager;
    return [];
}
