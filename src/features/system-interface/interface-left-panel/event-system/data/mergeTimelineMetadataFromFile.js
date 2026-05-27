/**
 * mergeTimelineMetadataFromFileEvents — patch up local events that are missing era/year fields
 * by copying them from a fresh `events.json` snapshot.
 *
 * When localStorage is the preferred source (`loadMainTimelineEvents`), we still fetch
 * `events.json` and pass it to this helper. For each event in the local list, any missing
 * `eraName`, `yearStart`, or `yearEnd` value is filled in from the matching positional
 * entry in the file. This recovers from stale localStorage after editing
 * `src/data/events.json` by hand on disk.
 *
 * If any field was merged we call `saveEvents()` so the patched data sticks. Returns true
 * when at least one event was touched.
 *
 * Skipped entirely when the active archive isn't story.
 */

import { isMainTimelineArchive } from './archiveRouting.js';

/**
 * @param {any} dataService
 * @param {Array<Object>} fileEvents Parsed events from events.json.
 * @returns {boolean}
 */
export function mergeTimelineMetadataFromFileEvents(dataService, fileEvents) {
    if (!isMainTimelineArchive(dataService)) return false;
    if (!fileEvents || !Array.isArray(dataService.events) || dataService.events.length !== fileEvents.length) {
        return false;
    }
    let changed = false;
    for (let i = 0; i < dataService.events.length; i++) {
        const local = dataService.events[i];
        const file = fileEvents[i];
        if (!local || !file) continue;

        const eraF = file.eraName;
        if (eraF != null && String(eraF).trim() !== '') {
            if (local.eraName == null || local.eraName === '') {
                local.eraName = eraF;
                changed = true;
            }
        }
        for (const key of ['yearStart', 'yearEnd']) {
            const fv = file[key];
            if (fv != null && fv !== '' && !Number.isNaN(Number(fv))) {
                if (local[key] == null || local[key] === '') {
                    const n = Number(fv);
                    local[key] = Number.isInteger(n) ? n : Math.trunc(n);
                    changed = true;
                }
            }
        }
    }
    if (changed) {
        dataService.updateStatus?.('EventDataService: Synced era & year fields from events.json', 'success');
        dataService.saveEvents();
    }
    return changed;
}
