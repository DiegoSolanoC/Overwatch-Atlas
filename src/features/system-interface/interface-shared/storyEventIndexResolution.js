/**
 * Resolve which story-timeline row is open in the event slide.
 * Prefer object identity and slide position — never guess by name when duplicates exist.
 */

/**
 * @param {{ currentEventIndex?: number, allEvents?: object[], _presentationFromDockTimeline?: boolean } | null | undefined} slide
 * @param {object[]} storyList Canonical story timeline array (dock / em.events).
 * @param {object | null | undefined} eventData Fallback row reference from the slide.
 * @returns {number}
 */
export function resolveStoryEventIndexInList(slide, storyList, eventData) {
    if (!Array.isArray(storyList) || storyList.length === 0) return -1;

    if (slide && Array.isArray(slide.allEvents) && typeof slide.currentEventIndex === 'number') {
        const presIdx = slide.currentEventIndex;
        const presEv = slide.allEvents[presIdx];
        if (presEv) {
            const inStory = storyList.indexOf(presEv);
            if (inStory >= 0) return inStory;
        }
    }

    if (eventData) {
        const byRef = storyList.indexOf(eventData);
        if (byRef >= 0) return byRef;
    }

    if (!eventData?.name) return -1;
    const want = String(eventData.name).trim().toLowerCase();
    if (!want) return -1;

    const matches = [];
    for (let i = 0; i < storyList.length; i += 1) {
        const row = storyList[i];
        if (row && String(row.name || '').trim().toLowerCase() === want) {
            matches.push(i);
        }
    }
    if (matches.length === 1) return matches[0];
    return -1;
}

/**
 * @param {{ currentEventIndex?: number, allEvents?: object[], _presentationFromDockTimeline?: boolean } | null | undefined} slide
 * @param {object[]} storyList
 * @param {object | null | undefined} eventData
 * @returns {object | null}
 */
export function resolveStoryEventDataInList(slide, storyList, eventData) {
    const idx = resolveStoryEventIndexInList(slide, storyList, eventData);
    if (idx >= 0 && storyList[idx]) return storyList[idx];
    if (eventData && typeof eventData === 'object') return eventData;
    return null;
}

/**
 * @param {object[]} storyList
 * @param {number} fromIndex
 * @param {number} toIndex User-facing 0-based target slot (before splice-out adjustment).
 * @returns {boolean}
 */
export function reorderStoryTimelineInPlace(storyList, fromIndex, toIndex) {
    if (!Array.isArray(storyList)) return false;
    if (fromIndex < 0 || fromIndex >= storyList.length) return false;
    if (toIndex < 0 || toIndex > storyList.length) return false;
    if (fromIndex === toIndex) return false;

    const [moved] = storyList.splice(fromIndex, 1);
    let insertAt = toIndex;
    if (fromIndex < toIndex) insertAt = toIndex - 1;
    if (insertAt < 0) insertAt = 0;
    if (insertAt > storyList.length) insertAt = storyList.length;
    storyList.splice(insertAt, 0, moved);
    return true;
}
