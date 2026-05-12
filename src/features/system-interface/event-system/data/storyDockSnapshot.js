/**
 * storyDockSnapshot — backs the pagination dock at the bottom of the screen.
 *
 * The dock always shows story-timeline thumbnails, even when the Event Manager is currently
 * displaying a satellite archive (heroes / factions / npcs / locations). When the user
 * leaves story for a satellite, `archiveRouting.setArchiveSourceOn` captures the current
 * main-timeline list into `dataService._storyDockEventsSnapshot`; this module reads it.
 *
 * If no in-memory snapshot exists yet (cold start on a satellite), we parse the
 * `timelineEvents` key out of localStorage once and cache it on
 * `_storyDockEventsSnapshotFromLs` so the dock has a stable array reference to render.
 *
 * After any main-timeline save the snapshot is refreshed in place via
 * `refreshStoryDockSnapshotFromCurrentEvents`.
 */

import { isMainTimelineArchive } from './archiveRouting.js';

/** @param {any} dataService */
export function getStoryTimelineEventsForDock(dataService) {
    if (isMainTimelineArchive(dataService)) {
        return Array.isArray(dataService.events) ? dataService.events : [];
    }
    if (Array.isArray(dataService._storyDockEventsSnapshot) && dataService._storyDockEventsSnapshot.length > 0) {
        return dataService._storyDockEventsSnapshot;
    }
    if (!dataService._storyDockEventsSnapshotFromLs) {
        try {
            const raw = localStorage.getItem('timelineEvents');
            if (raw) {
                const parsed = JSON.parse(raw);
                dataService._storyDockEventsSnapshotFromLs = Array.isArray(parsed) ? parsed : [];
            } else {
                dataService._storyDockEventsSnapshotFromLs = [];
            }
        } catch (_) {
            dataService._storyDockEventsSnapshotFromLs = [];
        }
    }
    return dataService._storyDockEventsSnapshotFromLs;
}

/** Re-capture the snapshot after a main-timeline save. No-op on satellite archives. */
export function refreshStoryDockSnapshotFromCurrentEvents(dataService) {
    if (!isMainTimelineArchive(dataService)) return;
    dataService._storyDockEventsSnapshot = Array.isArray(dataService.events) ? dataService.events.slice() : [];
    dataService._storyDockEventsSnapshotFromLs = null;
}
