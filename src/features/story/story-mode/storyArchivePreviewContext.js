/**
 * Shared story-archive preview context checks (no UI imports — safe for render layer).
 */

const STORY_VIEW_MODE_KEY = 'storyViewDisplayMode';

/** @returns {boolean} */
export function isStoryArchiveEmbeddedPanel() {
    const panel = document.getElementById('eventsManagePanel');
    return !!panel?.classList.contains('story-viewer-panel-embedded')
        && window.eventManager?.dataService?.getArchiveSource?.() === 'story';
}

/** @returns {'list'|'timeline'} */
export function getStoryArchiveViewModePreference() {
    try {
        if (localStorage.getItem(STORY_VIEW_MODE_KEY) === 'list') return 'list';
    } catch (_) { /* ignore */ }
    return 'timeline';
}

/** Skip building the hidden list grid while story timeline mode is active/default. */
export function shouldSkipStoryArchiveListRender() {
    if (window.eventManager?.dataService?.getArchiveSource?.() !== 'story') return false;

    const panel = document.getElementById('eventsManagePanel');
    if (!panel?.classList.contains('story-viewer-panel-embedded')) return false;
    if (panel.classList.contains('story-viewer-panel-embedded--list-view')) return false;
    if (panel.classList.contains('story-viewer-panel-embedded--timeline-view')) return true;

    return getStoryArchiveViewModePreference() === 'timeline';
}

/**
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isPlaceholderEarthCoordinate(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon)
        && Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6;
}

/** Story archive cards are read-only previews — skip Nominatim enhance storms. */
export function shouldSkipAsyncLocationEnhance() {
    return isStoryArchiveEmbeddedPanel();
}
