/**
 * Satellite archive load (heroes / factions / npcs / locations):
 *   one JSON file + one localStorage key per archive, no merge rules with the main timeline.
 *
 * Source-of-truth order:
 *   GitHub Pages           → always file (clear localStorage if file is empty)
 *   Local without dev API  → prefer non-empty localStorage (edits would otherwise be lost)
 *   Local with dev API     → prefer file, fall back to localStorage, finally empty + warn
 *
 * Returned descriptor (`source`) is logged by callers; `shouldSync` is always false because
 * satellite archives don't drive the globe markers/dock.
 */

import { fetchJsonWithTimeout } from './fetchWithTimeout.js';

/** @param {import('./EventDataService.js').default} dataService */
function pruneSatellitePhantomConnectionsInPlace(dataService) {
    const arch = dataService.getArchiveSource();
    if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;
    if (typeof window === 'undefined') return;
    window.BioArchiveConnectionsSync?.pruneJunctionPhantomConnectionsInPlace?.(
        dataService.events,
        arch,
    );
}

/** @param {import('./EventDataService.js').default} dataService */
export async function loadSatelliteArchive(dataService) {
    const fileUrl = dataService._getArchiveFilePath();
    const storageKey = dataService._getArchiveLocalStorageKey();
    const label = fileUrl.replace(/^data\//, '');
    dataService.updateStatus(`EventDataService: Loading ${dataService.getArchiveSource()} archive (${label})...`, 'info');

    let fileEvents = null;
    const fetchStartTime = performance.now();
    try {
        const data = await fetchJsonWithTimeout(fileUrl);
        const fetchTime = performance.now() - fetchStartTime;
        if (data && Array.isArray(data.events)) {
            fileEvents = data.events;
            dataService.updateStatus(
                `EventDataService: ${label} loaded (${fetchTime.toFixed(0)}ms, ${fileEvents.length} events)`,
                'success'
            );
        } else {
            dataService.updateStatus(`EventDataService: ${label} has no { events: [] } — using empty list`, 'warning');
            fileEvents = [];
        }
    } catch (error) {
        console.warn(`EventDataService: ${label} fetch failed:`, error);
        dataService.updateStatus(`EventDataService: ${label} fetch error — ${error.message}`, 'warning');
    }

    const savedEvents = localStorage.getItem(storageKey);
    const isGitHubPages = dataService.isGitHubPages();

    if (isGitHubPages) {
        dataService.events = Array.isArray(fileEvents) ? fileEvents : [];
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        if (dataService.events.length === 0) {
            try {
                localStorage.removeItem(storageKey);
            } catch (_) { /* ignore */ }
        } else {
            dataService.saveEvents();
        }
        return { events: dataService.events, source: 'file', shouldSync: false };
    }

    // Local http(s): without repo write API (e.g. Live Server on :5500), prefer localStorage so edits survive reload.
    let parsedLocal = null;
    if (savedEvents) {
        try {
            parsedLocal = JSON.parse(savedEvents);
        } catch (_) {
            parsedLocal = null;
        }
    }
    const localOk = Array.isArray(parsedLocal) && parsedLocal.length > 0;
    const localHasConnections =
        localOk &&
        parsedLocal.some((e) => Array.isArray(e?.connections) && e.connections.length > 0);
    if (localOk && !dataService._canPersistTimelineJsonToRepo()) {
        if (!localHasConnections && Array.isArray(fileEvents) && fileEvents.length > 0) {
            dataService.events = fileEvents;
            dataService._normalizeSatelliteEventsInPlace();
            pruneSatellitePhantomConnectionsInPlace(dataService);
            dataService.updateStatus(
                `EventDataService: localStorage ${dataService.getArchiveSource()} had no connections — loaded bundled file`,
                'info'
            );
            return { events: dataService.events, source: 'file', shouldSync: false };
        }
        dataService.events = parsedLocal;
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        dataService.updateStatus(
            `EventDataService: Using localStorage for ${dataService.getArchiveSource()} (dev file API not on this port — edits kept locally)`,
            'info'
        );
        return { events: dataService.events, source: 'localStorage', shouldSync: false };
    }

    if (Array.isArray(fileEvents)) {
        dataService.events = fileEvents;
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        dataService.saveEvents();
        return { events: dataService.events, source: 'file', shouldSync: false };
    }

    if (savedEvents) {
        try {
            const parsed = JSON.parse(savedEvents);
            dataService.events = Array.isArray(parsed) ? parsed : [];
            dataService._normalizeSatelliteEventsInPlace();
            pruneSatellitePhantomConnectionsInPlace(dataService);
            dataService.updateStatus(
                `EventDataService: Using localStorage for ${dataService.getArchiveSource()} (${dataService.events.length} events)`,
                'info'
            );
            return { events: dataService.events, source: 'localStorage', shouldSync: false };
        } catch (e) {
            console.error('EventDataService: satellite localStorage parse failed', e);
        }
    }

    dataService.events = [];
    dataService._normalizeSatelliteEventsInPlace();
    dataService.updateStatus(`EventDataService: No data for ${dataService.getArchiveSource()} archive`, 'warning');
    return { events: dataService.events, source: 'none', shouldSync: false };
}
