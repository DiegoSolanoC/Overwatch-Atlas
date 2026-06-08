/**
 * Read/write codex-owned connection metadata for archive entry panels (Gallery, event slide).
 * Works with or without an active Codex canvas session.
 */

import { s } from '../codex-canvas/core/canvasSession.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../codex-data/persistence/CodexLayoutConstants.js';
import { fetchCanonicalCodexJson } from '../codex-data/load/CodexJsonRepository.js';
import {
    isCodexPersistToRepoAvailable,
    resolveCodexRepoApiUrl,
    updateAppStatus,
} from '../codex-canvas/bridge/CodexAppBridge.js';
import { ARCHIVE_LOCALSTORAGE_KEYS } from '../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';
import { FILES } from '../../../data/registry.js';
import {
    archForConnKind,
    mergeCodexConnectionMetaForSubject,
    normalizeCodexConnectionMetaRow,
    normalizeCodexConnectionMetaList,
    resolveCodexConnectionsForSubject,
} from './CodexConnectionMeta.js';
import { invalidateCodexFilterDerivedCache } from '../codex-nodes/filters/CodexNodeFilterMatch.js';

/** @type {{ v: number, nodes: object[], edges: object[], connections: object[] } | null} */
let cachedPayload = null;

/** @type {Promise<typeof cachedPayload> | null} */
let cachePromise = null;

/**
 * @param {'heroes'|'factions'|'npcs'} archive
 */
export function subjectKindFromArchive(archive) {
    if (archive === 'factions') return 'faction';
    if (archive === 'npcs') return 'npc';
    return 'hero';
}

function parseCodexPayloadRaw(raw) {
    if (!raw) return null;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object') return null;
        let nodes = [];
        let edges = [];
        if (Array.isArray(parsed)) {
            nodes = parsed;
        } else {
            if (Array.isArray(parsed.nodes)) nodes = parsed.nodes;
            else if (Array.isArray(parsed.labels)) nodes = parsed.labels;
            if (Array.isArray(parsed.edges)) edges = parsed.edges;
        }
        const connections = normalizeCodexConnectionMetaList(parsed.connections);
        const v = typeof parsed.v === 'number' ? parsed.v : CODEX_SAVE_VERSION;
        return { v, nodes, edges, connections };
    } catch (_) {
        return null;
    }
}

function parseArchiveEvents(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.events)) return parsed.events;
    } catch (_) {
        /* ignore */
    }
    return [];
}

async function loadArchiveEvents(arch) {
    const storageKey = ARCHIVE_LOCALSTORAGE_KEYS[arch];
    if (storageKey) {
        try {
            const fromLs = parseArchiveEvents(localStorage.getItem(storageKey));
            if (fromLs.length) return fromLs;
        } catch (_) {
            /* fall through */
        }
    }
    const url =
        arch === 'heroes'
            ? FILES.storyArchive.heroes
            : arch === 'factions'
                ? FILES.storyArchive.factions
                : FILES.storyArchive.npcs;
    try {
        const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.events) ? data.events : [];
    } catch (_) {
        return [];
    }
}

/**
 * One-time import of legacy archive `connections[]` into codex meta rows.
 * @param {object[]} existingMeta
 */
async function migrateArchiveConnectionsIntoMeta(existingMeta) {
    if (Array.isArray(existingMeta) && existingMeta.length) return existingMeta;
    /** @type {object[]} */
    const out = [];
    for (const arch of ['heroes', 'factions', 'npcs']) {
        const subjectKind = subjectKindFromArchive(arch);
        const events = await loadArchiveEvents(arch);
        for (let i = 0; i < events.length; i += 1) {
            const ev = events[i];
            const subjectName = ev?.name != null ? String(ev.name).trim() : '';
            if (!subjectName || !Array.isArray(ev.connections)) continue;
            for (let j = 0; j < ev.connections.length; j += 1) {
                const row = normalizeCodexConnectionMetaRow(ev.connections[j], subjectKind, subjectName);
                if (row) out.push(row);
            }
        }
    }
    return out;
}

function payloadFromSession() {
    if (!s.root || !Array.isArray(s.codexAllNodes) || s.codexAllNodes.length === 0) {
        return null;
    }
    return {
        v: CODEX_SAVE_VERSION,
        nodes: s.codexAllNodes,
        edges: s.codexEdges || [],
        connections: normalizeCodexConnectionMetaList(s.codexConnections || []),
    };
}

/**
 * @param {boolean} [forceRefresh]
 */
export async function ensureCodexConnectionPayload(forceRefresh = false) {
    const fromSession = payloadFromSession();
    if (fromSession?.nodes?.length && !forceRefresh) {
        cachedPayload = fromSession;
        return cachedPayload;
    }
    if (cachedPayload && !forceRefresh) return cachedPayload;
    if (cachePromise && !forceRefresh) return cachePromise;

    cachePromise = (async () => {
        if (fromSession?.nodes?.length) {
            cachedPayload = fromSession;
            return cachedPayload;
        }

        let payload = parseCodexPayloadRaw(localStorage.getItem(CODEX_STORAGE_KEY));
        if (!payload || !payload.nodes.length) {
            const canonical = await fetchCanonicalCodexJson();
            if (canonical.ok) {
                payload = parseCodexPayloadRaw(
                    mergeLocalStorageConnectionsPreferLocal(canonical.data),
                );
            }
        } else if (!payload.connections.length) {
            const canonical = await fetchCanonicalCodexJson();
            if (canonical.ok) {
                const merged = parseCodexPayloadRaw(
                    mergeLocalStorageConnectionsPreferLocal(canonical.data),
                );
                if (merged?.connections?.length) {
                    payload = { ...payload, connections: merged.connections };
                }
            }
        }
        if (!payload) {
            payload = { v: CODEX_SAVE_VERSION, nodes: [], edges: [], connections: [] };
        }

        if (!payload.connections.length) {
            payload.connections = await migrateArchiveConnectionsIntoMeta(payload.connections);
            if (payload.connections.length && Array.isArray(s.codexAllNodes) && s.codexAllNodes.length) {
                s.codexConnections = payload.connections;
                s.codexLayoutDirty = true;
            }
        }

        cachedPayload = payload;
        return cachedPayload;
    })();

    try {
        return await cachePromise;
    } finally {
        cachePromise = null;
    }
}

export function invalidateCodexConnectionPayloadCache() {
    cachedPayload = null;
    cachePromise = null;
}

/**
 * When disk/API codex JSON is older than browser storage, keep stored connection meta.
 * @param {unknown} sourceObj
 */
export function mergeLocalStorageConnectionsPreferLocal(sourceObj) {
    if (!sourceObj || typeof sourceObj !== 'object') return sourceObj;
    const ls = parseCodexPayloadRaw(localStorage.getItem(CODEX_STORAGE_KEY));
    if (!ls?.connections?.length) return sourceObj;
    const diskConn = normalizeCodexConnectionMetaList(
        /** @type {{ connections?: unknown }} */ (sourceObj).connections,
    );
    if (ls.connections.length >= diskConn.length) {
        return { ...sourceObj, connections: ls.connections };
    }
    return sourceObj;
}

/**
 * @returns {Promise<{ v: number, nodes: object[], edges: object[], connections: object[] } | null>}
 */
async function loadCodexPayloadForSave() {
    const fromSession = payloadFromSession();
    if (fromSession?.nodes?.length) return fromSession;

    const fromLs = parseCodexPayloadRaw(localStorage.getItem(CODEX_STORAGE_KEY));
    if (fromLs?.nodes?.length) return fromLs;

    const canonical = await fetchCanonicalCodexJson();
    if (canonical.ok) {
        const parsed = parseCodexPayloadRaw(
            mergeLocalStorageConnectionsPreferLocal(canonical.data),
        );
        if (parsed?.nodes?.length) return parsed;
    }
    return null;
}

/**
 * @param {{ v: number, nodes: object[], edges: object[], connections: object[] }} fullPayload
 */
function writeCodexPayloadToLocalStorage(fullPayload) {
    localStorage.setItem(CODEX_STORAGE_KEY, `${JSON.stringify(fullPayload, null, 2)}\n`);
}

/**
 * @param {{ v: number, nodes: object[], edges: object[], connections: object[] }} fullPayload
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function postCodexPayloadToRepo(fullPayload) {
    const codexPost = resolveCodexRepoApiUrl('api/codex');
    const res = await fetch(codexPost, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `${JSON.stringify(fullPayload, null, 2)}\n`,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return { ok: true };
}

/**
 * @param {object[]} rows
 */
export function setCodexConnectionsInSession(rows) {
    s.codexConnections = normalizeCodexConnectionMetaList(rows);
}

/**
 * @param {'heroes'|'factions'|'npcs'} archive
 * @param {object | null} entry
 * @param {string} [displayName]
 */
export async function resolveConnectionsForArchiveEntry(archive, entry, displayName = '', opts = {}) {
    const subjectKind = subjectKindFromArchive(archive);
    const subjectName =
        entry?.name != null && String(entry.name).trim()
            ? String(entry.name).trim()
            : String(displayName || '').trim();
    if (!subjectName) return [];

    const payload = await ensureCodexConnectionPayload();
    return resolveCodexConnectionsForSubject(
        subjectKind,
        subjectName,
        payload.nodes,
        payload.edges,
        payload.connections,
        { forEdit: opts.forEdit === true },
    );
}

/**
 * @param {'heroes'|'factions'|'npcs'} archive
 * @param {string} subjectName
 * @param {object[]} editorRows
 */
export async function saveCodexConnectionsForSubject(archive, subjectName, editorRows) {
    const subjectKind = subjectKindFromArchive(archive);
    const name = String(subjectName || '').trim();
    if (!name) return { ok: false, error: 'No subject name.' };

    const payload = await loadCodexPayloadForSave();
    if (!payload?.nodes?.length) {
        return { ok: false, error: 'No Codex layout loaded — import or open the Codex first.' };
    }

    const nodes = payload.nodes || [];
    const edges = payload.edges || [];
    const nextConnections = mergeCodexConnectionMetaForSubject(
        payload.connections || [],
        subjectKind,
        name,
        editorRows,
        nodes,
        edges,
    );

    const fullPayload = {
        v: CODEX_SAVE_VERSION,
        nodes,
        edges,
        connections: nextConnections,
    };
    cachedPayload = fullPayload;

    try {
        writeCodexPayloadToLocalStorage(fullPayload);
    } catch (err) {
        console.warn('[codex-connections] localStorage write failed:', err);
        return { ok: false, error: 'Could not save connections locally.' };
    }

    if (s.root) {
        setCodexConnectionsInSession(nextConnections);
        s.codexLayoutDirty = false;
        s.codexFilterReachableNodeIds = null;
        s.codexFilterConnectionEndpointNodeIds = null;
        s.codexFilterLinkedEdgePairKeys = null;
        s.codexFilterActiveEdgePairKeys = null;
        invalidateCodexFilterDerivedCache();
        if (typeof window !== 'undefined' && typeof window.applyCodexFilterState === 'function') {
            window.applyCodexFilterState();
        }
    }

    let writtenToDisk = false;
    if (isCodexPersistToRepoAvailable()) {
        try {
            await postCodexPayloadToRepo(fullPayload);
            writtenToDisk = true;
        } catch (err) {
            console.warn('[codex-connections] /api/codex write failed:', err);
            return {
                ok: false,
                error: `Could not write codex-labels.json (${err?.message || 'API error'}).`,
                connections: nextConnections,
                savedLocally: true,
            };
        }
    }

    return { ok: true, connections: nextConnections, writtenToDisk };
}

/**
 * @param {object | null} entry
 * @param {'heroes'|'factions'|'npcs'} archive
 * @param {object[]} connections
 */
export function archiveEntryWithConnections(entry, archive, connections) {
    const base = entry && typeof entry === 'object' ? { ...entry } : { name: '' };
    base.connections = connections;
    return base;
}

if (typeof window !== 'undefined') {
    window.CodexConnectionService = {
        ensureReady: () => ensureCodexConnectionPayload(),
        invalidateCache: invalidateCodexConnectionPayloadCache,
        resolveConnectionsForArchiveEntry,
        saveCodexConnectionsForSubject,
        archiveEntryWithConnections,
        subjectKindFromArchive,
        archForConnKind,
    };
    window.addEventListener('atlas-bio-archives-refreshed', () => {
        /* archives no longer own connections — codex cache unaffected */
    });
}
