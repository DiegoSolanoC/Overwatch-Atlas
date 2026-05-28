/**
 * Satellite archive load (heroes / factions / npcs / locations):
 *   one JSON file + one localStorage key per archive, no merge rules with the main timeline.
 *
 * Source-of-truth order:
 *   GitHub Pages           → always file (clear localStorage if file is empty)
 *   Local (any port)       → prefer non-empty localStorage so slide edits survive reload
 *   Dev server (:8000)     → fall back to bundled JSON only when localStorage is empty, then seed LS
 *
 * Returned descriptor (`source`) is logged by callers; `shouldSync` is always false because
 * satellite archives don't drive the globe markers/dock.
 */

import { fetchJsonWithTimeout } from './fetchWithTimeout.js';
import { readNpcCategoryFieldsFromArchiveRow } from '../../../../data-workshop/archive-category-npcs/ArchiveNpcOrdering.js';

/** Manifest / filter PNG spellings for rows saved under legacy names. */
const NPC_ARCHIVE_NAME_CANON = Object.freeze({
    gerard: 'Gérard',
    sojiro: 'Sojiro',
});

/**
 * @param {unknown[]} events
 * @returns {unknown[]}
 */
function canonicalizeNpcArchiveEventNames(events) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    return events.map((e) => {
        if (!e || typeof e !== 'object') return e;
        const name = String(e.name != null ? e.name : '').trim();
        const canon = NPC_ARCHIVE_NAME_CANON[name.toLowerCase()];
        if (!canon || canon === name) return e;
        if (Array.isArray(e.variants) && e.variants.length > 0) {
            const vars = e.variants.map((v, idx) => (idx === 0 ? { ...v, name: canon } : v));
            return { ...e, name: canon, variants: vars };
        }
        return { ...e, name: canon };
    });
}

/**
 * Append bundled rows missing from localStorage (filter chips with no archive row).
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
function mergeMissingSatelliteEventsFromBundledFile(events, fileEvents) {
    if (!Array.isArray(events)) return [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    const names = new Set();
    for (let i = 0; i < events.length; i++) {
        const n = String(events[i]?.name != null ? events[i].name : '').trim().toLowerCase();
        if (n) names.add(n);
    }

    const out = events.slice();
    for (let i = 0; i < fileEvents.length; i++) {
        const fe = fileEvents[i];
        if (!fe || typeof fe !== 'object') continue;
        const n = String(fe.name != null ? fe.name : '').trim().toLowerCase();
        if (!n || names.has(n)) continue;
        names.add(n);
        out.push(fe);
    }
    return out;
}

/**
 * Stale NPC localStorage rows often lack `npcCategory`; merge from bundled file before normalize.
 * @param {unknown[]} events
 * @param {unknown[]|null} fileEvents
 * @returns {unknown[]}
 */
function mergeNpcCategoriesFromBundledFile(events, fileEvents) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    if (!Array.isArray(fileEvents) || fileEvents.length === 0) return events;

    const byName = new Map();
    for (let i = 0; i < fileEvents.length; i++) {
        const fe = fileEvents[i];
        if (!fe || typeof fe !== 'object') continue;
        const n = String(fe.name != null ? fe.name : '').trim().toLowerCase();
        if (n) byName.set(n, fe);
    }

    return events.map((e) => {
        if (!e || typeof e !== 'object') return e;
        const { name, npcCategory: existing } = readNpcCategoryFieldsFromArchiveRow(e);
        if (existing) return e;

        const fromFile = name ? byName.get(name.toLowerCase()) : null;
        const merged = fromFile ? readNpcCategoryFieldsFromArchiveRow(fromFile).npcCategory : '';
        if (!merged) return e;

        if (Array.isArray(e.variants) && e.variants.length > 0) {
            const vars = e.variants.map((v, idx) =>
                idx === 0 ? { ...v, npcCategory: v?.npcCategory || merged } : v,
            );
            return { ...e, npcCategory: merged, variants: vars };
        }
        return { ...e, npcCategory: merged };
    });
}

/**
 * Drop duplicate rows that share the same `name` (keeps first occurrence).
 * Fixes stale localStorage copies that accumulated extra rows (e.g. duplicate Lanet).
 * @param {unknown[]} events
 * @returns {unknown[]}
 */
function dedupeSatelliteEventsByName(events) {
    if (!Array.isArray(events) || events.length === 0) return events || [];
    const seen = new Set();
    const out = [];
    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (!e || typeof e !== 'object') continue;
        const name = String(e.name != null ? e.name : '').trim().toLowerCase();
        if (!name) {
            out.push(e);
            continue;
        }
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(e);
    }
    return out;
}

/** @param {import('./EventDataService.js').default} dataService @param {unknown[]|null} fileEvents */
function applyNpcBundledFileMergeBeforeNormalize(dataService, fileEvents) {
    if (dataService.getArchiveSource() !== 'npcs') return;
    dataService.events = canonicalizeNpcArchiveEventNames(dataService.events);
    dataService.events = mergeMissingSatelliteEventsFromBundledFile(dataService.events, fileEvents);
    dataService.events = mergeNpcCategoriesFromBundledFile(dataService.events, fileEvents);
}

/**
 * @param {import('./EventDataService.js').default} dataService
 * @param {unknown[]|null} fileEvents
 * @returns {number} duplicate rows removed
 */
function prepareSatelliteEventsBeforeNormalize(dataService, fileEvents) {
    if (!Array.isArray(dataService.events)) {
        dataService.events = [];
        return 0;
    }
    const before = dataService.events.length;
    dataService.events = dedupeSatelliteEventsByName(dataService.events);
    const removed = before - dataService.events.length;

    let added = 0;
    if (dataService.getArchiveSource() === 'npcs') {
        const beforeBundledMerge = dataService.events.length;
        applyNpcBundledFileMergeBeforeNormalize(dataService, fileEvents);
        added = dataService.events.length - beforeBundledMerge;
    }

    if (typeof dataService.updateStatus === 'function') {
        if (removed > 0) {
            dataService.updateStatus(
                `EventDataService: removed ${removed} duplicate ${dataService.getArchiveSource()} row(s) by name`,
                'info',
            );
        }
        if (added > 0) {
            dataService.updateStatus(
                `EventDataService: added ${added} missing ${dataService.getArchiveSource()} row(s) from bundled file`,
                'info',
            );
        }
    }
    return removed + added;
}

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
        const removedDupes = prepareSatelliteEventsBeforeNormalize(dataService, fileEvents);
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        if (removedDupes > 0) dataService.saveEvents();
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

    if (localOk) {
        if (
            !dataService._canPersistTimelineJsonToRepo()
            && !localHasConnections
            && Array.isArray(fileEvents)
            && fileEvents.length > 0
        ) {
            dataService.events = fileEvents;
            const removedDupes = prepareSatelliteEventsBeforeNormalize(dataService, fileEvents);
            dataService._normalizeSatelliteEventsInPlace();
            pruneSatellitePhantomConnectionsInPlace(dataService);
            if (removedDupes > 0) dataService.saveEvents();
            dataService.updateStatus(
                `EventDataService: localStorage ${dataService.getArchiveSource()} had no connections — loaded bundled file`,
                'info'
            );
            return { events: dataService.events, source: 'file', shouldSync: false };
        }

        dataService.events = parsedLocal;
        const removedDupes = prepareSatelliteEventsBeforeNormalize(dataService, fileEvents);
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        if (removedDupes > 0) dataService.saveEvents();
        const portNote = dataService._canPersistTimelineJsonToRepo()
            ? ' (also written to src/data on Save when the dev API succeeds)'
            : ' (dev file API not on this port)';
        dataService.updateStatus(
            `EventDataService: Using localStorage for ${dataService.getArchiveSource()}${portNote}`,
            'info'
        );
        return { events: dataService.events, source: 'localStorage', shouldSync: false };
    }

    if (Array.isArray(fileEvents)) {
        dataService.events = fileEvents;
        const removedDupes = prepareSatelliteEventsBeforeNormalize(dataService, fileEvents);
        dataService._normalizeSatelliteEventsInPlace();
        pruneSatellitePhantomConnectionsInPlace(dataService);
        dataService.saveEvents();
        if (removedDupes > 0 && typeof window !== 'undefined') {
            window.FilterService?.invalidateBioArchiveFilterLayouts?.();
        }
        return { events: dataService.events, source: 'file', shouldSync: false };
    }

    if (savedEvents) {
        try {
            const parsed = JSON.parse(savedEvents);
            dataService.events = Array.isArray(parsed) ? parsed : [];
            const removedDupes = prepareSatelliteEventsBeforeNormalize(dataService, fileEvents);
            dataService._normalizeSatelliteEventsInPlace();
            pruneSatellitePhantomConnectionsInPlace(dataService);
            if (removedDupes > 0) dataService.saveEvents();
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
