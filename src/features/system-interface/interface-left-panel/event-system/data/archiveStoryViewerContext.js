/**
 * Story Timeline viewer vs Data Workshop bio archive — disambiguates I/O and
 * archive-source restore when both embed the Event Manager in #storyViewerContainer.
 */

import { eventsPanelMountedInStoryArchive } from '../../../../data-workshop/archive-support/ArchiveEnvironmentChecks.js';
import { getStoryTimelineEventsForDock } from './storyDockSnapshot.js';
import { ARCHIVE_LOCALSTORAGE_KEYS } from './archiveRouting.js';

/** @returns {boolean} */
export function isDataWorkshopBioArchivePanel() {
    const panel = document.getElementById('eventsManagePanel');
    return !!(panel?.classList.contains('data-workshop-bio-archive'));
}

/**
 * Story Timeline mode (not Data Workshop heroes/factions/npcs tab): export/import/save
 * handoff should target the main timeline even if opening a bio slide left a satellite
 * archive active in memory.
 * @returns {boolean}
 */
export function shouldUseStoryTimelineForViewerIo() {
    if (!eventsPanelMountedInStoryArchive()) return false;
    if (isDataWorkshopBioArchivePanel()) return false;
    return true;
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @returns {unknown[]}
 */
export function getStoryTimelineEventsForViewerExport(dataService) {
    return getStoryTimelineEventsForDock(dataService);
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @param {unknown[]} events
 */
export function persistStoryTimelineToLocalStorage(dataService, events) {
    const list = Array.isArray(events) ? events : [];
    try {
        localStorage.setItem(ARCHIVE_LOCALSTORAGE_KEYS.story, JSON.stringify(list));
    } catch (err) {
        console.warn('persistStoryTimelineToLocalStorage failed', err);
    }
    dataService._storyDockEventsSnapshot = list.slice();
    dataService._storyDockEventsSnapshotFromLs = null;
}

/**
 * After closing a bio slide opened from Story Timeline, return the Event Manager list
 * to the main timeline archive (Data Workshop bio tabs keep their active archive).
 */
export async function restoreStoryArchiveSourceIfStoryViewerContext() {
    if (!shouldUseStoryTimelineForViewerIo()) return;
    const em = window.eventManager;
    const ds = em?.dataService;
    if (!ds || ds.getArchiveSource?.() === 'story') return;
    try {
        if (em?.switchStoryArchiveSource) {
            await em.switchStoryArchiveSource('story');
        } else {
            ds.setArchiveSource('story');
            await em?.loadEvents?.();
        }
        em?.renderEvents?.();
    } catch (err) {
        console.warn('restoreStoryArchiveSourceIfStoryViewerContext failed', err);
    }
}
