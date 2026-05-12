/**
 * importExportEvents — JSON `{ events: [...] }` round-trips for the active archive.
 *
 *   - `exportEvents` serializes `dataService.events` and triggers a browser download
 *     (`events-export.json`).
 *
 *   - `importEvents(file)` reads a user-selected `File` (via `FileReader`), validates it
 *     has an `events` array, replaces `dataService.events`, normalizes if we're on a
 *     satellite archive, and persists. Returns a promise resolving to
 *     `{ success: true, count }` on success or rejecting with the parser error otherwise.
 *
 * Both helpers operate on whatever the active archive is at call-time — the saved file
 * therefore reflects the current bucket the user is viewing, and an imported file
 * overwrites that same bucket.
 */

import { isMainTimelineArchive } from './archiveRouting.js';

export function exportEvents(dataService) {
    const dataStr = JSON.stringify({ events: dataService.events }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'events-export.json';
    link.click();
    URL.revokeObjectURL(url);
}

export function importEvents(dataService, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.events && Array.isArray(data.events)) {
                    dataService.events = data.events;
                    if (!isMainTimelineArchive(dataService) && typeof dataService._normalizeSatelliteEventsInPlace === 'function') {
                        dataService._normalizeSatelliteEventsInPlace();
                    }
                    dataService.saveEvents();
                    resolve({ success: true, count: dataService.events.length });
                } else {
                    throw new Error('Invalid file format: expected { events: [...] }');
                }
            } catch (error) {
                console.error('EventDataService: Error importing events:', error);
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
