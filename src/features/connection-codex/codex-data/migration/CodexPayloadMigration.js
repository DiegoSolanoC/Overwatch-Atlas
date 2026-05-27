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

function parseLoadedCodexPayload(parsed) {
    let nodes = null;
    let edges = [];
    let v = 2;
    if (Array.isArray(parsed)) {
        nodes = parsed;
        v = 1;
    } else if (parsed && typeof parsed === 'object') {
        if (typeof parsed.v === 'number') v = parsed.v;
        if (Array.isArray(parsed.nodes)) nodes = parsed.nodes;
        else if (Array.isArray(parsed.labels)) nodes = parsed.labels;
        if (Array.isArray(parsed.edges)) edges = parsed.edges;
    }
    return { nodes: nodes || [], edges, v };
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
 * Drop a direct entity↔entity edge if those two nodes are still connected without it via a path
 * that uses at least one junction (break) node.
 */
function pruneRedundantEntityShortcutEdges(nodes, edges) {
    if (!Array.isArray(edges) || edges.length === 0 || !Array.isArray(nodes)) return edges;
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
    function isJunctionNode(id) {
        const n = byId.get(id);
        return !!(n && n.kind === 'junction');
    }
    /** Undirected reachability from start to goal using edgeList; path must visit a junction. */
    function connectedViaJunction(edgeList, start, goal) {
        const adj = new Map();
        for (let k = 0; k < edgeList.length; k += 1) {
            const e = edgeList[k];
            if (!e || !e.fromId || !e.toId) continue;
            if (!adj.has(e.fromId)) adj.set(e.fromId, []);
            if (!adj.has(e.toId)) adj.set(e.toId, []);
            adj.get(e.fromId).push(e.toId);
            adj.get(e.toId).push(e.fromId);
        }
        const q = [{ cur: start, passedJunction: false }];
        const seen = new Set([`${start}|0`]);
        while (q.length) {
            const { cur, passedJunction } = q.shift();
            if (cur === goal && passedJunction) return true;
            const neighbors = adj.get(cur) || [];
            for (let j = 0; j < neighbors.length; j += 1) {
                const nxt = neighbors[j];
                const pj = passedJunction || isJunctionNode(nxt);
                const key = `${nxt}|${pj ? 1 : 0}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    q.push({ cur: nxt, passedJunction: pj });
                }
            }
        }
        return false;
    }
    const out = [];
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e || !e.fromId || !e.toId) continue;
        if (!isEntityNode(e.fromId) || !isEntityNode(e.toId)) {
            out.push(e);
            continue;
        }
        const rest = edges.filter((_, j) => j !== i);
        if (connectedViaJunction(rest, e.fromId, e.toId)) {
            continue;
        }
        out.push(e);
    }
    return out;
}

/**
 * Parse raw save/API payload → node list, deduped edges, migration flags (shared by load + import).
 * @param {unknown} sourceObj
 * @returns {{ nodes: unknown[], edges: { fromId: string, toId: string }[], migratedNow: boolean }}
 */
export function parseMigrateAndDedupeCodexSource(sourceObj) {
    const src = sourceObj && typeof sourceObj === 'object' ? sourceObj : { v: CODEX_SAVE_VERSION, nodes: [], edges: [] };
    let { nodes, edges, v } = parseLoadedCodexPayload(src);
    let migratedNow = false;
    if (v < CODEX_JUNCTION_LAYOUT_MIN_VERSION) {
        if (codexNodesLookLikeModernSavedShape(nodes)) {
            migratedNow = true;
        } else {
            nodes = [];
            edges = [];
            migratedNow = true;
        }
    } else if (v < CODEX_SAVE_VERSION) {
        migratedNow = true;
        const m = migrateCodexLayoutCoordsForExpandedWorld(nodes, edges);
        nodes = m.nodes;
        edges = m.edges;
    }
    const dedupedEdges = dedupeCodexEdgesByNodePair(
        Array.isArray(edges) ? edges.map(normalizeEdgeRecord).filter(Boolean) : []
    );
    const prunedEdges = migratedNow
        ? pruneRedundantEntityShortcutEdges(nodes, dedupedEdges)
        : dedupedEdges;
    return { nodes, edges: prunedEdges, migratedNow };
}
