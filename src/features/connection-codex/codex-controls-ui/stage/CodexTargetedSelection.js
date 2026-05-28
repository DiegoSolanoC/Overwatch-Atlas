/**
 * Targeted selection — focus the codex on chosen nodes and the cords between them.
 */

import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import {
    findCodexNodeIdForBioEntity,
    factionNodeMatchesToken
} from '../../codex-edge-cords/topology/CodexBioEntityMatching.js';
import {
    codexUnorderedPairKey,
    heroNamesLooselyEqualCodex
} from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { CODEX_TARGETED_LINK_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { stopCordAnimAndClearCordPacketState } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import {
    buildAllowedBioNodeIdsForTargetedSeed,
    ensureCodexTargetedArchiveCache,
} from './codexTargetedSelectionAllowlist.js';

/** @param {object} node */
export function getCodexNodeDisplayName(node) {
    if (!node || typeof node !== 'object') return '';
    const kind = node.kind;
    if (kind === 'hero') return String(node.heroName || '').trim();
    if (kind === 'npc') return String(node.npcName || '').trim();
    if (kind === 'faction') {
        return String(node.factionDisplay || node.factionFilename || '').trim();
    }
    if (kind === 'country') return String(node.countryKey || '').trim();
    if (kind === 'junction') return 'Break';
    return '';
}

function substringMatchScore(haystack, needle) {
    if (!needle) return 0;
    const h = String(haystack || '').toLowerCase();
    const n = needle.toLowerCase();
    if (!h.includes(n)) return Infinity;
    if (h.startsWith(n)) return 0;
    return 1 + h.indexOf(n);
}

/**
 * @param {string} prefix
 * @param {number} [limit]
 * @returns {{ nodeId: string, kind: string, name: string, score: number }[]}
 */
export function listCodexCanvasNodeSuggestions(prefix, limit = 12) {
    const p = String(prefix || '').trim().toLowerCase();
    if (!p || !Array.isArray(s.codexAllNodes)) return [];
    const rows = [];
    for (let i = 0; i < s.codexAllNodes.length; i += 1) {
        const n = s.codexAllNodes[i];
        if (!n || n.kind === 'junction') continue;
        const name = getCodexNodeDisplayName(n);
        if (!name.toLowerCase().includes(p)) continue;
        rows.push({
            nodeId: n.id,
            kind: n.kind,
            name,
            score: substringMatchScore(name, p)
        });
    }
    rows.sort(
        (a, b) => a.score - b.score
            || a.name.length - b.name.length
            || a.name.localeCompare(b.name)
    );
    return rows.slice(0, limit);
}

/**
 * @param {string} query
 * @returns {string} node id or ''
 */
export function resolveCodexNodeIdFromNameQuery(query) {
    const q = String(query || '').trim();
    if (!q || !Array.isArray(s.codexAllNodes)) return '';
    const ql = q.toLowerCase();
    for (let i = 0; i < s.codexAllNodes.length; i += 1) {
        const n = s.codexAllNodes[i];
        if (!n || n.kind === 'junction') continue;
        if (getCodexNodeDisplayName(n).toLowerCase() === ql) return n.id;
    }
    for (const kind of ['hero', 'npc', 'faction']) {
        const id = findCodexNodeIdForBioEntity(kind, q, s.codexAllNodes);
        if (id) return id;
    }
    for (let j = 0; j < s.codexAllNodes.length; j += 1) {
        const n = s.codexAllNodes[j];
        if (n && n.kind === 'country' && String(n.countryKey || '').trim().toLowerCase() === ql) {
            return n.id;
        }
    }
    for (let k = 0; k < s.codexAllNodes.length; k += 1) {
        const n = s.codexAllNodes[k];
        if (!n || n.kind === 'junction') continue;
        const name = getCodexNodeDisplayName(n);
        if (name.toLowerCase().includes(ql)) {
            if (n.kind === 'hero' && heroNamesLooselyEqualCodex(n.heroName, q)) return n.id;
            if (n.kind === 'faction' && factionNodeMatchesToken(n, q)) return n.id;
        }
    }
    return '';
}

/** @param {{ fromId: string, toId: string }[]} edges */
export function buildCodexUndirectedAdjacency(edges) {
    /** @type {Map<string, Set<string>>} */
    const adj = new Map();
    const add = (a, b) => {
        if (!a || !b || a === b) return;
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a).add(b);
    };
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e) continue;
        add(e.fromId, e.toId);
        add(e.toId, e.fromId);
    }
    return adj;
}

/** @returns {Map<string, string>} */
function buildCodexNodeKindMap() {
    /** @type {Map<string, string>} */
    const kindById = new Map();
    const nodes = s.codexAllNodes || [];
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n?.id) kindById.set(n.id, n.kind || '');
    }
    return kindById;
}

function isCodexPortraitKind(kind) {
    return Boolean(kind && kind !== 'junction');
}

/**
 * From seed: follow junction cords; include a branch only if its terminal portrait is allowlisted.
 * @param {string} seedId
 * @param {Map<string, Set<string>>} adj
 * @param {Map<string, string>} kindById
 * @param {Set<string>} allowedBioIds
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
function expandCodexConnectionsOfSeedPruned(seedId, adj, kindById, allowedBioIds) {
    const nodeIds = new Set([seedId]);
    const edgePairKeys = new Set();
    const allowed = allowedBioIds || new Set();

    const addPath = (path) => {
        if (!path?.length) return;
        for (let i = 0; i < path.length; i += 1) nodeIds.add(path[i]);
        for (let j = 0; j < path.length - 1; j += 1) {
            edgePairKeys.add(codexUnorderedPairKey(path[j], path[j + 1]));
        }
    };

    for (const bioId of allowed) {
        if (!bioId || bioId === seedId) continue;
        const path = shortestPathNodeIdsForTargetedRoutePreview(adj, kindById, seedId, bioId);
        addPath(path);
    }

    for (const nb of adj.get(seedId) || []) {
        if (!isCodexPortraitKind(kindById.get(nb) || '')) continue;
        if (!allowed.has(nb)) continue;
        nodeIds.add(nb);
        edgePairKeys.add(codexUnorderedPairKey(seedId, nb));
    }

    return { nodeIds, edgePairKeys };
}

/**
 * @param {string} seedId
 * @param {Map<string, Set<string>>} adj
 * @param {Map<string, string>} kindById
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
function expandCodexConnectionsOfSeedForTargeted(seedId, adj, kindById) {
    const allowed = buildAllowedBioNodeIdsForTargetedSeed(seedId);
    return expandCodexConnectionsOfSeedPruned(seedId, adj, kindById, allowed);
}

/**
 * @param {Map<string, Set<string>>} adj
 * @param {string} start
 * @param {string} goal
 * @returns {string[]|null}
 */
export function shortestPathNodeIds(adj, start, goal) {
    if (start === goal) return [start];
    /** @type {Map<string, string|null>} */
    const prev = new Map([[start, null]]);
    const q = [start];
    let qi = 0;
    while (qi < q.length) {
        const id = q[qi];
        qi += 1;
        for (const nb of adj.get(id) || []) {
            if (prev.has(nb)) continue;
            prev.set(nb, id);
            if (nb === goal) {
                const path = [];
                let cur = nb;
                while (cur != null) {
                    path.push(cur);
                    cur = prev.get(cur) ?? null;
                }
                return path.reverse();
            }
            q.push(nb);
        }
    }
    return null;
}

/**
 * Route preview path: only break nodes may appear between the seed and hovered portrait.
 * Other portraits are not used as hop points (junction-only hops between seed and goal).
 * @param {Map<string, Set<string>>} adj
 * @param {Map<string, string>} kindById
 * @param {string} start
 * @param {string} goal
 * @param {Set<string>} [restrictToNodeIds] when set, path may only use these nodes
 * @returns {string[]|null}
 */
export function shortestPathNodeIdsForTargetedRoutePreview(
    adj,
    kindById,
    start,
    goal,
    restrictToNodeIds,
) {
    if (start === goal) return [start];
    const isPortrait = (id) => {
        const k = kindById.get(id) || '';
        return k !== 'junction' && k !== '';
    };
    /** @type {Map<string, string|null>} */
    const prev = new Map([[start, null]]);
    const q = [start];
    let qi = 0;
    while (qi < q.length) {
        const id = q[qi];
        qi += 1;
        for (const nb of adj.get(id) || []) {
            if (prev.has(nb)) continue;
            if (restrictToNodeIds && !restrictToNodeIds.has(nb)) continue;
            if (isPortrait(nb) && nb !== goal && nb !== start) continue;
            prev.set(nb, id);
            if (nb === goal) {
                const path = [];
                let cur = nb;
                while (cur != null) {
                    path.push(cur);
                    cur = prev.get(cur) ?? null;
                }
                return path.reverse();
            }
            q.push(nb);
        }
    }
    return null;
}

/** @returns {Map<string, string>} */
export function buildCodexNodeKindMapFromSession() {
    return buildCodexNodeKindMap();
}

/** @param {string[]} path */
function addPathToGraph(path, nodeIds, edgePairKeys) {
    if (!path?.length) return;
    for (let i = 0; i < path.length; i += 1) nodeIds.add(path[i]);
    for (let j = 0; j < path.length - 1; j += 1) {
        edgePairKeys.add(codexUnorderedPairKey(path[j], path[j + 1]));
    }
}

/**
 * Each seed’s own cords, plus shortest paths between every pair of seeds.
 * @param {string[]} seedIds
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
function computeCodexTargetedSelectionGraphLinkSeeds(seedIds) {
    const seeds = (seedIds || []).filter(Boolean);
    if (!seeds.length) {
        return { nodeIds: new Set(), edgePairKeys: new Set() };
    }

    const adj = buildCodexUndirectedAdjacency(s.codexEdges || []);
    const kindById = buildCodexNodeKindMap();
    const nodeIds = new Set(seeds);
    const edgePairKeys = new Set();

    if (seeds.length === 1) {
        return expandCodexConnectionsOfSeedForTargeted(seeds[0], adj, kindById);
    }

    for (let i = 0; i < seeds.length; i += 1) {
        for (let j = i + 1; j < seeds.length; j += 1) {
            addPathToGraph(shortestPathNodeIds(adj, seeds[i], seeds[j]), nodeIds, edgePairKeys);
        }
    }

    for (let s = 0; s < seeds.length; s += 1) {
        const sid = seeds[s];
        let linkedToAnotherSeed = false;
        for (let o = 0; o < seeds.length; o += 1) {
            const other = seeds[o];
            if (other === sid) continue;
            if (shortestPathNodeIds(adj, sid, other)) {
                linkedToAnotherSeed = true;
                break;
            }
        }
        if (!linkedToAnotherSeed) {
            const branch = expandCodexConnectionsOfSeedForTargeted(sid, adj, kindById);
            branch.nodeIds.forEach((id) => nodeIds.add(id));
            branch.edgePairKeys.forEach((k) => edgePairKeys.add(k));
        }
    }

    return { nodeIds, edgePairKeys };
}

/**
 * Per-seed connection branches only (default).
 * @param {string[]} seedIds
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
function computeCodexTargetedSelectionGraphBranches(seedIds) {
    const seeds = (seedIds || []).filter(Boolean);
    if (!seeds.length) {
        return { nodeIds: new Set(), edgePairKeys: new Set() };
    }

    const adj = buildCodexUndirectedAdjacency(s.codexEdges || []);
    const kindById = buildCodexNodeKindMap();
    const nodeIds = new Set();
    const edgePairKeys = new Set();

    for (let i = 0; i < seeds.length; i += 1) {
        const branch = expandCodexConnectionsOfSeedForTargeted(seeds[i], adj, kindById);
        branch.nodeIds.forEach((id) => nodeIds.add(id));
        branch.edgePairKeys.forEach((k) => edgePairKeys.add(k));
    }

    return { nodeIds, edgePairKeys };
}

/**
 * @param {string[]} seedIds
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
export function computeCodexTargetedSelectionGraph(seedIds) {
    if (s.codexTargetedSelectionLinkSeeds) {
        return computeCodexTargetedSelectionGraphLinkSeeds(seedIds);
    }
    return computeCodexTargetedSelectionGraphBranches(seedIds);
}

export function loadCodexTargetedLinkPref() {
    try {
        const raw = localStorage.getItem(CODEX_TARGETED_LINK_PREF_KEY);
        if (raw === '1') s.codexTargetedSelectionLinkSeeds = true;
        else if (raw === '0') s.codexTargetedSelectionLinkSeeds = false;
    } catch (_) {
        /* keep default */
    }
}

export function persistCodexTargetedLinkPref() {
    try {
        localStorage.setItem(
            CODEX_TARGETED_LINK_PREF_KEY,
            s.codexTargetedSelectionLinkSeeds ? '1' : '0'
        );
    } catch (_) {
        /* ignore */
    }
}

export async function reapplyCodexTargetedSelectionIfActive() {
    if (!s.codexTargetedSelectionActive || s.codexTargetedSelectionSeedIds.size === 0) return;
    await applyCodexTargetedSelection([...s.codexTargetedSelectionSeedIds]);
}

export function syncCodexTargetedSelectionDom() {
    if (!s.root) return;
    const active = s.codexTargetedSelectionActive;
    const visible = s.codexTargetedSelectionVisibleIds;
    s.root.querySelectorAll('.codex-node').forEach((el) => {
        const id = el.dataset.codexNodeId;
        if (!active) {
            el.classList.remove('codex-node--target-hidden');
            return;
        }
        if (id && visible.has(id)) el.classList.remove('codex-node--target-hidden');
        else el.classList.add('codex-node--target-hidden');
    });
    s.root.classList.toggle('codex--targeted-selection-active', active);
}

/**
 * @param {string[]} seedIds
 */
export async function applyCodexTargetedSelection(seedIds) {
    await ensureCodexTargetedArchiveCache();
    const ids = [...new Set((seedIds || []).filter(Boolean))];
    if (!ids.length) {
        clearCodexTargetedSelection();
        return;
    }
    s.codexTargetedSelectionActive = true;
    s.codexTargetedSelectionSeedIds = new Set(ids);
    const graph = computeCodexTargetedSelectionGraph(ids);
    s.codexTargetedSelectionVisibleIds = graph.nodeIds;
    s.codexTargetedSelectionVisibleEdgeKeys = graph.edgePairKeys;
    syncCodexTargetedSelectionDom();
    stopCordAnimAndClearCordPacketState();
    redrawCodexEdges({ force: true });
}

export function clearCodexTargetedSelection() {
    const had = s.codexTargetedSelectionActive;
    s.codexTargetedSelectionActive = false;
    s.codexTargetedSelectionSeedIds = new Set();
    s.codexTargetedSelectionVisibleIds = new Set();
    s.codexTargetedSelectionVisibleEdgeKeys = new Set();
    syncCodexTargetedSelectionDom();
    api.clearAllCodexEdgeHoverVisual?.();
    if (had) {
        stopCordAnimAndClearCordPacketState();
        redrawCodexEdges({ force: true });
    }
}

api.getCodexNodeDisplayName = getCodexNodeDisplayName;
api.listCodexCanvasNodeSuggestions = listCodexCanvasNodeSuggestions;
api.resolveCodexNodeIdFromNameQuery = resolveCodexNodeIdFromNameQuery;
api.applyCodexTargetedSelection = applyCodexTargetedSelection;
api.clearCodexTargetedSelection = clearCodexTargetedSelection;
api.syncCodexTargetedSelectionDom = syncCodexTargetedSelectionDom;
api.loadCodexTargetedLinkPref = loadCodexTargetedLinkPref;
api.persistCodexTargetedLinkPref = persistCodexTargetedLinkPref;
api.reapplyCodexTargetedSelectionIfActive = reapplyCodexTargetedSelectionIfActive;
