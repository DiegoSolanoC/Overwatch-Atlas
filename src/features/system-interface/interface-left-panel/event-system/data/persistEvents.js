/**
 * Persist events for the active archive:
 *   1. (Satellites only) bio-archive connection mirrors are repaired, then events normalized.
 *   2. (Story only)     legacy filter/place shapes are migrated to the grouped form pre-save.
 *   3. Always           write `localStorage[<archive key>] = JSON.stringify(events)`.
 *   4. (Story only)     refresh the dock snapshot.
 *   5. (Bio only)       dispatch `atlas-bio-archives-refreshed` (faction-archive filter ordering).
 *   6. (Bio only)       async kick of CodexCanvasService edge sync (debounced 400ms).
 *   7. Dev server only  POST to `/api/events` or `/api/story-archive`. GH-Pages / file:// skip.
 *
 * `persistStoryDockTimelineFromSnapshot` writes the story timeline from the dock snapshot when the
 * user is currently editing a satellite archive — keeps `timelineEvents` (+ events.json) fresh
 * without making the satellite save itself touch the story bucket.
 */

import { migrateAllStoryEventsFilterPlaces } from './eventFilterPlacesMigration.js';

/** @param {import('./EventDataService.js').default} dataService */
export function persistEvents(dataService) {
    if (!dataService._isMainTimelineArchive()) {
        const arch = dataService.getArchiveSource();
        if (
            (arch === 'heroes' || arch === 'factions' || arch === 'npcs') &&
            typeof window !== 'undefined' &&
            window.BioArchiveConnectionsSync?.repairMissingMirrorsForBioArchive
        ) {
            window.BioArchiveConnectionsSync.repairMissingMirrorsForBioArchive(dataService.events, arch);
        }
        dataService._normalizeSatelliteEventsInPlace();
    }
    if (dataService._isMainTimelineArchive() && Array.isArray(dataService.events)) {
        try {
            migrateAllStoryEventsFilterPlaces(dataService.events);
        } catch (e) {
            console.warn('EventDataService: pre-save grouped filter migration failed:', e);
        }
    }
    const storageKey = dataService._getArchiveLocalStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(dataService.events));
    if (dataService._isMainTimelineArchive()) {
        dataService.refreshStoryDockSnapshotFromCurrentEvents();
    }

    const archForFilterOrder = dataService.getArchiveSource();
    if (
        typeof window !== 'undefined' &&
        !dataService._isMainTimelineArchive() &&
        (archForFilterOrder === 'heroes' || archForFilterOrder === 'factions' || archForFilterOrder === 'npcs')
    ) {
        const orderNames = (dataService.events || [])
            .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
            .filter(Boolean);
        window.dispatchEvent(
            new CustomEvent('atlas-bio-archives-refreshed', {
                detail: { archives: [archForFilterOrder], orderNames }
            })
        );
    }

    if (!dataService._isMainTimelineArchive()) {
        const archAfter = dataService.getArchiveSource();
        if (
            (archAfter === 'heroes' || archAfter === 'factions' || archAfter === 'npcs')
            && typeof window !== 'undefined'
        ) {
            setTimeout(() => {
                try {
                    const fn = window.CodexCanvasService?.syncCodexEdgesFromBioArchiveConnections;
                    if (typeof fn === 'function') void fn();
                } catch (e) {
                    console.warn('EventDataService: Codex bio-edge sync skipped', e);
                }
            }, 400);
        }
    }

    if (!dataService._canPersistTimelineJsonToRepo()) {
        return;
    }

    // Dev server: also persist to src/data/*.json via Node server.
    try {
        const isMain = dataService._isMainTimelineArchive();
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl(isMain ? 'api/events' : 'api/story-archive')
                : isMain
                    ? '/api/events'
                    : '/api/story-archive';
        const body = isMain
            ? JSON.stringify({ events: dataService.events })
            : JSON.stringify({ archive: dataService.getArchiveSource(), events: dataService.events });

        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then((data) => {
                if (isMain) {
                    dataService.updateStatus(
                        `✓ Saved timeline (${data?.eventsCount ?? dataService.events.length} events)`,
                        'success'
                    );
                } else {
                    const label = dataService._getArchiveFilePath().replace(/^src\/data\//, '');
                    dataService.updateStatus(
                        `✓ Saved to src/data/${label} (${data?.eventsCount ?? dataService.events.length} entries)`,
                        'success'
                    );
                }
            })
            .catch((e) => {
                const target = isMain ? dataService._getArchiveFilePath() : dataService._getArchiveFilePath();
                console.warn(`EventDataService: Failed to persist ${target} via dev API:`, e);
                dataService.updateStatus(
                    `Saved locally, but failed to write ${target} (${e?.message || 'API error'}). ` +
                        `Use the project server on port 8000 (node src/server.js), or restart it after pulling new routes.`,
                    'warning'
                );
            });
    } catch (e) {
        // Ignore API persistence errors; localStorage is still updated.
    }
}

/** @param {import('./EventDataService.js').default} dataService */
export function persistStoryDockTimelineFromSnapshot(dataService) {
    if (dataService._isMainTimelineArchive()) return;
    const dock = dataService.getStoryTimelineEventsForDock();
    if (!Array.isArray(dock) || dock.length === 0) return;
    try {
        migrateAllStoryEventsFilterPlaces(dock);
    } catch (e) {
        console.warn('EventDataService: dock snapshot grouped migration skipped:', e);
    }
    try {
        localStorage.setItem('timelineEvents', JSON.stringify(dock));
    } catch (e) {
        console.warn('EventDataService: failed to write timelineEvents from dock snapshot', e);
    }
    if (!dataService._canPersistTimelineJsonToRepo()) return;
    try {
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/events')
                : '/api/events';
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: dock })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then((data) => {
                dataService.updateStatus(
                    `✓ Saved story timeline from dock (${data?.eventsCount ?? dock.length} events)`,
                    'success'
                );
            })
            .catch((e) => {
                console.warn('EventDataService: Failed to persist dock timeline via dev API', e);
            });
    } catch (e) {
        /* ignore */
    }
}
