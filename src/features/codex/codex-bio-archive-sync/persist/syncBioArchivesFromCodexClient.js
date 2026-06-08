/**
 * Mirror Codex layout links into hero/faction/npc archive JSON in the browser when the
 * Node `/api/codex` write is unavailable (GitHub Pages). Matches scripts/server-bio-codex-sync.js.
 */

import {
    ARCHIVE_FILE_PATHS,
    ARCHIVE_LOCALSTORAGE_KEYS,
} from '../../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';
import { normalizeSatelliteArchiveEntry } from '../../../system-interface/interface-left-panel/event-system/data/normalizeBioArchives.js';
import {
    collectCodexBioArchiveSyncPairEntities,
} from '../../../system-interface/interface-shared/bio-archive/bioArchiveDirectCodexPairKeys.js';
import {
    dispatchBioArchivesRefreshed,
    getEventTimelineDataService,
    updateAppStatus,
} from '../../codex-canvas/bridge/CodexAppBridge.js';

function normalizeConnKind(k) {
    let x = String(k || 'hero').toLowerCase();
    if (x === 'character') x = 'hero';
    if (x !== 'faction' && x !== 'npc') x = 'hero';
    return x;
}

function sanitizeName(raw) {
    let t = String(raw == null ? '' : raw).trim();
    while (t.length > 0 && /[,;]\s*$/.test(t)) {
        t = t.replace(/[,;]\s*$/, '').trim();
    }
    return t;
}

function connectionKey(kind, name) {
    return `${normalizeConnKind(kind)}\0${sanitizeName(name).toLowerCase()}`;
}

function findEventIndex(events, arch, entityName) {
    const want = sanitizeName(entityName).toLowerCase();
    for (let i = 0; i < events.length; i += 1) {
        const n = events[i]?.name != null ? String(events[i].name).trim().toLowerCase() : '';
        if (n && n === want) return i;
    }
    return -1;
}

function isPairPrunedInLoads(loads, a, b) {
    const eventsA = loads[a.arch];
    const ixA = findEventIndex(eventsA, a.arch, a.name);
    if (ixA >= 0) {
        const key = connectionKey(b.kind, b.name);
        const row = eventsA[ixA]?.connections?.find(
            (c) => c && connectionKey(c.kind, c.name) === key,
        );
        if (row?.pruned === true) return true;
    }
    const eventsB = loads[b.arch];
    const ixB = findEventIndex(eventsB, b.arch, b.name);
    if (ixB >= 0) {
        const key = connectionKey(a.kind, a.name);
        const row = eventsB[ixB]?.connections?.find(
            (c) => c && connectionKey(c.kind, c.name) === key,
        );
        if (row?.pruned === true) return true;
    }
    return false;
}

function upsertShowInCodexRow(events, eventIndex, targetKind, targetName) {
    const ev = events[eventIndex];
    if (!ev) return false;
    if (!Array.isArray(ev.connections)) ev.connections = [];
    const tk = normalizeConnKind(targetKind);
    const name = sanitizeName(targetName);
    if (!name) return false;
    const key = connectionKey(tk, name);
    const ix = ev.connections.findIndex((c) => c && connectionKey(c.kind, c.name) === key);
    const base = {
        kind: tk,
        name,
        reasoningSubjectToLinked: '',
        reasoningLinkedToSubject: '',
        thisEntryLane: 'A',
        showInCodex: true,
    };
    if (ix >= 0) {
        const cur = ev.connections[ix];
        if (cur.pruned === true) return false;
        if (cur.showInCodex === true) return false;
        ev.connections[ix] = { ...cur, ...base, showInCodex: true };
        return true;
    }
    ev.connections.push(base);
    return true;
}

async function loadArchiveEvents(arch) {
    const storageKey = ARCHIVE_LOCALSTORAGE_KEYS[arch];
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (Array.isArray(parsed?.events)) return parsed.events;
        }
    } catch (_) {
        /* fall through to fetch */
    }

    const url = ARCHIVE_FILE_PATHS[arch];
    const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.events) ? data.events : [];
}

/**
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Promise<{ upserts: number, archives: string[] }>}
 */
export async function syncBioArchivesFromCodexClient(nodes, edges) {
    const pairs = collectCodexBioArchiveSyncPairEntities(nodes, edges || []);
    if (!pairs.length) return { upserts: 0, archives: [] };

    const loads = {
        heroes: await loadArchiveEvents('heroes'),
        factions: await loadArchiveEvents('factions'),
        npcs: await loadArchiveEvents('npcs'),
    };

    let upserts = 0;
    const dirty = new Set();

    for (let pi = 0; pi < pairs.length; pi += 1) {
        const { a, b } = pairs[pi];
        const eventsA = loads[a.arch];
        const eventsB = loads[b.arch];
        const ixA = findEventIndex(eventsA, a.arch, a.name);
        const ixB = findEventIndex(eventsB, b.arch, b.name);
        if (ixA < 0 || ixB < 0) continue;
        if (isPairPrunedInLoads(loads, a, b)) continue;

        if (upsertShowInCodexRow(eventsA, ixA, b.kind, b.name)) {
            dirty.add(a.arch);
            upserts += 1;
        }
        if (upsertShowInCodexRow(eventsB, ixB, a.kind, a.name)) {
            dirty.add(b.arch);
            upserts += 1;
        }
    }

    const archives = [...dirty];
    const ds = getEventTimelineDataService();
    const savedArch = ds?.archiveSource || 'story';

    for (let ai = 0; ai < archives.length; ai += 1) {
        const arch = archives[ai];
        const storageKey = ARCHIVE_LOCALSTORAGE_KEYS[arch];
        const normalized = loads[arch].map((e) => normalizeSatelliteArchiveEntry(e, arch));
        try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
        } catch (err) {
            console.warn('syncBioArchivesFromCodexClient: localStorage write failed', arch, err);
        }
        loads[arch] = normalized;

        if (ds && savedArch === arch) {
            ds.events = normalized;
            if (typeof ds._normalizeSatelliteEventsInPlace === 'function') {
                ds._normalizeSatelliteEventsInPlace();
            }
        }
    }

    if (archives.length) {
        dispatchBioArchivesRefreshed({ archives });
    }

    return { upserts, archives };
}

/**
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
export async function syncBioArchivesFromCodexClientWithStatus(nodes, edges) {
    try {
        const r = await syncBioArchivesFromCodexClient(nodes, edges);
        if (r.upserts > 0) {
            updateAppStatus(
                `Codex saved (browser). Archive connections: ${r.upserts} row(s) added/updated in ${r.archives.join(', ')}.`,
                'success',
            );
        }
        return r;
    } catch (err) {
        console.warn('syncBioArchivesFromCodexClient failed', err);
        return { upserts: 0, archives: [] };
    }
}
