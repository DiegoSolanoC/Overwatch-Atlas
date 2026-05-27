/**
 * archiveRouting — path / localStorage key tables for the five archive buckets backing the
 * Event Manager list ('story' | 'heroes' | 'factions' | 'npcs' | 'locations') and the small
 * helpers that resolve them per-source.
 *
 * File paths: `src/data/registry.js` (feature folders under src/data/).
 */

import {
    ARCHIVE_FILE_PATHS as REGISTRY_ARCHIVE_PATHS,
} from '../../../../../data/registry.js';

export const ARCHIVE_FILE_PATHS = REGISTRY_ARCHIVE_PATHS;

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
