/**
 * Migrate and normalize raw Codex JSON payloads → consistent node list + deduped edges.
 */

import {
    CODEX_JUNCTION_LAYOUT_MIN_VERSION,
    CODEX_SAVE_VERSION,
    CODEX_WORLD_EXPAND_SHIFT_X,
    CODEX_WORLD_EXPAND_SHIFT_Y
} from '../persistence/CodexLayoutConstants.js';
import {
    dedupeCodexEdgesByNodePair,
    normalizeEdgeRecord
} from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { normalizeCodexConnectionMetaList } from '../../codex-connections/CodexConnectionMeta.js';
import {
    CODEX_DEFAULT_SCALE_JUNCTION,
    CODEX_JUNCTION_BASE_PX,
    codexNodeCenterFromLayoutRecord,
    resolveCodexNodeScale,
} from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';

function parseLoadedCodexPayload(parsed) {
    let nodes = null;
    let edges = [];
    let connections = [];
    let v = 2;
    if (Array.isArray(parsed)) {
        nodes = parsed;
        v = 1;
    } else if (parsed && typeof parsed === 'object') {
        if (typeof parsed.v === 'number') v = parsed.v;
        if (Array.isArray(parsed.nodes)) nodes = parsed.nodes;
        else if (Array.isArray(parsed.labels)) nodes = parsed.labels;
        if (Array.isArray(parsed.edges)) edges = parsed.edges;
        if (Array.isArray(parsed.connections)) connections = parsed.connections;
    }
    return { nodes: nodes || [], edges, connections: normalizeCodexConnectionMetaList(connections), v };
}

/** True when nodes look like the current object format (wrong `v` in file — should not wipe). */
function codexNodesLookLikeModernSavedShape(nodeArr) {
    if (!Array.isArray(nodeArr) || nodeArr.length === 0) return false;
    return nodeArr.every(
        (n) =>
            n
            && typeof n === 'object'
            && typeof n.kind === 'string'
            && typeof n.id === 'string'
            && Number.isFinite(Number(n.x))
            && Number.isFinite(Number(n.y))
    );
}

export function migrateCodexLayoutCoordsForExpandedWorld(nodes, edges) {
    const sx = CODEX_WORLD_EXPAND_SHIFT_X;
    const sy = CODEX_WORLD_EXPAND_SHIFT_Y;
    const nextNodes = nodes.map((L) => ({
        ...L,
        x: (typeof L.x === 'number' ? L.x : parseFloat(L.x) || 0) + sx,
        y: (typeof L.y === 'number' ? L.y : parseFloat(L.y) || 0) + sy
    }));
    const nextEdges = edges.map((e) => ({
        fromId: e.fromId,
        toId: e.toId
    }));
    return { nodes: nextNodes, edges: nextEdges };
}

/**
 * Numbani was a one-off country node; it is now the faction "Numbani City of Harmony".
 * @param {unknown[]} nodes
 * @returns {{ nodes: unknown[], changed: boolean }}
 */
export function migrateNumbaniCountryNodesToFaction(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return { nodes: nodes || [], changed: false };
    }
    let changed = false;
    const next = nodes.map((n) => {
        if (!n || typeof n !== 'object') return n;
        if (n.kind !== 'country') return n;
        const key = String(n.countryKey || '').trim().toLowerCase();
        if (key !== 'numbani') return n;
        changed = true;
        const out = { ...n };
        out.kind = 'faction';
        out.factionFilename = 'Numbani City of Harmony';
        out.factionDisplay = 'Numbani City of Harmony';
        delete out.countryKey;
        if (out.bgColor == null) out.bgColor = '#a8adb4';
        return out;
    });
    return { nodes: next, changed };
}

/**
 * Placeholder hero filter "55" was named Hudson — rewrite imported/saved nodes + connection subjects.
 * @param {unknown[]} nodes
 * @param {object[]} [connections]
 * @returns {{ nodes: unknown[], connections: object[], changed: boolean }}
 */
export function migrateHero55ToHudson(nodes, connections) {
    let changed = false;
    const nextNodes = Array.isArray(nodes)
        ? nodes.map((n) => {
            if (!n || typeof n !== 'object') return n;
            if (n.kind === 'hero' && String(n.heroName || '').trim() === '55') {
                changed = true;
                return { ...n, heroName: 'Hudson' };
            }
            return n;
        })
        : nodes || [];

    const nextConnections = Array.isArray(connections)
        ? connections.map((row) => {
            if (!row || typeof row !== 'object') return row;
            let next = row;
            const patch = (key) => {
                if (String(next[key] || '').trim() !== '55') return;
                if (next === row) next = { ...row };
                next[key] = 'Hudson';
                changed = true;
            };
            patch('name');
            patch('subjectName');
            patch('linkedName');
            return next;
        })
        : connections || [];

    return { nodes: nextNodes, connections: nextConnections, changed };
}

/**
 * Convert every direct entity↔entity chord into a break route (A → junction → B).
 * Naked short cords skip the elbow/break render path and were easy to lose on import;
 * break format matches the rest of the board.
 * @param {unknown[]} nodes mutated in place when junctions are appended
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {{ fromId: string, toId: string }[]}
 */
function convertEntityShortcutEdgesToBreakRoutes(nodes, edges) {
    if (!Array.isArray(edges) || edges.length === 0 || !Array.isArray(nodes)) return edges || [];
    const byId = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n && n.id) byId.set(n.id, n);
    }
    const entityKinds = new Set(['hero', 'faction', 'npc', 'country']);
    function isEntityNode(id) {
        const n = byId.get(id);
        return !!(n && entityKinds.has(n.kind));
    }
    let stamp = Date.now();
    const out = [];
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e || !e.fromId || !e.toId) continue;
        if (!isEntityNode(e.fromId) || !isEntityNode(e.toId)) {
            out.push(e);
            continue;
        }
        const a = byId.get(e.fromId);
        const b = byId.get(e.toId);
        if (!a || !b) continue;
        stamp += 1;
        const jid = `cn-${stamp}-brk${Math.random().toString(36).slice(2, 7)}`;
        // Place the break on the center-to-center line (no perpendicular nudge) so
        // short A→J→B routes stay visually straight instead of shouldered L-bends.
        const ca = codexNodeCenterFromLayoutRecord(a) || { x: Number(a.x) || 0, y: Number(a.y) || 0 };
        const cb = codexNodeCenterFromLayoutRecord(b) || { x: Number(b.x) || 0, y: Number(b.y) || 0 };
        const jScale = resolveCodexNodeScale('junction', CODEX_DEFAULT_SCALE_JUNCTION);
        const jDim = CODEX_JUNCTION_BASE_PX * jScale;
        const junction = {
            id: jid,
            kind: 'junction',
            x: (ca.x + cb.x) / 2 - jDim / 2,
            y: (ca.y + cb.y) / 2 - jDim / 2,
            scale: jScale,
            bgColor: null,
        };
        nodes.push(junction);
        byId.set(jid, junction);
        out.push({ fromId: e.fromId, toId: jid });
        out.push({ fromId: jid, toId: e.toId });
    }
    return out;
}

/**
 * Parse raw save/API payload → node list, deduped edges, migration flags (shared by load + import).
 * @param {unknown} sourceObj
 * @returns {{ nodes: unknown[], edges: { fromId: string, toId: string }[], connections: object[], migratedNow: boolean }}
 */
export function parseMigrateAndDedupeCodexSource(sourceObj) {
    const src = sourceObj && typeof sourceObj === 'object' ? sourceObj : { v: CODEX_SAVE_VERSION, nodes: [], edges: [] };
    let { nodes, edges, connections, v } = parseLoadedCodexPayload(src);
    let migratedNow = false;
    if (v < CODEX_JUNCTION_LAYOUT_MIN_VERSION) {
        if (codexNodesLookLikeModernSavedShape(nodes)) {
            migratedNow = true;
        } else {
            nodes = [];
            edges = [];
            connections = [];
            migratedNow = true;
        }
    } else if (v < CODEX_SAVE_VERSION) {
        migratedNow = true;
    }
    const numbaniMig = migrateNumbaniCountryNodesToFaction(nodes);
    nodes = numbaniMig.nodes;
    if (numbaniMig.changed) migratedNow = true;
    const hudsonMig = migrateHero55ToHudson(nodes, connections);
    nodes = hudsonMig.nodes;
    connections = hudsonMig.connections;
    if (hudsonMig.changed) migratedNow = true;
    const dedupedEdges = dedupeCodexEdgesByNodePair(
        Array.isArray(edges) ? edges.map(normalizeEdgeRecord).filter(Boolean) : []
    );
    // Always normalize naked entity↔entity chords to break routes (import + load).
    const normalizedEdges = convertEntityShortcutEdgesToBreakRoutes(nodes, dedupedEdges);
    return { nodes, edges: normalizedEdges, connections, migratedNow };
}
