/**
 * Shared filter matching for Codex portrait nodes and cords (no redraw imports).
 */

import { getStandaloneActiveFiltersSet } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    buildCodexPruneAwareBranchGraphForSeedIds,
    buildCodexUndirectedAdjacency,
    shortestPathNodeIds,
} from '../../codex-controls-ui/stage/CodexTargetedSelection.js';
import { buildAllowedBioNodeIdsBySeedIds } from '../../codex-controls-ui/stage/codexTargetedSelectionAllowlist.js';
import {
    isCodexConnectionPairPruned,
    nodeToBioEntity,
} from '../../codex-connections/CodexConnectionMeta.js';
import { invalidateCodexHiddenConnectionPathCache } from '../../codex-connections/codexHiddenConnectionCords.js';
import { s } from '../../codex-canvas/core/canvasSession.js';

/**
 * @returns {boolean}
 */
export function codexFiltersActive() {
    const activeFilters = getStandaloneActiveFiltersSet();
    return !!(activeFilters && activeFilters.size > 0);
}

/**
 * @param {string} kind
 * @param {{ hero?: string, npc?: string, faction?: string, country?: string }} fields
 * @param {Set<string>} activeFilters
 */
function nodeKeysMatchActiveFilters(kind, fields, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) return true;
    if (kind === 'junction') return true;

    const country = String(fields.country || '').trim();
    if (kind === 'country' && country.toLowerCase() === 'numbani') {
        const numbaniRelatedFilters = ['Efi', 'Adawe', 'Orisa'];
        for (const filter of activeFilters) {
            for (const related of numbaniRelatedFilters) {
                if (filter === related || filter === `hero:${related}` || filter === `npc:${related}`) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @type {Set<string>} */
    const nodeFilterKeys = new Set();
    const hero = String(fields.hero || '').trim();
    const npc = String(fields.npc || '').trim();
    const faction = String(fields.faction || '').trim();

    if (kind === 'hero' && hero) {
        nodeFilterKeys.add(hero);
        nodeFilterKeys.add(`hero:${hero}`);
    } else if (kind === 'npc' && npc) {
        nodeFilterKeys.add(npc);
        nodeFilterKeys.add(`npc:${npc}`);
    } else if (kind === 'faction' && faction) {
        nodeFilterKeys.add(faction);
        nodeFilterKeys.add(`faction:${faction}`);
    } else if (kind === 'country' && country) {
        nodeFilterKeys.add(country);
        nodeFilterKeys.add(`country:${country}`);
    }

    for (const filter of activeFilters) {
        if (nodeFilterKeys.has(filter)) return true;
    }
    return false;
}

/**
 * Portrait / faction / country / npc nodes only — junctions never match filters.
 * @param {object | null | undefined} node
 */
export function codexPortraitRecordMatchesActiveFilters(node) {
    if (!node || String(node.kind || '') === 'junction') return false;
    const activeFilters = getStandaloneActiveFiltersSet();
    return nodeKeysMatchActiveFilters(String(node.kind || ''), {
        hero: node.heroName,
        npc: node.npcName,
        faction: node.factionFilename,
        country: node.countryKey,
    }, activeFilters);
}

/**
 * @param {object | null | undefined} node In-memory codex node (`s.codexAllNodes` entry).
 */
export function codexNodeRecordMatchesActiveFilters(node) {
    if (!node) return false;
    const activeFilters = getStandaloneActiveFiltersSet();
    return nodeKeysMatchActiveFilters(String(node.kind || ''), {
        hero: node.heroName,
        npc: node.npcName,
        faction: node.factionFilename,
        country: node.countryKey,
    }, activeFilters);
}

/**
 * @param {HTMLElement} nodeEl
 */
export function codexNodeElMatchesActiveFilters(nodeEl) {
    if (!nodeEl) return false;
    const activeFilters = getStandaloneActiveFiltersSet();
    return nodeKeysMatchActiveFilters(String(nodeEl.dataset.codexKind || ''), {
        hero: nodeEl.dataset.codexHero || '',
        npc: nodeEl.dataset.codexNpc || '',
        faction: nodeEl.dataset.codexFactionFile || '',
        country: nodeEl.dataset.codexCountryKey || '',
    }, activeFilters);
}

/**
 * @param {object[]} allNodes
 * @returns {string[]}
 */
export function resolveCodexNodeIdsForActiveFilters(allNodes) {
    if (!codexFiltersActive()) return [];
    /** @type {string[]} */
    const ids = [];
    for (let i = 0; i < (allNodes || []).length; i += 1) {
        const n = allNodes[i];
        if (!n?.id || String(n.kind || '') === 'junction') continue;
        if (codexPortraitRecordMatchesActiveFilters(n)) ids.push(n.id);
    }
    return ids;
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {string[]} seedIds
 * @returns {Set<string>}
 */
export function buildCodexJunctionReachableFromSeedIds(seedIds, allNodes, edges) {
    /** @type {Map<string, object>} */
    const byId = new Map();
    for (let i = 0; i < (allNodes || []).length; i += 1) {
        const n = allNodes[i];
        if (n?.id) byId.set(n.id, n);
    }

    /** @type {Map<string, string[]>} */
    const adjacency = new Map();
    const edgeList = edges || [];
    for (let i = 0; i < edgeList.length; i += 1) {
        const e = edgeList[i];
        if (!e?.fromId || !e?.toId) continue;
        if (!adjacency.has(e.fromId)) adjacency.set(e.fromId, []);
        if (!adjacency.has(e.toId)) adjacency.set(e.toId, []);
        adjacency.get(e.fromId).push(e.toId);
        adjacency.get(e.toId).push(e.fromId);
    }

    /** @type {Set<string>} */
    const reachable = new Set();
    /** @type {string[]} */
    const queue = [];

    for (let i = 0; i < (seedIds || []).length; i += 1) {
        const id = seedIds[i];
        if (!id || !byId.has(id)) continue;
        reachable.add(id);
        queue.push(id);
    }

    while (queue.length > 0) {
        const id = queue.shift();
        const neighbors = adjacency.get(id) || [];
        for (let i = 0; i < neighbors.length; i += 1) {
            const otherId = neighbors[i];
            if (reachable.has(otherId)) continue;
            const other = byId.get(otherId);
            if (!other || String(other.kind || '') !== 'junction') continue;
            reachable.add(otherId);
            queue.push(otherId);
        }
    }

    return reachable;
}

/**
 * Nodes reachable from filter-matching portraits by walking junction hops only.
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Set<string>}
 */
export function buildCodexFilterReachableNodeIds(allNodes, edges) {
    const seeds = resolveCodexNodeIdsForActiveFilters(allNodes);
    return buildCodexJunctionReachableFromSeedIds(seeds, allNodes, edges);
}

/** @param {string[]|null} path */
function addPathToFilterGraph(path, nodeIds, edgePairKeys) {
    if (!path?.length) return;
    for (let i = 0; i < path.length; i += 1) nodeIds.add(path[i]);
    for (let j = 0; j < path.length - 1; j += 1) {
        edgePairKeys.add(codexUnorderedPairKey(path[j], path[j + 1]));
    }
}

/**
 * Shortest paths between every pair of filter seeds (targeted-selection link mode).
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {string[]} seedIds
 * @returns {{ nodeIds: Set<string>, edgePairKeys: Set<string> }}
 */
export function buildCodexFilterLinkGraph(allNodes, edges, seedIds) {
    const seeds = [...new Set((seedIds || []).filter(Boolean))];
    /** @type {Set<string>} */
    const nodeIds = new Set();
    /** @type {Set<string>} */
    const edgePairKeys = new Set();

    if (!seeds.length) {
        return { nodeIds, edgePairKeys };
    }

    if (seeds.length === 1) {
        return {
            nodeIds: buildCodexJunctionReachableFromSeedIds(seeds, allNodes, edges),
            edgePairKeys,
        };
    }

    const adj = buildCodexUndirectedAdjacency(edges || []);
    for (let i = 0; i < seeds.length; i += 1) nodeIds.add(seeds[i]);

    for (let i = 0; i < seeds.length; i += 1) {
        for (let j = i + 1; j < seeds.length; j += 1) {
            addPathToFilterGraph(shortestPathNodeIds(adj, seeds[i], seeds[j]), nodeIds, edgePairKeys);
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
            buildCodexJunctionReachableFromSeedIds([sid], allNodes, edges).forEach((id) => {
                nodeIds.add(id);
            });
        }
    }

    return { nodeIds, edgePairKeys };
}

/**
 * @param {{ fromId: string, toId: string }} edge
 * @param {Map<string, object>} byId
 * @param {object[]} [metaRows]
 */
function codexEdgeIsDirectPrunedPortraitLink(edge, byId, metaRows) {
    if (!edge?.fromId || !edge?.toId) return false;
    const a = byId.get(edge.fromId);
    const b = byId.get(edge.toId);
    if (!a || !b) return false;
    if (String(a.kind || '') === 'junction' || String(b.kind || '') === 'junction') return false;
    const entA = nodeToBioEntity(a);
    const entB = nodeToBioEntity(b);
    if (!entA || !entB) return false;
    return isCodexConnectionPairPruned(
        entA.kind,
        entA.name,
        entB.kind,
        entB.name,
        metaRows || s.codexConnections || [],
    );
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {boolean} linkFiltersEnabled
 * @returns {{
 *   reachableNodeIds: Set<string>,
 *   linkedEdgePairKeys: Set<string>|null,
 *   activeEdgePairKeys: Set<string>,
 *   connectionEndpointNodeIds: Set<string>,
 * }}
 */
export function computeCodexFilterDerivedState(allNodes, edges, linkFiltersEnabled) {
    const seeds = resolveCodexNodeIdsForActiveFilters(allNodes);
    if (!seeds.length) {
        return {
            reachableNodeIds: new Set(),
            linkedEdgePairKeys: null,
            activeEdgePairKeys: new Set(),
            connectionEndpointNodeIds: new Set(),
        };
    }

    const allowedBySeed = buildAllowedBioNodeIdsBySeedIds(seeds, allNodes, edges);
    const pruneGraph = buildCodexPruneAwareBranchGraphForSeedIds(
        seeds,
        allNodes,
        edges,
        allowedBySeed,
    );

    const linkMode = linkFiltersEnabled && seeds.length >= 2;
    if (!linkMode) {
        /** @type {Set<string>} */
        const connectionEndpointNodeIds = new Set();
        /** @type {Map<string, object>} */
        const byId = new Map();
        for (let i = 0; i < (allNodes || []).length; i += 1) {
            const n = allNodes[i];
            if (n?.id) byId.set(n.id, n);
        }
        for (let i = 0; i < seeds.length; i += 1) {
            const allowed = allowedBySeed.get(seeds[i]);
            if (!allowed) continue;
            for (const id of allowed) {
                const n = byId.get(id);
                if (!n || String(n.kind || '') === 'junction') continue;
                if (codexPortraitRecordMatchesActiveFilters(n)) continue;
                connectionEndpointNodeIds.add(id);
            }
        }
        return {
            reachableNodeIds: pruneGraph.nodeIds,
            linkedEdgePairKeys: null,
            activeEdgePairKeys: pruneGraph.edgePairKeys,
            connectionEndpointNodeIds,
        };
    }

    const graph = buildCodexFilterLinkGraph(allNodes, edges, seeds);
    /** @type {Map<string, object>} */
    const byId = new Map();
    for (let i = 0; i < (allNodes || []).length; i += 1) {
        const n = allNodes[i];
        if (n?.id) byId.set(n.id, n);
    }
    /** @type {Set<string>} */
    const activeEdgePairKeys = new Set();
    for (const pairKey of graph.edgePairKeys) {
        let prunedDirect = false;
        for (let i = 0; i < (edges || []).length; i += 1) {
            const e = edges[i];
            if (codexUnorderedPairKey(e.fromId, e.toId) !== pairKey) continue;
            prunedDirect = codexEdgeIsDirectPrunedPortraitLink(e, byId);
            break;
        }
        if (!prunedDirect) activeEdgePairKeys.add(pairKey);
    }

    return {
        reachableNodeIds: graph.nodeIds,
        linkedEdgePairKeys: graph.edgePairKeys.size > 0 ? graph.edgePairKeys : null,
        activeEdgePairKeys,
        connectionEndpointNodeIds: new Set(),
    };
}

/** @type {string} */
let codexFilterDerivedCacheKey = '';
/** @type {ReturnType<typeof computeCodexFilterDerivedState>|null} */
let codexFilterDerivedCache = null;

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {boolean} linkFiltersEnabled
 */
function codexFilterDerivedCacheSignature(allNodes, edges, linkFiltersEnabled) {
    const filters = getStandaloneActiveFiltersSet();
    const filterKey = filters ? [...filters].sort().join('\0') : '';
    const connLen = s.codexConnections?.length ?? 0;
    return `${filterKey}|${linkFiltersEnabled ? 1 : 0}|${(allNodes || []).length}|${(edges || []).length}|${connLen}`;
}

export function invalidateCodexFilterDerivedCache() {
    codexFilterDerivedCacheKey = '';
    codexFilterDerivedCache = null;
    invalidateCodexHiddenConnectionPathCache();
}

/**
 * Cached filter graph — recomputed only when filters, link toggle, graph, or connections change.
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {boolean} linkFiltersEnabled
 */
export function getCodexFilterDerivedState(allNodes, edges, linkFiltersEnabled) {
    const key = codexFilterDerivedCacheSignature(allNodes, edges, linkFiltersEnabled);
    if (codexFilterDerivedCache && codexFilterDerivedCacheKey === key) {
        return codexFilterDerivedCache;
    }
    codexFilterDerivedCache = computeCodexFilterDerivedState(allNodes, edges, linkFiltersEnabled);
    codexFilterDerivedCacheKey = key;
    return codexFilterDerivedCache;
}

/**
 * @param {object[]} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {boolean} linkFiltersEnabled
 */
export function buildCodexFilterDerivedGraph(allNodes, edges, linkFiltersEnabled) {
    const state = getCodexFilterDerivedState(allNodes, edges, linkFiltersEnabled);
    return {
        reachableNodeIds: state.reachableNodeIds,
        linkedEdgePairKeys: state.linkedEdgePairKeys,
        activeEdgePairKeys: state.activeEdgePairKeys,
    };
}

/**
 * Non-matching portraits on prune-aware active filter cords — partially dimmed, still selectable.
 * Prefer {@link getCodexFilterDerivedState} to avoid a second cache lookup.
 * @param {object[]} allNodes
 * @param {boolean} linkFiltersEnabled
 * @returns {Set<string>}
 */
export function buildCodexFilterConnectionEndpointNodeIds(allNodes, linkFiltersEnabled) {
    return getCodexFilterDerivedState(
        allNodes,
        s.codexEdges || [],
        linkFiltersEnabled,
    ).connectionEndpointNodeIds;
}

/**
 * @param {{ fromId: string, toId: string }} edge
 * @param {Set<string>|null|undefined} activeEdgePairKeys
 */
export function codexEdgeMatchesActiveFilters(edge, activeEdgePairKeys) {
    if (!codexFiltersActive()) return true;
    if (!edge?.fromId || !edge?.toId) return false;
    if (!activeEdgePairKeys || activeEdgePairKeys.size === 0) return false;
    return activeEdgePairKeys.has(codexUnorderedPairKey(edge.fromId, edge.toId));
}
