/**
 * Keep standalone event slide indices aligned with the row being shown.
 * Desktop list/marker opens used to skip this, so Save targeted a stale index
 * and could overwrite or replace the wrong timeline event (e.g. the last row).
 */

import { resolveStoryEventIndexInList } from './storyEventIndexResolution.js';

/**
 * @param {{ currentEventIndex?: number, currentEventData?: object | null, allEvents?: object[], _presentationFromDockTimeline?: boolean } | null | undefined} slide
 * @param {object} eventData
 * @param {number} [globalIndex]
 * @param {{ eventList?: object[] | null }} [options]
 * @returns {number} Resolved 0-based index, or -1.
 */
export function syncStandaloneSlideEventContext(slide, eventData, globalIndex, options = {}) {
    if (!slide || !eventData) return -1;

    const em = typeof window !== 'undefined' ? window.eventManager : null;
    const dockList = em?.getDockTimelineEvents?.() || [];
    const list =
        options.eventList != null && Array.isArray(options.eventList)
            ? options.eventList
            : dockList;

    let index = Number.isFinite(globalIndex) ? globalIndex : -1;
    if (index < 0 || index >= list.length || list[index] !== eventData) {
        index = list.indexOf(eventData);
    }
    if (index < 0 && em?.events && options.eventList != null) {
        index = em.events.indexOf(eventData);
    }
    if (index < 0) {
        index = resolveStoryEventIndexInList(slide, dockList, eventData);
    }

    if (index >= 0) {
        slide.currentEventIndex = index;
    }
    slide.currentEventData = eventData;
    slide.allEvents = list;
    slide._presentationFromDockTimeline =
        options.eventList == null || list === dockList;
    return index;
}
