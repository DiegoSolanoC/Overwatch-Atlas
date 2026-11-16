/**
 * Extract a Codex “ego” subgraph for a Gallery connection canvas:
 * subject + displayable linked bios + junction-only paths between them
 * (same hop rules as Codex connection resolution / targeted route preview).
 */

import { findCodexNodeIdForBioEntity } from '../../codex/codex-edge-cords/topology/CodexBioEntityMatching.js';
import {
    buildCodexUndirectedAdjacency,
    shortestPathNodeIdsForTargetedRoutePreview,
} from '../../codex/codex-controls-ui/stage/CodexTargetedSelection.js';
import { normalizeBioNameLoose } from '../../codex/codex-edge-cords/topology/CodexGraphPrimitives.js';
import { resolveCodexConnectionsForSubject } from '../../codex/codex-connections/CodexConnectionMeta.js';

/**
 * @param {object|null|undefined} node
 * @param {'subject'|'linked'|null} role
 */
function galleryNodeFromCodexNode(node, role) {
    if (!node?.id) return null;
    const kind = String(node.kind || 'hero').toLowerCase();
    if (kind === 'junction') {
        return {
            id: node.id,
            kind: 'junction',
            role: null,
            entityKind: null,
            entityName: null,
            x: Number(node.x) || 0,
            y: Number(node.y) || 0,
            scale: node.scale,
            bgColor: node.bgColor,
            codexNodeId: node.id,
        };
    }

    let entityName = '';
    let portraitKey;
    let factionFilename;
    if (kind === 'hero') {
        entityName = String(node.heroName || '').trim();
        portraitKey = entityName || undefined;
    } else if (kind === 'npc') {
        entityName = String(node.npcName || '').trim();
        portraitKey = entityName || undefined;
    } else if (kind === 'faction') {
        factionFilename = String(node.factionFilename || '').trim() || undefined;
        entityName = String(node.factionDisplay || node.factionFilename || '').trim();
        portraitKey = factionFilename || entityName || undefined;
    } else {
        entityName = String(node.heroName || node.npcName || node.factionDisplay || '').trim();
    }

    return {
        id: node.id,
        kind,
        role: role || 'linked',
        entityKind: kind === 'faction' || kind === 'npc' || kind === 'hero' ? kind : 'hero',
        entityName,
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        scale: node.scale,
        bgColor: node.bgColor,
        factionFilename,
        portraitKey,
        codexNodeId: node.id,
    };
}

/**
 * @param {string[]} path
 * @param {Set<string>} nodeIds
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Set<string>} edgeKeys
 */
function addPathToSubgraph(path, nodeIds, edges, edgeKeys) {
    if (!path?.length) return;
    for (let i = 0; i < path.length; i += 1) nodeIds.add(path[i]);
    for (let j = 0; j < path.length - 1; j += 1) {
        const a = path[j];
        const b = path[j + 1];
        if (!a || !b || a === b) continue;
        const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
        if (edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        edges.push({ fromId: a, toId: b });
    }
}

/**
 * @param {{ kind: string, name: string }} ent
 * @param {object[]} nodes
 * @param {string} [filterKey]
 */
function resolveEntityCodexId(ent, nodes, filterKey) {
    const kind = String(ent?.kind || 'hero').toLowerCase();
    const name = String(ent?.name || '').trim();
    if (!name) return '';
    let id = findCodexNodeIdForBioEntity(kind, name, nodes);
    if (id) return id;
    if (kind === 'faction' && filterKey) {
        id = findCodexNodeIdForBioEntity('faction', filterKey, nodes);
    }
    return id || '';
}

/**
 * @param {object} opts
 * @param {'hero'|'faction'|'npc'} opts.subjectKind
 * @param {string} opts.subjectName
 * @param {string} [opts.subjectFilterKey]
 * @param {{ kind: string, name: string }[]} opts.linkedEntities
 * @param {object[]} opts.codexNodes
 * @param {{ fromId: string, toId: string }[]} opts.codexEdges
 * @param {object[]} [opts.codexConnections] Codex connection meta rows
 * @param {boolean} [opts.includeAuthoredPeerPaths=true] when two linked bios on this
 *   ego canvas also have a displayable (non-pruned) Codex connection to each other
 *   (e.g. Reaper↔Widowmaker on Doomfist’s board), import that junction path too.
 *   Mesh-only / pruned pairs (e.g. Sombra↔Orisa) are skipped.
 * @returns {{
 *   ok: boolean,
 *   subjectCodexId: string,
 *   nodes: object[],
 *   edges: { fromId: string, toId: string }[],
 *   linkedCodexIds: Map<string, string>,
 * } | null}
 */
export function extractCodexEgoSubgraphForGallery(opts) {
    const codexNodes = Array.isArray(opts?.codexNodes) ? opts.codexNodes : [];
    const codexEdges = Array.isArray(opts?.codexEdges) ? opts.codexEdges : [];
    const codexConnections = Array.isArray(opts?.codexConnections) ? opts.codexConnections : [];
    const linkedEntities = Array.isArray(opts?.linkedEntities) ? opts.linkedEntities : [];
    if (!codexNodes.length) return null;

    const subjectKind = String(opts.subjectKind || 'hero').toLowerCase();
    const subjectName = String(opts.subjectName || '').trim();
    const subjectFilterKey = String(opts.subjectFilterKey || '').trim();
    if (!subjectName) return null;

    const subjectCodexId =
        findCodexNodeIdForBioEntity(subjectKind, subjectName, codexNodes)
        || (subjectKind === 'faction' && subjectFilterKey
            ? findCodexNodeIdForBioEntity('faction', subjectFilterKey, codexNodes)
            : '');
    if (!subjectCodexId) return null;

    /** @type {Map<string, string>} entityKey → codex id */
    const linkedCodexIds = new Map();
    for (let i = 0; i < linkedEntities.length; i += 1) {
        const ent = linkedEntities[i];
        const id = resolveEntityCodexId(ent, codexNodes, '');
        if (!id || id === subjectCodexId) continue;
        const key = `${String(ent.kind || 'hero').toLowerCase()}:${normalizeBioNameLoose(ent.name)}`;
        linkedCodexIds.set(key, id);
    }

    const adj = buildCodexUndirectedAdjacency(codexEdges);
    /** @type {Map<string, string>} */
    const kindById = new Map();
    for (let i = 0; i < codexNodes.length; i += 1) {
        const n = codexNodes[i];
        if (n?.id) kindById.set(n.id, n.kind || '');
    }

    /** @type {Set<string>} */
    const nodeIds = new Set([subjectCodexId]);
    /** @type {{ fromId: string, toId: string }[]} */
    const edges = [];
    /** @type {Set<string>} */
    const edgeKeys = new Set();

    const linkedIdList = [...new Set(linkedCodexIds.values())];
    for (let i = 0; i < linkedIdList.length; i += 1) {
        const goal = linkedIdList[i];
        const path = shortestPathNodeIdsForTargetedRoutePreview(
            adj,
            kindById,
            subjectCodexId,
            goal,
        );
        if (path?.length) {
            addPathToSubgraph(path, nodeIds, edges, edgeKeys);
        } else {
            // No junction path — still include the bio node; caller may add a spoke.
            nodeIds.add(goal);
        }
    }

    // Peer cords: only when two subject-linked bios have a real Codex connection
    // to each other (resolveCodexConnections skips pruned / hidden-in-intel).
    const includeAuthoredPeerPaths = opts.includeAuthoredPeerPaths !== false;
    if (includeAuthoredPeerPaths && linkedEntities.length > 1) {
        /** @type {Map<string, { kind: string, name: string, id: string }>} */
        const linkedByKey = new Map();
        linkedCodexIds.forEach((id, key) => {
            const ent = linkedEntities.find(
                (row) => `${String(row.kind || 'hero').toLowerCase()}:${normalizeBioNameLoose(row.name)}` === key,
            );
            if (ent) linkedByKey.set(key, { kind: ent.kind, name: ent.name, id });
        });

        /** @type {Set<string>} */
        const peerPairDone = new Set();
        linkedByKey.forEach((fromEnt) => {
            const rows = resolveCodexConnectionsForSubject(
                fromEnt.kind,
                fromEnt.name,
                codexNodes,
                codexEdges,
                codexConnections,
                { forEdit: false },
            );
            for (let r = 0; r < rows.length; r += 1) {
                const row = rows[r];
                const toKey = `${String(row.kind || 'hero').toLowerCase()}:${normalizeBioNameLoose(row.name)}`;
                const toEnt = linkedByKey.get(toKey);
                if (!toEnt || toEnt.id === fromEnt.id) continue;
                const pairKey = fromEnt.id < toEnt.id
                    ? `${fromEnt.id}\0${toEnt.id}`
                    : `${toEnt.id}\0${fromEnt.id}`;
                if (peerPairDone.has(pairKey)) continue;
                peerPairDone.add(pairKey);
                const path = shortestPathNodeIdsForTargetedRoutePreview(
                    adj,
                    kindById,
                    fromEnt.id,
                    toEnt.id,
                );
                if (path?.length) addPathToSubgraph(path, nodeIds, edges, edgeKeys);
                else {
                    // No junction path — still add a direct spoke between peers.
                    nodeIds.add(fromEnt.id);
                    nodeIds.add(toEnt.id);
                    if (!edgeKeys.has(pairKey)) {
                        edgeKeys.add(pairKey);
                        edges.push({ fromId: fromEnt.id, toId: toEnt.id });
                    }
                }
            }
        });
    }

    const byId = new Map();
    for (let i = 0; i < codexNodes.length; i += 1) {
        const n = codexNodes[i];
        if (n?.id) byId.set(n.id, n);
    }

    /** @type {object[]} */
    const nodes = [];
    nodeIds.forEach((id) => {
        const src = byId.get(id);
        if (!src) return;
        const role = id === subjectCodexId ? 'subject' : (src.kind === 'junction' ? null : 'linked');
        const row = galleryNodeFromCodexNode(src, role);
        if (row) nodes.push(row);
    });

    return {
        ok: nodes.length > 0,
        subjectCodexId,
        nodes,
        edges,
        linkedCodexIds,
    };
}

/**
 * Axis-aligned bounds for gallery world sizing.
 * @param {object[]} nodes
 * @param {number} [pad]
 */
export function boundsForGalleryCanvasNodes(nodes, pad = 280) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const list = Array.isArray(nodes) ? nodes : [];
    for (let i = 0; i < list.length; i += 1) {
        const n = list[i];
        if (!n) continue;
        const x = Number(n.x) || 0;
        const y = Number(n.y) || 0;
        const scale = Math.max(0.5, Number(n.scale) || 1);
        const size = (n.kind === 'junction' ? 28 : 120) * scale;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + size);
        maxY = Math.max(maxY, y + size);
    }
    if (!Number.isFinite(minX)) {
        return { minX: 0, minY: 0, maxX: 3200, maxY: 2400, width: 3200, height: 2400 };
    }
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(800, maxX - minX),
        height: Math.max(600, maxY - minY),
    };
}
