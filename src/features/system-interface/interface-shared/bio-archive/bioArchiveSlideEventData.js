/**
 * Resolve the live archive row for the standalone event slide (avoids stale object refs after save).
 */

import { resolveStoryEventDataInList } from '../storyEventIndexResolution.js';

/**
 * @param {{ currentEventIndex?: number, allEvents?: object[], _presentationFromDockTimeline?: boolean } | null | undefined} slide
 * @param {object | null | undefined} [fallbackEventData]
 * @returns {object | null}
 */
export function resolveLiveArchiveEventDataForSlide(slide, fallbackEventData) {
    const em = typeof window !== 'undefined' ? window.eventManager : null;

    if (slide?.isEditing && slide.editTarget?.eventData) {
        return slide.editTarget.eventData;
    }
    if (slide?.currentEventData && typeof slide.currentEventData === 'object') {
        return slide.currentEventData;
    }

    if (slide?._presentationFromDockTimeline) {
        const dockList = em?.getDockTimelineEvents?.() || [];
        if (dockList.length > 0) {
            const dockRow = resolveStoryEventDataInList(slide, dockList, fallbackEventData);
            if (dockRow) return dockRow;
        }
    }

    const list = em?.events;
    if (!Array.isArray(list) || !list.length) {
        return fallbackEventData && typeof fallbackEventData === 'object' ? fallbackEventData : null;
    }

    const idx = slide?.currentEventIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < list.length && list[idx]) {
        return list[idx];
    }

    const sync = typeof window !== 'undefined' ? window.BioArchiveConnectionsSync : null;
    if (
        fallbackEventData
        && sync
        && typeof sync.resolveBioArchiveEventIndex === 'function'
    ) {
        const arch = em?.dataService?.getArchiveSource?.() || '';
        const ix = sync.resolveBioArchiveEventIndex(list, fallbackEventData, arch);
        if (ix >= 0 && list[ix]) return list[ix];
    }

    return fallbackEventData && typeof fallbackEventData === 'object' ? fallbackEventData : null;
}

/**
 * @param {{ currentEventIndex?: number } | null | undefined} slide
 * @param {object | null | undefined} [fallbackEventData]
 * @returns {number}
 */
export function resolveLiveArchiveEventIndexForSlide(slide, fallbackEventData) {
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    const list = em?.events;
    if (!Array.isArray(list) || !list.length) return -1;

    const idx = slide?.currentEventIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < list.length && list[idx]) {
        return idx;
    }

    const live = resolveLiveArchiveEventDataForSlide(slide, fallbackEventData);
    if (!live) return -1;
    const found = list.indexOf(live);
    if (found >= 0) return found;

    const sync = typeof window !== 'undefined' ? window.BioArchiveConnectionsSync : null;
    if (sync && typeof sync.resolveBioArchiveEventIndex === 'function') {
        const arch = em?.dataService?.getArchiveSource?.() || '';
        return sync.resolveBioArchiveEventIndex(list, live, arch);
    }
    return -1;
}
