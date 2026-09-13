/**
 * Load a satellite archive list for slide peeks without calling
 * `switchStoryArchiveSource` (keeps story/timeline Event Manager state intact).
 */

import {
    archiveFilePathForSource,
    archiveLocalStorageKeyForSource,
} from '../../event-system/data/archiveRouting.js';

/**
 * @param {'heroes'|'factions'|'npcs'|'locations'} archiveKey
 * @returns {Promise<object[]>}
 */
export async function loadArchiveEventsForPeek(archiveKey) {
    const lsKey = archiveLocalStorageKeyForSource(archiveKey);
    try {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        /* fall through to file */
    }

    const path = archiveFilePathForSource(archiveKey);
    try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) return [];
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.events)) return data.events;
    } catch (err) {
        console.warn('loadArchiveEventsForPeek failed', { archiveKey, err });
    }
    return [];
}
