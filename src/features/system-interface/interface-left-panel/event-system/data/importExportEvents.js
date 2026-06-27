/**
 * importExportEvents — JSON `{ events: [...] }` round-trips for the active archive.
 *
 * Story Timeline viewer: export/import always targets the main timeline (from the dock
 * snapshot + `timelineEvents` localStorage), even when a hero/NPC/faction slide left a
 * satellite archive active in memory. Data Workshop bio tabs export the active bio archive.
 */

import { isMainTimelineArchive } from './archiveRouting.js';
import {
    getStoryTimelineEventsForViewerExport,
    persistStoryTimelineToLocalStorage,
    shouldUseStoryTimelineForViewerIo,
} from './archiveStoryViewerContext.js';
import { buildStoryEventsMergePlan } from './mergeStoryEvents.js';
import { openStoryEventsMergeModal } from './StoryEventsMergeModal.js';

/**
 * @param {import('./EventDataService.js').default} dataService
 * @param {'story'|'heroes'|'factions'|'npcs'|'locations'|string} sourceId
 * @returns {string}
 */
function exportFilenameForSourceId(sourceId) {
    const safe = String(sourceId || 'events')
        .replace(/[^a-z0-9_-]+/gi, '-')
        .replace(/^-+|-+$/g, '') || 'events';
    return `${safe}-export.json`;
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @returns {{ events: unknown[], sourceId: string }}
 */
function resolveExportPayload(dataService) {
    if (shouldUseStoryTimelineForViewerIo()) {
        const events = getStoryTimelineEventsForViewerExport(dataService);
        return { events: Array.isArray(events) ? events : [], sourceId: 'story' };
    }
    return {
        events: Array.isArray(dataService.events) ? dataService.events : [],
        sourceId: dataService.getArchiveSource?.() || 'story',
    };
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @param {unknown[]} events
 */
async function applyImportedEvents(dataService, events) {
    const list = Array.isArray(events) ? events : [];

    if (shouldUseStoryTimelineForViewerIo()) {
        persistStoryTimelineToLocalStorage(dataService, list);
        const em = window.eventManager;

        if (!isMainTimelineArchive(dataService)) {
            if (em?.switchStoryArchiveSource) {
                await em.switchStoryArchiveSource('story');
            } else {
                dataService.setArchiveSource('story');
                dataService.events = list;
                await em?.loadEvents?.();
            }
        } else {
            dataService.events = list;
        }

        dataService.saveEvents();
        em?.renderEvents?.();
        dataService.updateStatus?.(`Imported ${list.length} story timeline events`, 'success');
        return;
    }

    dataService.events = list;
    if (!isMainTimelineArchive(dataService) && typeof dataService._normalizeSatelliteEventsInPlace === 'function') {
        dataService._normalizeSatelliteEventsInPlace();
    }
    dataService.saveEvents();
    const arch = dataService.getArchiveSource?.() || 'archive';
    dataService.updateStatus?.(`Imported ${list.length} ${arch} entries`, 'success');
}

export function exportEvents(dataService) {
    const { events, sourceId } = resolveExportPayload(dataService);
    const dataStr = JSON.stringify({ events }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilenameForSourceId(sourceId);
    link.click();
    URL.revokeObjectURL(url);

    const label = sourceId === 'story' ? 'story timeline' : `${sourceId} archive`;
    dataService.updateStatus?.(`Exported ${events.length} ${label} events (${link.download})`, 'success');
}

export function importEvents(dataService, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.events || !Array.isArray(data.events)) {
                    throw new Error('Invalid file format: expected { events: [...] }');
                }
                await applyImportedEvents(dataService, data.events);
                resolve({ success: true, count: data.events.length });
            } catch (error) {
                console.error('EventDataService: Error importing events:', error);
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @param {File} file
 */
export async function mergeEventsFromFile(dataService, file) {
    const text = await file.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('Selected file is not valid JSON');
    }
    if (!parsed?.events || !Array.isArray(parsed.events)) {
        throw new Error('Invalid file format: expected { events: [...] }');
    }

    const { events: baseEvents } = resolveExportPayload(dataService);
    const plan = buildStoryEventsMergePlan(baseEvents, parsed.events);

    if (!plan.hasDifferences) {
        dataService.updateStatus?.(
            'Merge skipped — current data and selected file have no differences',
            'info',
        );
        return { success: false, reason: 'identical', count: baseEvents.length };
    }

    const merged = await openStoryEventsMergeModal(plan);
    if (!merged) {
        return { success: false, reason: 'cancelled' };
    }

    await applyImportedEvents(dataService, merged);
    return { success: true, count: merged.length };
}
