/**
 * refreshBioArchivesFromCodexDiskWrite — re-pull hero / faction / NPC archives after the
 * Codex panel has written them to disk via `POST /api/codex`.
 *
 * The Codex editor lets the user edit relationships across heroes / factions / NPCs and
 * commits the result to all three `story-archive-*.json` files at once. After that disk
 * write returns, this helper refreshes each touched archive in three steps:
 *
 *   1. `fetchJsonWithTimeout(fileUrl)` — pull the new bytes back from disk.
 *   2. Normalize each event entry under the freshly-touched archive's schema (we
 *      temporarily flip `dataService.archiveSource` so `normalizeSatelliteArchiveEntry`
 *      uses the right rules, then restore).
 *   3. Write the normalized list back into the matching localStorage key.
 *
 * If the active archive happens to be one of the touched ones, we also replace
 * `dataService.events` so any open slide / manager row sees the new connections
 * immediately without forcing a reload.
 *
 * @param {any} dataService
 * @param {string[]} archivesTouched e.g. `['heroes','npcs']`
 * @returns {Promise<{ updated: string[] }>}
 */
import { archiveFilePathForSource, archiveLocalStorageKeyForSource, getArchiveSource } from './archiveRouting.js';
import { normalizeSatelliteArchiveEntry } from './normalizeBioArchives.js';
import { fetchJsonWithTimeout } from './fetchWithTimeout.js';

export async function refreshBioArchivesFromCodexDiskWrite(dataService, archivesTouched) {
    const bio = new Set(['heroes', 'factions', 'npcs']);
    const list = Array.isArray(archivesTouched) ? archivesTouched.filter((a) => bio.has(a)) : [];
    if (!list.length) return { updated: [] };

    const savedArch = getArchiveSource(dataService);
    const updated = [];

    for (let i = 0; i < list.length; i += 1) {
        const arch = list[i];
        const fileUrl = archiveFilePathForSource(arch);
        const storageKey = archiveLocalStorageKeyForSource(arch);
        try {
            const data = await fetchJsonWithTimeout(fileUrl);
            const rawEvents = Array.isArray(data.events) ? data.events : [];

            // Temporarily flip the active archive so normalization rules pick the right schema.
            dataService.archiveSource = arch;
            const normalized = rawEvents.map((e) => normalizeSatelliteArchiveEntry(e, arch));
            dataService.archiveSource = savedArch;

            try {
                localStorage.setItem(storageKey, JSON.stringify(normalized));
            } catch (lsErr) {
                console.warn('EventDataService: localStorage update after codex save failed', arch, lsErr);
            }

            updated.push(arch);

            if (savedArch === arch) {
                dataService.events = normalized;
                if (typeof dataService._normalizeSatelliteEventsInPlace === 'function') {
                    dataService._normalizeSatelliteEventsInPlace();
                }
            }
        } catch (e) {
            console.warn(`EventDataService: re-fetch ${arch} after codex save failed`, e);
        }
    }

    return { updated };
}
