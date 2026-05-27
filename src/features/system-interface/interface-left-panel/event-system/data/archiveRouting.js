/**
 * archiveRouting — path / localStorage key tables for the five archive buckets backing the
 * Event Manager list ('story' | 'heroes' | 'factions' | 'npcs' | 'locations') and the small
 * helpers that resolve them per-source.
 *
 * The Event Manager swaps buckets at runtime when the user toggles between the story
 * timeline and the satellite archives (heroes / factions / NPCs / locations); each bucket
 * has its own:
 *   - file path under `src/data/...`
 *   - localStorage key for the "edits in progress" mirror
 *
 * `setArchiveSourceOn(dataService, sourceId)` is the only mutator that touches the active
 * bucket on a live `EventDataService` instance; it also snapshots the current main-timeline
 * rows into `_storyDockEventsSnapshot` so the pagination dock can keep showing story rows
 * even after the user switches to a satellite archive.
 */

export const ARCHIVE_FILE_PATHS = {
    story: 'src/data/events.json',
    heroes: 'src/data/story-archive-heroes.json',
    factions: 'src/data/story-archive-factions.json',
    npcs: 'src/data/story-archive-npcs.json',
    locations: 'src/data/story-archive-locations.json',
};

export const ARCHIVE_LOCALSTORAGE_KEYS = {
    story: 'timelineEvents',
    heroes: 'timelineEventsArchiveHeroes',
    factions: 'timelineEventsArchiveFactions',
    npcs: 'timelineEventsArchiveNpcs',
    locations: 'timelineEventsArchiveLocations',
};

const ALLOWED_SOURCES = new Set(['story', 'heroes', 'factions', 'npcs', 'locations']);

/** @param {any} dataService */
export function isMainTimelineArchive(dataService) {
    return getArchiveSource(dataService) === 'story';
}

/** @param {any} dataService */
export function getArchiveSource(dataService) {
    return dataService.archiveSource || 'story';
}

/**
 * Atomic source swap: snapshot the main timeline before leaving, then flip
 * `archiveSource`. The dock snapshot is also nulled so a subsequent
 * `getStoryTimelineEventsForDock` re-reads from localStorage on demand.
 *
 * @param {any} dataService
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId
 */
export function setArchiveSourceOn(dataService, sourceId) {
    const next = ALLOWED_SOURCES.has(sourceId) ? sourceId : 'story';
    if (isMainTimelineArchive(dataService) && next !== 'story' && Array.isArray(dataService.events) && dataService.events.length > 0) {
        dataService._storyDockEventsSnapshot = dataService.events.slice();
    }
    dataService._storyDockEventsSnapshotFromLs = null;
    dataService.archiveSource = next;
}

/** @param {any} dataService */
export function archiveFilePathFor(dataService) {
    return ARCHIVE_FILE_PATHS[getArchiveSource(dataService)] || ARCHIVE_FILE_PATHS.story;
}

/** @param {any} dataService */
export function archiveLocalStorageKeyFor(dataService) {
    return ARCHIVE_LOCALSTORAGE_KEYS[getArchiveSource(dataService)] || ARCHIVE_LOCALSTORAGE_KEYS.story;
}

/** @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId */
export function archiveFilePathForSource(sourceId) {
    return ARCHIVE_FILE_PATHS[sourceId] || ARCHIVE_FILE_PATHS.story;
}

/** @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId */
export function archiveLocalStorageKeyForSource(sourceId) {
    return ARCHIVE_LOCALSTORAGE_KEYS[sourceId] || ARCHIVE_LOCALSTORAGE_KEYS.story;
}
