/**
 * Gate Codex cords and packets on dock timeline page vs archive `ranges[]`.
 * Ranged links can span many junction hops (e.g. Reaper → J → … → Overwatch); we grey
 * every edge that lies on some path between the two bio nodes when the range is inactive.
 */

import { FILES } from '../../../../data/registry.js';
import { ARCHIVE_LOCALSTORAGE_KEYS } from '../../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';
import { getDockTimelineEventsForPagination } from '../../../gallery/gallery-mode/heroBiographyDockTimeline.js';
import { findCodexNodeIdForBioEntity } from '../../codex-edge-cords/topology/CodexBioEntityMatching.js';
import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    buildStoryEventIndexByName,
    connectionActiveForTimelineIndexSpan,
    normalizeBioConnectionRanges,
} from '../../../system-interface/interface-shared/bio-archive/bioArchiveConnectionRanges.js';
import {
    ensureCodexTargetedArchiveCache,
    getCodexTargetedArchiveCacheSync,
} from '../../codex-controls-ui/stage/codexTargetedSelectionAllowlist.js';

const DOCK_EVENTS_PER_PAGE = 10;

/** @type {{ heroes: object[], factions: object[], npcs: object[] }} */
let timelineGateArchives = { heroes: [], factions: [], npcs: [] };

/** @type {Set<string>} */
let allRangedPathEdgeKeys = new Set();

/** @type {RangedGateRow[]} */
let cachedGateRows = [];

/** @type {Map<string, string[]>|null} */
let cachedAdjacency = null;

/** @type {string} */
let lastGraphSignature = '';

/** @type {number} */
let lastPageForGate = -1;

/** @type {object | null} */
let lastDebugSnapshot = null;

/**
 * @param {string} storageKey
 * @returns {object[] | null}
 */
function readLocalArchiveEvents(storageKey) {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
        return null;
    }
}

async function fetchArchiveEvents(url) {
    try {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.events) ? data.events : [];
    } catch (_) {
        return [];
    }
}

function connectionLinkKey(kind, name) {
    let lk = String(kind || 'hero').toLowerCase();
    if (lk === 'character') lk = 'hero';
    if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
    return `${lk}\0${String(name || '').trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function mergeArchiveEventsForTimelineGate(localEvents, fileEvents) {
    if (!fileEvents.length) return localEvents || [];
    if (!localEvents?.length) return fileEvents;

    const fileByName = new Map();
    for (const ev of fileEvents) {
        const key = String(ev?.name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        if (key) fileByName.set(key, ev);
    }

    const merged = [];
    const seen = new Set();

    for (const localEv of localEvents) {
        if (!localEv) continue;
        const key = String(localEv.name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        seen.add(key);
        const fileEv = key ? fileByName.get(key) : null;
        if (!fileEv) {
            merged.push(localEv);
            continue;
        }

        const fileConnByKey = new Map();
        for (const fc of fileEv.connections || []) {
            if (fc) fileConnByKey.set(connectionLinkKey(fc.kind, fc.name), fc);
        }

        const connections = (localEv.connections || []).map((lc) => {
            if (!lc) return lc;
            const fc = fileConnByKey.get(connectionLinkKey(lc.kind, lc.name));
            if (!fc) return lc;
            const localRanges = Array.isArray(lc.ranges) ? lc.ranges : [];
            const fileRanges = Array.isArray(fc.ranges) ? fc.ranges : [];
            if (!localRanges.length && fileRanges.length) {
                return { ...lc, ranges: fileRanges, showInCodex: lc.showInCodex ?? fc.showInCodex };
            }
            return lc;
        });

        merged.push({ ...localEv, connections });
    }

    for (const fileEv of fileEvents) {
        const key = String(fileEv?.name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
        if (key && !seen.has(key)) merged.push(fileEv);
    }

    return merged;
}

async function resolveBioArchivesForTimelineIndex() {
    await ensureCodexTargetedArchiveCache();
    const cached = getCodexTargetedArchiveCacheSync();

    const lsHeroes = readLocalArchiveEvents(ARCHIVE_LOCALSTORAGE_KEYS.heroes);
    const lsFactions = readLocalArchiveEvents(ARCHIVE_LOCALSTORAGE_KEYS.factions);
    const lsNpcs = readLocalArchiveEvents(ARCHIVE_LOCALSTORAGE_KEYS.npcs);

    const [fileHeroes, fileFactions, fileNpcs] = await Promise.all([
        fetchArchiveEvents(FILES.storyArchive.heroes),
        fetchArchiveEvents(FILES.storyArchive.factions),
        fetchArchiveEvents(FILES.storyArchive.npcs),
    ]);

    const pick = (ls, cacheArr, fileArr) => {
        if (ls?.length) return ls;
        if (cacheArr?.length) return cacheArr;
        return fileArr;
    };

    return {
        heroes: mergeArchiveEventsForTimelineGate(pick(lsHeroes, cached?.heroes, fileHeroes), fileHeroes),
        factions: mergeArchiveEventsForTimelineGate(
            pick(lsFactions, cached?.factions, fileFactions),
            fileFactions,
        ),
        npcs: mergeArchiveEventsForTimelineGate(pick(lsNpcs, cached?.npcs, fileNpcs), fileNpcs),
    };
}

export async function refreshCodexBioConnectionTimelineIndex() {
    timelineGateArchives = await resolveBioArchivesForTimelineIndex();
    lastGraphSignature = '';
}

export function getCodexDockPageIndexSpan(eventsPerPage = DOCK_EVENTS_PER_PAGE) {
    const events = getDockTimelineEventsForPagination();
    if (!events.length) return null;

    const perPage =
        window.standaloneDockPagination?.eventsPerPage > 0
            ? window.standaloneDockPagination.eventsPerPage
            : eventsPerPage;
    const page =
        window.standaloneDockPagination?.getCurrentPage?.()
        ?? window.standaloneEventSlide?.currentPage
        ?? window.globeController?.dataModel?.getCurrentEventPage?.()
        ?? 1;
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * perPage;
    if (start >= events.length) return null;
    const end = Math.min(start + perPage - 1, events.length - 1);
    return { start, end, page: safePage };
}

function connectionRangesActiveForDockPage(ranges) {
    const span = getCodexDockPageIndexSpan();
    if (!span) return true;
    const events = getDockTimelineEventsForPagination();
    const indexByEventName = buildStoryEventIndexByName(events);
    return connectionActiveForTimelineIndexSpan(
        { ranges },
        span.start,
        span.end,
        indexByEventName,
    );
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Map<string, number>}
 */
function buildUndirectedAdjacency(edges) {
    /** @type {Map<string, string[]>} */
    const adj = new Map();
    const link = (a, b) => {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a).push(b);
    };
    for (const e of edges) {
        if (!e?.fromId || !e?.toId) continue;
        link(e.fromId, e.toId);
        link(e.toId, e.fromId);
    }
    return adj;
}

/**
 * @param {string} startId
 * @param {Map<string, string[]>} adj
 * @returns {Map<string, number>}
 */
function bfsDistancesFrom(startId, adj) {
    /** @type {Map<string, number>} */
    const dist = new Map([[startId, 0]]);
    const queue = [startId];
    for (let qi = 0; qi < queue.length; qi += 1) {
        const u = queue[qi];
        const du = dist.get(u) ?? 0;
        for (const v of adj.get(u) || []) {
            if (!dist.has(v)) {
                dist.set(v, du + 1);
                queue.push(v);
            }
        }
    }
    return dist;
}

/**
 * @typedef {{
 *   label: string,
 *   aId: string,
 *   bId: string,
 *   ranges: object[],
 *   active: boolean,
 *   pathEdgeCount: number,
 *   pathKeys: Set<string>,
 *   directedStepKeys: Set<string>,
 * }} RangedGateRow
 */

/**
 * @param {object[]} allNodes
 * @returns {RangedGateRow[]}
 */
function buildRangedGateRows(allNodes) {
    /** @type {RangedGateRow[]} */
    const rows = [];
    const archList = [
        ['heroes', timelineGateArchives.heroes, 'hero'],
        ['factions', timelineGateArchives.factions, 'faction'],
        ['npcs', timelineGateArchives.npcs, 'npc'],
    ];

    for (const [arch, events, subjectKind] of archList) {
        if (!Array.isArray(events)) continue;
        for (const ev of events) {
            if (!ev) continue;
            const subjectName = String(ev.name || '').trim();
            if (!subjectName) continue;

            for (const c of ev.connections || []) {
                if (!c || c.showInCodex !== true) continue;
                let lk = String(c.kind || 'hero').toLowerCase();
                if (lk === 'character') lk = 'hero';
                if (lk !== 'faction' && lk !== 'npc') lk = 'hero';

                const linkedName = String(c.name || '').trim();
                if (!linkedName) continue;

                const ranges = normalizeBioConnectionRanges(c.ranges);
                if (!ranges.length) continue;

                const aId = findCodexNodeIdForBioEntity(subjectKind, subjectName, allNodes);
                const bId = findCodexNodeIdForBioEntity(lk, linkedName, allNodes);
                if (!aId || !bId || aId === bId) continue;

                const active = connectionRangesActiveForDockPage(ranges);
                rows.push({
                    label: `${subjectName} ↔ ${linkedName}`,
                    aId,
                    bId,
                    ranges,
                    active,
                    pathEdgeCount: 0,
                    pathKeys: new Set(),
                    directedStepKeys: new Set(),
                });
            }
        }
    }

    return rows;
}

/**
 * @param {object[]} allNodes
 * @returns {Map<string, object>}
 */
function buildNodeByIdMap(allNodes) {
    /** @type {Map<string, object>} */
    const map = new Map();
    for (const n of allNodes) {
        if (n?.id) map.set(n.id, n);
    }
    return map;
}

/**
 * Hero / faction / npc portraits may only be path endpoints — not hops on someone else's link.
 * @param {string} nodeId
 * @param {Map<string, object>} nodeById
 */
function isBioPortraitNode(nodeId, nodeById) {
    const n = nodeById.get(nodeId);
    return Boolean(n && (n.kind === 'hero' || n.kind === 'faction' || n.kind === 'npc'));
}

/**
 * One canonical shortest walk through junctions (deterministic).
 * @param {string} aId
 * @param {string} bId
 * @param {Map<string, string[]>} adj
 * @param {Map<string, object>} nodeById
 * @returns {string[]}
 */
function collectCanonicalShortestNodePath(aId, bId, adj, nodeById) {
    /** @type {Map<string, number>} */
    const dist = new Map([[aId, 0]]);
    /** @type {Map<string, string>} */
    const parent = new Map([[aId, '']]);
    const queue = [aId];

    for (let qi = 0; qi < queue.length; qi += 1) {
        const u = queue[qi];
        if (u === bId) break;
        const neighbors = (adj.get(u) || []).slice().sort();
        for (let i = 0; i < neighbors.length; i += 1) {
            const v = neighbors[i];
            if (dist.has(v)) continue;
            if (v !== bId && isBioPortraitNode(v, nodeById)) continue;
            dist.set(v, (dist.get(u) ?? 0) + 1);
            parent.set(v, u);
            queue.push(v);
        }
    }

    if (!dist.has(bId)) return [];

    /** @type {string[]} */
    const rev = [bId];
    let cur = bId;
    while (cur !== aId) {
        const prev = parent.get(cur);
        if (!prev) return [];
        rev.push(prev);
        cur = prev;
    }
    return rev.reverse();
}

/**
 * @param {RangedGateRow} row
 * @param {Map<string, string[]>} adj
 * @param {Map<string, object>} nodeById
 */
function collectCanonicalPathEdgeKeysForGateRow(row, adj, nodeById) {
    /** @type {Set<string>} */
    const keys = new Set();
    const nodePath = collectCanonicalShortestNodePath(row.aId, row.bId, adj, nodeById);
    for (let i = 0; i < nodePath.length - 1; i += 1) {
        keys.add(codexUnorderedPairKey(nodePath[i], nodePath[i + 1]));
    }
    return keys;
}

/**
 * Directed steps along the canonical walk (both directions for packet sim).
 * @param {RangedGateRow} row
 * @param {Map<string, string[]>} adj
 * @param {Map<string, object>} nodeById
 * @returns {Set<string>}
 */
function collectCanonicalDirectedStepKeysForGateRow(row, adj, nodeById) {
    /** @type {Set<string>} */
    const keys = new Set();
    const nodePath = collectCanonicalShortestNodePath(row.aId, row.bId, adj, nodeById);
    for (let i = 0; i < nodePath.length - 1; i += 1) {
        keys.add(`${nodePath[i]}\0${nodePath[i + 1]}`);
        keys.add(`${nodePath[i + 1]}\0${nodePath[i]}`);
    }
    return keys;
}

function recomputeTimelineGateCaches(allNodes, edges) {
    allRangedPathEdgeKeys = new Set();
    cachedGateRows = [];
    cachedAdjacency = null;

    const span = getCodexDockPageIndexSpan();
    const gateRows = buildRangedGateRows(allNodes);
    const adj = buildUndirectedAdjacency(edges);
    const nodeById = buildNodeByIdMap(allNodes);
    cachedAdjacency = adj;
    cachedGateRows = gateRows;

    for (const row of gateRows) {
        row.pathKeys = collectCanonicalPathEdgeKeysForGateRow(row, adj, nodeById);
        row.pathEdgeCount = row.pathKeys.size;
        row.directedStepKeys = collectCanonicalDirectedStepKeysForGateRow(row, adj, nodeById);
        for (const k of row.pathKeys) allRangedPathEdgeKeys.add(k);
    }

    let dormantEdgeCount = 0;
    for (const k of allRangedPathEdgeKeys) {
        let lit = false;
        for (const row of gateRows) {
            if (row.active && row.pathKeys.has(k)) {
                lit = true;
                break;
            }
        }
        if (!lit) dormantEdgeCount += 1;
    }

    lastDebugSnapshot = {
        at: Date.now(),
        dockPage: span?.page ?? null,
        dockSpan: span ? { start: span.start, end: span.end } : null,
        archiveHeroCount: timelineGateArchives.heroes?.length ?? 0,
        rangedGateCount: gateRows.length,
        rangedPathEdgeCount: allRangedPathEdgeKeys.size,
        dormantRangedEdgeCount: dormantEdgeCount,
        gates: gateRows.map((r) => ({
            label: r.label,
            active: r.active,
            pathEdgeCount: r.pathEdgeCount,
            ranges: r.ranges.map((rg) => ({
                start: rg.startEvent,
                end: rg.endEvent || '',
            })),
        })),
    };
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
function ensurePathGateCacheFresh(allNodes, edges) {
    const span = getCodexDockPageIndexSpan();
    const page = span?.page ?? 1;
    const sig = `${allNodes.length}:${edges.length}:${page}`;
    if (sig !== lastGraphSignature || page !== lastPageForGate) {
        lastGraphSignature = sig;
        lastPageForGate = page;
        recomputeTimelineGateCaches(allNodes, edges);
    }
}

/**
 * @param {{ fromId: string, toId: string }} edge
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {boolean}
 */
export function isCodexEdgeTimelineActiveForDockPage(edge, allNodes, edges) {
    if (!edge?.fromId || !edge?.toId) return true;
    if (!Array.isArray(allNodes) || !allNodes.length) return true;
    if (!timelineGateArchives.heroes?.length && !timelineGateArchives.factions?.length) {
        return true;
    }

    ensurePathGateCacheFresh(allNodes, edges);
    const key = codexUnorderedPairKey(edge.fromId, edge.toId);
    if (!allRangedPathEdgeKeys.has(key)) return true;

    for (const row of cachedGateRows) {
        if (row.active && row.pathKeys.has(key)) return true;
    }
    return false;
}

/**
 * Packets follow directed codex edges; only enable when an active ranged bio link uses this arrow
 * on a shortest path between its two endpoints (stops inactive branches sharing a trunk).
 * @param {{ fromId: string, toId: string }} edge
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
export function isDirectedCodexEdgeOnActiveBioConnectionPath(edge, allNodes, edges) {
    if (!edge?.fromId || !edge?.toId) return true;
    if (!Array.isArray(allNodes) || !allNodes.length) return true;
    if (!timelineGateArchives.heroes?.length && !timelineGateArchives.factions?.length) {
        return true;
    }

    ensurePathGateCacheFresh(allNodes, edges);
    const key = codexUnorderedPairKey(edge.fromId, edge.toId);
    if (!allRangedPathEdgeKeys.has(key)) return true;

    const stepKey = `${edge.fromId}\0${edge.toId}`;
    for (const row of cachedGateRows) {
        if (!row.active || !row.directedStepKeys) continue;
        if (row.directedStepKeys.has(stepKey)) return true;
    }
    return false;
}

/** @returns {object | null} */
export function getCodexTimelineGateDebugSnapshot() {
    return lastDebugSnapshot;
}

/**
 * Run in browser console while Codex is open: `CodexTimelineGate.debug()`
 * @param {object[]} [allNodes]
 */
export function debugCodexTimelineGate(allNodes) {
    const nodes =
        allNodes
        || (typeof window !== 'undefined' && window.CodexCanvasService?.getCodexAllNodes?.())
        || [];
    const edges =
        (typeof window !== 'undefined' && window.CodexCanvasService?.getCodexEdges?.())
        || [];

    recomputeTimelineGateCaches(nodes, edges);
    const snap = getCodexTimelineGateDebugSnapshot();
    console.table(snap?.gates || []);
    console.info('[CodexTimelineGate]', snap);
    return snap;
}

/**
 * @param {() => object[] | { nodes: object[], edges?: object[] }} getCodexGraph
 * @param {() => void} onTimelineGateChange
 */
export function initCodexBioConnectionDockTimelineListener(getCodexGraph, onTimelineGateChange) {
    const resolveGraph = () => {
        const raw = typeof getCodexGraph === 'function' ? getCodexGraph() : null;
        if (raw && Array.isArray(raw.nodes)) {
            return { nodes: raw.nodes, edges: raw.edges || [] };
        }
        if (Array.isArray(raw)) return { nodes: raw, edges: [] };
        return { nodes: [], edges: [] };
    };

    const apply = () => {
        const { nodes, edges } = resolveGraph();
        lastGraphSignature = '';
        recomputeTimelineGateCaches(nodes, edges);
        onTimelineGateChange?.();
    };

    const rebuildArchives = () => {
        void refreshCodexBioConnectionTimelineIndex().then(apply);
    };

    const onPage = () => apply();

    window.addEventListener('atlas-dock-timeline-page-changed', onPage);
    window.addEventListener('atlas-bio-archives-refreshed', rebuildArchives);

    void refreshCodexBioConnectionTimelineIndex().then(apply);

    return () => {
        window.removeEventListener('atlas-dock-timeline-page-changed', onPage);
        window.removeEventListener('atlas-bio-archives-refreshed', rebuildArchives);
    };
}
