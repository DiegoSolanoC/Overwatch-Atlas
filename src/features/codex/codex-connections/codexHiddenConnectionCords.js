/**
 * Hide connection cords on the Codex board when archive meta marks `hideInCodex: true`.
 * Includes junction-bridged paths between the two bio portraits (same walk as timeline gates).
 */

import { s } from '../codex-canvas/core/canvasSession.js';
import { codexUnorderedPairKey } from '../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { findCodexNodeIdForBioEntity } from '../codex-edge-cords/topology/CodexBioEntityMatching.js';
import { codexConnectionSubjectLinkedKey } from './CodexConnectionMeta.js';

/** @type {Set<string>} */
let hiddenPathEdgeKeys = new Set();

/** @type {string} */
let lastStructureSignature = '';

export function invalidateCodexHiddenConnectionPathCache() {
    lastStructureSignature = '';
    hiddenPathEdgeKeys = new Set();
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Map<string, string[]>}
 */
function buildUndirectedAdjacency(edges) {
    /** @type {Map<string, string[]>} */
    const adj = new Map();
    const touch = (a, b) => {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a).push(b);
    };
    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        touch(e.fromId, e.toId);
        touch(e.toId, e.fromId);
    }
    return adj;
}

/**
 * @param {object[]} allNodes
 * @returns {Map<string, object>}
 */
function buildNodeByIdMap(allNodes) {
    /** @type {Map<string, object>} */
    const map = new Map();
    for (const n of allNodes || []) {
        if (n?.id) map.set(n.id, n);
    }
    return map;
}

/**
 * @param {string} nodeId
 * @param {Map<string, object>} nodeById
 */
function isBioPortraitNode(nodeId, nodeById) {
    const n = nodeById.get(nodeId);
    return Boolean(n && (n.kind === 'hero' || n.kind === 'faction' || n.kind === 'npc'));
}

/**
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
 * @param {object[]} metaRows
 * @returns {{ sk: string, sn: string, lk: string, ln: string }[]}
 */
function collectHiddenBioPairs(metaRows) {
    /** @type {{ sk: string, sn: string, lk: string, ln: string }[]} */
    const pairs = [];
    /** @type {Set<string>} */
    const seen = new Set();

    for (const row of metaRows || []) {
        if (!row || row.hideInCodex !== true) continue;
        const sk = String(row.subjectKind || 'hero').toLowerCase();
        const sn = String(row.subjectName || '').trim();
        const lk = String(row.linkedKind || row.kind || 'hero').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (!sn || !ln) continue;
        const key = codexConnectionSubjectLinkedKey(sk, sn, lk, ln);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ sk, sn, lk, ln });
    }

    return pairs;
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {object[]} metaRows
 */
function buildStructureSignature(allNodes, edges, metaRows) {
    const hiddenParts = collectHiddenBioPairs(metaRows).map(
        (p) => codexConnectionSubjectLinkedKey(p.sk, p.sn, p.lk, p.ln),
    );
    hiddenParts.sort();
    return `${allNodes.length}:${edges.length}:${metaRows?.length ?? 0}:${hiddenParts.join('|')}`;
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {object[]} metaRows
 */
function ensureHiddenPathEdgeKeys(allNodes, edges, metaRows) {
    const sig = buildStructureSignature(allNodes, edges, metaRows);
    if (sig === lastStructureSignature) return;

    lastStructureSignature = sig;
    hiddenPathEdgeKeys = new Set();

    const pairs = collectHiddenBioPairs(metaRows);
    if (!pairs.length) return;

    const adj = buildUndirectedAdjacency(edges);
    const nodeById = buildNodeByIdMap(allNodes);

    for (const { sk, sn, lk, ln } of pairs) {
        const aId = findCodexNodeIdForBioEntity(sk, sn, allNodes);
        const bId = findCodexNodeIdForBioEntity(lk, ln, allNodes);
        if (!aId || !bId || aId === bId) continue;

        const nodePath = collectCanonicalShortestNodePath(aId, bId, adj, nodeById);
        for (let i = 0; i < nodePath.length - 1; i += 1) {
            hiddenPathEdgeKeys.add(codexUnorderedPairKey(nodePath[i], nodePath[i + 1]));
        }
    }
}

/**
 * @param {{ fromId: string, toId: string }} edge
 * @param {object[]} [allNodes]
 * @param {{ fromId: string, toId: string }[]} [edges]
 * @param {object[]} [metaRows]
 * @returns {boolean}
 */
export function codexEdgeIsHiddenOnBoard(edge, allNodes, edges, metaRows) {
    if (!edge?.fromId || !edge?.toId) return false;

    const nodes = allNodes || s.codexAllNodes || [];
    const edgeList = edges || s.codexEdges || [];
    const meta = metaRows || s.codexConnections || [];

    ensureHiddenPathEdgeKeys(nodes, edgeList, meta);
    if (!hiddenPathEdgeKeys.size) return false;

    return hiddenPathEdgeKeys.has(codexUnorderedPairKey(edge.fromId, edge.toId));
}
