/**
 * Main-timeline load (story archive).
 *   1. Try `src/data/events.json` (source of truth) with a cache-busted 10s timeout.
 *   2. Compare with localStorage `timelineEvents`.
 *
 * Selection rules:
 *   GitHub Pages           → always prefer file when available; clear localStorage.
 *   Localhost + file > LS  → prefer file (single extra event is enough).
 *   Localhost + LS >= file → prefer localStorage (user's saved edits stay).
 *   Localhost + LS+5 < file → assume file caught up significantly, use file.
 *   File missing           → fall back to localStorage even on GitHub Pages.
 *   Both missing           → empty list + error status.
 *
 * After the chosen branch wins, `_finishMainTimelineLoadEvents` migrates legacy filter/place shapes
 * before returning the `{ events, source, shouldSync }` descriptor.
 */

import { fetchJsonWithTimeout } from './fetchWithTimeout.js';

/** @param {import('./EventDataService.js').default} dataService */
export async function loadMainTimelineEvents(dataService) {
    let fileEventCount = 0;
    let fileEvents = null;
    dataService.updateStatus('EventDataService: Starting events load process...', 'info');

    dataService.updateStatus('EventDataService: Fetching events.json file...', 'info');
    const fetchStartTime = performance.now();
    try {
        const data = await fetchJsonWithTimeout('src/data/events.json');
        const fetchTime = performance.now() - fetchStartTime;
        dataService.updateStatus(`EventDataService: events.json fetch completed (${fetchTime.toFixed(0)}ms)`, 'info');

        if (data && data.events && Array.isArray(data.events) && data.events.length > 0) {
            fileEvents = data.events;
            fileEventCount = data.events.length;
            dataService.updateStatus(`EventDataService: Found ${fileEventCount} events in events.json`, 'success');
        } else {
            console.warn('EventDataService: events.json loaded but has no events array or is empty', data);
            dataService.updateStatus('EventDataService: events.json has no events array or is empty', 'warning');
        }
    } catch (error) {
        console.error('EventDataService: ✗ CRITICAL - Could not load from src/data/events.json:', error);
        console.error('EventDataService: Error details:', {
            message: error.message,
            stack: error.stack,
            url: 'src/data/events.json'
        });
        dataService.updateStatus(`EventDataService: events.json fetch error: ${error.message}`, 'error');
        dataService.updateStatus('EventDataService: Will try localStorage if available', 'info');
    }

    dataService.updateStatus('EventDataService: Checking localStorage for saved events...', 'info');
    const localStorageStartTime = performance.now();
    const savedEvents = localStorage.getItem('timelineEvents');
    const localStorageTime = performance.now() - localStorageStartTime;
    dataService.updateStatus(`EventDataService: localStorage access completed (${localStorageTime.toFixed(0)}ms)`, 'info');

    if (savedEvents) {
        try {
            dataService.updateStatus('EventDataService: Parsing localStorage events...', 'info');
            const parseStartTime = performance.now();
            const localStorageEvents = JSON.parse(savedEvents);
            const parseTime = performance.now() - parseStartTime;
            dataService.updateStatus(`EventDataService: localStorage parsed (${parseTime.toFixed(0)}ms)`, 'info');

            const localStorageCount = localStorageEvents.length;
            dataService.updateStatus(`EventDataService: Found ${localStorageCount} events in localStorage`, 'success');

            const isGitHubPages = dataService.isGitHubPages();

            if (fileEvents && fileEventCount > 0) {
                // GitHub Pages: events.json is always source of truth (users can't edit locally).
                if (isGitHubPages) {
                    dataService.updateStatus(`EventDataService: Using events.json (${fileEventCount} events) - GitHub Pages mode`, 'info');
                    dataService.events = fileEvents;
                    localStorage.removeItem('timelineEvents');
                    dataService.saveEvents();
                    return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
                }

                // Localhost: file with even one extra event wins (file was edited elsewhere).
                if (fileEventCount > localStorageCount) {
                    dataService.updateStatus(`EventDataService: Using events.json (${fileEventCount} events, file has more than localStorage)`, 'info');
                    dataService.events = fileEvents;
                    localStorage.removeItem('timelineEvents');
                    dataService.saveEvents();
                    return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
                }

                // Localhost: localStorage ties or wins → prefer user's local edits.
                dataService.updateStatus(`EventDataService: Using localStorage (${localStorageCount} events, user's saved changes)`, 'info');
            }

            dataService.events = localStorageEvents;
            dataService.updateStatus(`EventDataService: Using ${dataService.events.length} events from localStorage`, 'success');

            if (fileEvents && fileEventCount === dataService.events.length) {
                dataService.mergeTimelineMetadataFromFileEvents(fileEvents);
            }

            // Big-divergence catch-up: file has many more entries → user is behind, sync from file.
            if (fileEvents && fileEventCount > 0) {
                if (isGitHubPages && fileEventCount > dataService.events.length) {
                    console.warn(`EventDataService [GitHub Pages]: localStorage has ${dataService.events.length} events, but events.json has ${fileEventCount}. Using events.json (source of truth).`);
                    dataService.updateStatus(`EventDataService: Updating from events.json (${fileEventCount} events, localStorage had ${dataService.events.length})`, 'warning');
                    dataService.events = fileEvents;
                    localStorage.removeItem('timelineEvents');
                    dataService.saveEvents();
                    return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
                } else if (!isGitHubPages && fileEventCount > dataService.events.length + 4) {
                    console.warn(`EventDataService [Localhost]: localStorage has ${dataService.events.length} events, but events.json has ${fileEventCount} (${fileEventCount - dataService.events.length} more). Using events.json.`);
                    dataService.updateStatus(`EventDataService: Updating from events.json (${fileEventCount} events, localStorage had ${dataService.events.length})`, 'warning');
                    dataService.events = fileEvents;
                    localStorage.removeItem('timelineEvents');
                    dataService.saveEvents();
                    return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
                }
            }

            return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'localStorage', shouldSync: true });
        } catch (error) {
            console.error('EventDataService: Error parsing saved events:', error);
            console.error('EventDataService: Raw data:', savedEvents.substring(0, 200));
            dataService.updateStatus('EventDataService: Error parsing localStorage (corrupted?), trying events.json...', 'error');
            if (fileEvents && fileEventCount > 0) {
                dataService.updateStatus(`EventDataService: Using events.json (${fileEventCount} events, localStorage was corrupted)`, 'info');
                localStorage.removeItem('timelineEvents');
                dataService.events = fileEvents;
                dataService.saveEvents();
                return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
            }
        }
    }

    // No localStorage entry: pure file path.
    if (fileEvents && fileEventCount > 0) {
        dataService.events = fileEvents;
        dataService.updateStatus(`EventDataService: Using ${dataService.events.length} events from events.json`, 'success');

        // < 50 events is suspiciously small — clear LS to force a clean reload next time.
        if (dataService.events.length < 50) {
            console.warn(`EventDataService: Event count is less than expected (${dataService.events.length} < 50). Clearing localStorage to force fresh load.`);
            localStorage.removeItem('timelineEvents');
            dataService.updateStatus(`EventDataService: Cleared localStorage (found ${dataService.events.length} events, expected at least 50)`, 'warning');
        }

        dataService.saveEvents();
        return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'file', shouldSync: true });
    }

    // Final fallback: file failed AND we still have a localStorage blob? Try it (even on GitHub Pages).
    if (savedEvents) {
        try {
            const fallbackEvents = JSON.parse(savedEvents);
            if (Array.isArray(fallbackEvents) && fallbackEvents.length > 0) {
                console.warn('EventDataService: events.json failed to load, using localStorage as fallback');
                dataService.updateStatus(`EventDataService: Using localStorage fallback (${fallbackEvents.length} events) - events.json unavailable`, 'warning');
                dataService.events = fallbackEvents;
                return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'localStorage-fallback', shouldSync: true });
            }
        } catch (e) {
            console.error('EventDataService: localStorage fallback also failed:', e);
        }
    }

    dataService.events = [];
    console.error('EventDataService: CRITICAL - No events found from events.json or localStorage!');
    dataService.updateStatus('EventDataService: ERROR - No events found. Check events.json file.', 'error');
    return dataService._finishMainTimelineLoadEvents({ events: dataService.events, source: 'none', shouldSync: true });
}
