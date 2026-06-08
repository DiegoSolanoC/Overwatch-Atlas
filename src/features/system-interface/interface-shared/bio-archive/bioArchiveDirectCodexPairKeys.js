/**
 * Codex-backed archive pair keys: direct entity↔entity cords plus entity pairs linked only
 * through junction (“break”) waypoints — not transitive paths through other bio nodes.
 */

import { findCodexNodeIdForBioEntity } from '../../../codex/codex-edge-cords/topology/CodexBioEntityMatching.js';
import { normalizeBioNameLoose } from '../../../codex/codex-edge-cords/topology/CodexGraphPrimitives.js';

/**
 * @param {string} arch
 * @param {string} kind
 * @param {string} name
 */
function archiveEntitySignature(arch, kind, name) {
    const k = String(kind || 'hero').toLowerCase();
    const nk = k === 'faction' ? 'faction' : k === 'npc' ? 'npc' : 'hero';
    const n = String(name || '').trim();
    return `${arch}\0${nk}\0${normalizeBioNameLoose(n)}`;
}

/**
 * @param {string} a
 * @param {string} b
 */
function unorderedSigPairKey(a, b) {
    return a <= b ? `${a}\x1e${b}` : `${b}\x1e${a}`;
}

/**
 * @param {object} node
 * @returns {{ arch: string, kind: string, name: string } | null}
 */
function nodeToBioEntity(node) {
    if (!node || !node.kind) return null;
    if (node.kind === 'junction' || node.kind === 'country') return null;
    if (node.kind === 'hero') {
        const name = String(node.heroName || '').trim();
        return name ? { arch: 'heroes', kind: 'hero', name } : null;
    }
    if (node.kind === 'npc') {
        const name = String(node.npcName || '').trim();
        return name ? { arch: 'npcs', kind: 'npc', name } : null;
    }
    if (node.kind === 'faction') {
        const name = String(node.factionDisplay || node.factionFilename || '').trim();
        return name ? { arch: 'factions', kind: 'faction', name } : null;
    }
    return null;
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Map<string, Set<string>>}
 */
function buildUndirectedAdjacency(edges) {
    /** @type {Map<string, Set<string>>} */
    const adj = new Map();
    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        if (!adj.has(e.fromId)) adj.set(e.fromId, new Set());
        if (!adj.has(e.toId)) adj.set(e.toId, new Set());
        adj.get(e.fromId).add(e.toId);
        adj.get(e.toId).add(e.fromId);
    }
    return adj;
}

/**
 * @param {Map<string, object>} byId
 * @param {string} id
 */
function codexNodeIsJunction(byId, id) {
    return byId.get(id)?.kind === 'junction';
}

/**
 * @param {Map<string, object>} byId
 * @param {string} id
 */
function codexNodeIsBioEntity(byId, id) {
    const k = byId.get(id)?.kind;
    return k === 'hero' || k === 'faction' || k === 'npc';
}

/**
 * Entity pairs reachable from each bio node by walking junction waypoints only (no other bio hops).
 * @param {Map<string, object>} byId
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {(entA: { arch: string, kind: string, name: string }, entB: { arch: string, kind: string, name: string }) => void} onPair
 */
function forEachJunctionBridgedBioPair(byId, edges, onPair) {
    const adj = buildUndirectedAdjacency(edges);
    /** @type {Set<string>} */
    const seenPairKeys = new Set();

    for (const [startId] of byId) {
        if (!codexNodeIsBioEntity(byId, startId)) continue;
        const entA = nodeToBioEntity(byId.get(startId));
        if (!entA) continue;

        const seen = new Set([startId]);
        const queue = [startId];
        while (queue.length) {
            const cur = queue.shift();
            for (const nb of adj.get(cur) || []) {
                if (seen.has(nb)) continue;
                if (codexNodeIsBioEntity(byId, nb)) {
                    if (nb !== startId) {
                        const entB = nodeToBioEntity(byId.get(nb));
                        if (entB) {
                            const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
                            const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
                            if (sa && sb && sa !== sb) {
                                const pk = unorderedSigPairKey(sa, sb);
                                if (!seenPairKeys.has(pk)) {
                                    seenPairKeys.add(pk);
                                    onPair(entA, entB);
                                }
                            }
                        }
                    }
                    continue;
                }
                if (codexNodeIsJunction(byId, nb)) {
                    seen.add(nb);
                    queue.push(nb);
                }
            }
        }
    }
}

/**
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Set<string>}
 */
export function buildDirectCodexBioPairKeySet(nodes, edges) {
    /** @type {Set<string>} */
    const allowed = new Set();
    const byId = new Map();
    for (const n of nodes || []) {
        if (n?.id) byId.set(n.id, n);
    }

    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        const entA = nodeToBioEntity(byId.get(e.fromId));
        const entB = nodeToBioEntity(byId.get(e.toId));
        if (!entA || !entB) continue;
        const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
        const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
        if (sa && sb && sa !== sb) allowed.add(unorderedSigPairKey(sa, sb));
    }

    forEachJunctionBridgedBioPair(byId, edges, (entA, entB) => {
        const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
        const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
        if (sa && sb && sa !== sb) allowed.add(unorderedSigPairKey(sa, sb));
    });

    return allowed;
}

/**
 * Entity pairs to mirror into bio archives after a Codex save (direct + junction-bridged).
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {{ a: { arch: string, kind: string, name: string }, b: { arch: string, kind: string, name: string } }[]}
 */
export function collectCodexBioArchiveSyncPairEntities(nodes, edges) {
    /** @type {Map<string, { a: { arch: string, kind: string, name: string }, b: { arch: string, kind: string, name: string } }>} */
    const pairByKey = new Map();
    const byId = new Map();
    for (const n of nodes || []) {
        if (n?.id) byId.set(n.id, n);
    }

    function recordPair(entA, entB) {
        if (!entA || !entB) return;
        const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
        const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
        if (!sa || !sb || sa === sb) return;
        const pk = unorderedSigPairKey(sa, sb);
        if (pairByKey.has(pk)) return;
        pairByKey.set(pk, { a: entA, b: entB });
    }

    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        const entA = nodeToBioEntity(byId.get(e.fromId));
        const entB = nodeToBioEntity(byId.get(e.toId));
        if (entA && entB) recordPair(entA, entB);
    }

    forEachJunctionBridgedBioPair(byId, edges, recordPair);

    return [...pairByKey.values()];
}

/**
 * Bio portrait node ids reachable from `seedId` by walking junction waypoints only.
 * @param {string} seedId
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Set<string>}
 */
export function collectJunctionBridgedBioNodeIdsForSeed(seedId, nodes, edges) {
    /** @type {Set<string>} */
    const out = new Set();
    const byId = new Map();
    for (const n of nodes || []) {
        if (n?.id) byId.set(n.id, n);
    }
    if (!seedId || !byId.has(seedId)) return out;

    const adj = buildUndirectedAdjacency(edges);
    const seen = new Set([seedId]);
    const queue = [seedId];
    while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj.get(cur) || []) {
            if (seen.has(nb)) continue;
            if (codexNodeIsBioEntity(byId, nb)) {
                if (nb !== seedId) out.add(nb);
                continue;
            }
            if (codexNodeIsJunction(byId, nb)) {
                seen.add(nb);
                queue.push(nb);
            }
        }
    }
    return out;
}

/**
 * @param {string} subjectArch
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {string} linkedKind
 * @param {string} linkedName
 * @param {object[]} [codexNodes]
 */
/**
 * @param {string} fromId
 * @param {string} toId
 * @param {object[]} codexNodes
 * @returns {string}
 */
export function pairKeyForCodexBioNodeIds(fromId, toId, codexNodes) {
    if (!fromId || !toId || fromId === toId || !Array.isArray(codexNodes)) return '';
    const byId = new Map();
    for (const n of codexNodes) {
        if (n?.id) byId.set(n.id, n);
    }
    const entA = nodeToBioEntity(byId.get(fromId));
    const entB = nodeToBioEntity(byId.get(toId));
    if (!entA || !entB) return '';
    const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
    const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
    if (!sa || !sb || sa === sb) return '';
    return unorderedSigPairKey(sa, sb);
}

export function pairKeyForBioArchiveConnection(
    subjectArch,
    subjectKind,
    linkedKind,
    subjectName,
    linkedName,
    codexNodes,
) {
    let lk = String(linkedKind || 'hero').toLowerCase();
    if (lk === 'character') lk = 'hero';
    if (lk !== 'faction' && lk !== 'npc') lk = 'hero';

    let linkedArch = 'heroes';
    if (lk === 'faction') linkedArch = 'factions';
    else if (lk === 'npc') linkedArch = 'npcs';

    const sk = String(subjectKind || 'hero').toLowerCase();
    const subArch = String(subjectArch || 'heroes');

    let subName = String(subjectName || '').trim();
    let linkName = String(linkedName || '').trim();
    if (codexNodes?.length) {
        const subId = findCodexNodeIdForBioEntity(sk, subName, codexNodes);
        const linkId = findCodexNodeIdForBioEntity(lk, linkName, codexNodes);
        for (const n of codexNodes) {
            if (n?.id === subId && n.kind === 'hero') subName = String(n.heroName || subName).trim();
            if (n?.id === linkId) {
                if (n.kind === 'hero') linkName = String(n.heroName || linkName).trim();
                else if (n.kind === 'npc') linkName = String(n.npcName || linkName).trim();
                else if (n.kind === 'faction') {
                    linkName = String(n.factionDisplay || n.factionFilename || linkName).trim();
                }
            }
        }
    }

    const sa = archiveEntitySignature(subArch, sk, subName);
    const sb = archiveEntitySignature(linkedArch, lk, linkName);
    if (!sa || !sb || sa === sb) return '';
    return unorderedSigPairKey(sa, sb);
}
