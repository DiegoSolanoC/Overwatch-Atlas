/**
 * Build / merge gallery personal connection canvas graph from archive entry + saved layout.
 *
 * Default (no save): Codex ego subgraph — subject + linked bios + junction paths
 * at Codex coordinates (filtered-Codex look).
 *
 * With a save: keep edited positions; pull in NEW linked entities / Codex paths
 * when the Codex gains connections (incremental). Full Codex reimports can still
 * be cleaned up manually after open.
 */

import { resolveCodexConnectionsForSubject } from '../../codex/codex-connections/CodexConnectionMeta.js';
import { normalizeBioNameLoose } from '../../codex/codex-edge-cords/topology/CodexGraphPrimitives.js';
import { bioConnectionRowIsDisplayable } from '../../system-interface/interface-shared/bio-archive/bioArchiveConnectionRows.js';
import {
    boundsForGalleryCanvasNodes,
    extractCodexEgoSubgraphForGallery,
} from './galleryConnectionCanvasCodexSeed.js';

export const GALLERY_CONN_CANVAS_VERSION = 1;
/** Fallback world when no Codex seed (legacy ring). */
export const GALLERY_CONN_CANVAS_WORLD_W = 3200;
export const GALLERY_CONN_CANVAS_WORLD_H = 2400;

export const GALLERY_CONN_DEFAULT_DISPLAY = {
    showAngles: true,
    showBreaks: true,
    showPackets: true,
    snapAngles: true,
};

export const GALLERY_CONN_SUBJECT_NODE_ID = 'gcc-subject';

/**
 * @param {'hero'|'faction'|'npc'} kind
 * @param {string} name
 */
export function galleryLinkedNodeId(kind, name) {
    const k = String(kind || 'hero').toLowerCase();
    const n = String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `gcc-link-${k}-${n || 'unknown'}`;
}

/**
 * @param {string} kind
 */
function normalizeConnKind(kind) {
    const x = String(kind || 'hero').toLowerCase();
    if (x === 'character') return 'hero';
    if (x === 'faction' || x === 'npc') return x;
    return 'hero';
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
function subjectKindFromCategory(category) {
    if (category === 'factions') return 'faction';
    if (category === 'npcs') return 'npc';
    return 'hero';
}

/**
 * @param {object|null} entry
 * @param {string} displayName
 */
function subjectNameFromEntry(entry, displayName) {
    if (entry?.name != null && String(entry.name).trim()) return String(entry.name).trim();
    return String(displayName || '').trim();
}

/**
 * @param {object|null} entry
 * @returns {{ kind: string, name: string }[]}
 */
export function listDisplayableConnectionEntities(entry) {
    const rows = Array.isArray(entry?.connections) ? entry.connections : [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!bioConnectionRowIsDisplayable(row)) continue;
        const kind = normalizeConnKind(row.kind);
        const name = row.name != null ? String(row.name).trim() : '';
        if (!name) continue;
        const key = `${kind}:${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ kind, name });
    }
    return out;
}

/**
 * @param {number} count
 * @param {number} index
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 */
function defaultLinkedPosition(count, index, cx, cy, radius) {
    if (count <= 0) return { x: cx + radius, y: cy };
    const angle = (-Math.PI / 2) + (index / Math.max(1, count)) * Math.PI * 2;
    return {
        x: Math.round(cx + Math.cos(angle) * radius),
        y: Math.round(cy + Math.sin(angle) * radius),
    };
}

/**
 * @param {object|null|undefined} saved
 * @returns {object|null}
 */
function normalizeSavedCanvas(saved) {
    if (!saved || typeof saved !== 'object') return null;
    if (Number(saved.v) !== GALLERY_CONN_CANVAS_VERSION) return null;
    if (!Array.isArray(saved.nodes) || !Array.isArray(saved.edges)) return null;
    return saved;
}

/**
 * @param {string} kind
 * @param {string} name
 */
function linkedEntityKey(kind, name) {
    return `${normalizeConnKind(kind)}:${normalizeBioNameLoose(name)}`;
}

/**
 * @param {object} node
 */
function nodeEntityKey(node) {
    if (!node || node.kind === 'junction') return '';
    const kind = normalizeConnKind(node.entityKind || node.kind);
    const name = node.entityName != null ? String(node.entityName).trim() : '';
    if (!name) return '';
    return linkedEntityKey(kind, name);
}

/**
 * @param {object[]} savedNodes
 * @param {{ kind: string, name: string }} ent
 */
function findSavedLinkedNode(savedNodes, ent) {
    const key = linkedEntityKey(ent.kind, ent.name);
    const legacyId = galleryLinkedNodeId(ent.kind, ent.name);
    for (let i = 0; i < savedNodes.length; i += 1) {
        const n = savedNodes[i];
        if (!n || n.kind === 'junction') continue;
        if (n.id === legacyId) return n;
        if (nodeEntityKey(n) === key) return n;
        if (
            normalizeConnKind(n.entityKind || n.kind) === normalizeConnKind(ent.kind)
            && normalizeBioNameLoose(n.entityName) === normalizeBioNameLoose(ent.name)
        ) {
            return n;
        }
    }
    return null;
}

/**
 * @param {object[]} savedNodes
 */
function findSavedSubjectNode(savedNodes) {
    for (let i = 0; i < savedNodes.length; i += 1) {
        const n = savedNodes[i];
        if (!n) continue;
        if (n.id === GALLERY_CONN_SUBJECT_NODE_ID || n.role === 'subject') return n;
    }
    return null;
}

/**
 * True when subject↔target is only a direct edge (no intermediate nodes) — typical ring default.
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {string} subjectId
 * @param {string} targetId
 */
function hasOnlyDirectSpoke(edges, subjectId, targetId) {
    let direct = false;
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e) continue;
        const hits =
            (e.fromId === subjectId && e.toId === targetId)
            || (e.fromId === targetId && e.toId === subjectId);
        if (hits) direct = true;
    }
    if (!direct) return false;
    // Any other edge incident to target that isn't the subject spoke means a richer path.
    for (let j = 0; j < edges.length; j += 1) {
        const e = edges[j];
        if (!e) continue;
        const touchesTarget = e.fromId === targetId || e.toId === targetId;
        if (!touchesTarget) continue;
        const other = e.fromId === targetId ? e.toId : e.fromId;
        if (other !== subjectId) return false;
    }
    return true;
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {string} startId
 * @param {string} targetId
 */
function reachesNode(edges, startId, targetId) {
    if (startId === targetId) return true;
    const seen = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
        const cur = queue.shift();
        for (let i = 0; i < edges.length; i += 1) {
            const e = edges[i];
            if (!e) continue;
            let next = '';
            if (e.fromId === cur) next = e.toId;
            else if (e.toId === cur) next = e.fromId;
            if (!next || seen.has(next)) continue;
            if (next === targetId) return true;
            seen.add(next);
            queue.push(next);
        }
    }
    return false;
}

/**
 * @param {string} a
 * @param {string} b
 */
function undirectedEdgeKey(a, b) {
    return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * BFS path in an undirected edge list.
 * @param {{ fromId: string, toId: string }[]} edgeList
 * @param {string} startId
 * @param {string} goalId
 * @returns {string[]|null}
 */
function undirectedPathIds(edgeList, startId, goalId) {
    if (!startId || !goalId) return null;
    if (startId === goalId) return [startId];
    const adj = new Map();
    for (let i = 0; i < edgeList.length; i += 1) {
        const e = edgeList[i];
        if (!e?.fromId || !e?.toId) continue;
        if (!adj.has(e.fromId)) adj.set(e.fromId, []);
        if (!adj.has(e.toId)) adj.set(e.toId, []);
        adj.get(e.fromId).push(e.toId);
        adj.get(e.toId).push(e.fromId);
    }
    const prev = new Map([[startId, null]]);
    const q = [startId];
    while (q.length) {
        const cur = q.shift();
        for (const nb of adj.get(cur) || []) {
            if (prev.has(nb)) continue;
            prev.set(nb, cur);
            if (nb === goalId) {
                const path = [];
                let c = nb;
                while (c != null) {
                    path.push(c);
                    c = prev.get(c);
                }
                return path.reverse();
            }
            q.push(nb);
        }
    }
    return null;
}

/**
 * Adopt one undirected path from the Codex seed onto the canvas.
 * Existing node poses are kept; missing nodes take Codex coordinates.
 *
 * @param {Map<string, object>} nodeById
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Set<string>} edgeSet
 * @param {string[]} path
 * @param {object[]} seedNodes
 */
function adoptSeedPath(nodeById, edges, edgeSet, path, seedNodes) {
    if (!path?.length) return;
    const seedById = new Map(seedNodes.map((n) => [n.id, n]));
    for (let i = 0; i < path.length; i += 1) {
        const id = path[i];
        if (nodeById.has(id)) continue;
        const src = seedById.get(id);
        if (src) nodeById.set(id, { ...src });
    }
    for (let i = 0; i < path.length - 1; i += 1) {
        const a = path[i];
        const b = path[i + 1];
        if (!nodeById.has(a) || !nodeById.has(b)) continue;
        const key = undirectedEdgeKey(a, b);
        if (edgeSet.has(key)) continue;
        edges.push({ fromId: a, toId: b });
        edgeSet.add(key);
    }
}

/**
 * Merge Codex path edges that only involve nodes already on the canvas plus new junctions.
 * Used when upgrading a bare spoke to a Codex junction path while keeping endpoint positions.
 *
 * @param {Map<string, object>} nodeById
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Set<string>} edgeSet
 * @param {string} subjectId
 * @param {string} linkedId
 * @param {object[]} seedNodes
 * @param {{ fromId: string, toId: string }[]} seedEdges
 */
function upgradeDirectSpokeWithCodexPath(
    nodeById,
    edges,
    edgeSet,
    subjectId,
    linkedId,
    seedNodes,
    seedEdges,
) {
    if (!hasOnlyDirectSpoke(edges, subjectId, linkedId)) return false;
    const path = undirectedPathIds(seedEdges, subjectId, linkedId);
    if (!path || path.length < 3) return false;

    for (let i = edges.length - 1; i >= 0; i -= 1) {
        const e = edges[i];
        if (!e) continue;
        if (
            (e.fromId === subjectId && e.toId === linkedId)
            || (e.fromId === linkedId && e.toId === subjectId)
        ) {
            edgeSet.delete(undirectedEdgeKey(e.fromId, e.toId));
            edges.splice(i, 1);
        }
    }
    adoptSeedPath(nodeById, edges, edgeSet, path, seedNodes);
    return true;
}

/**
 * Legacy ring layout when Codex seed is unavailable.
 */
function buildRingFallbackModel(
    subjectKind,
    subjectEntityToken,
    linkedEntities,
    saved,
) {
    const cx = Math.round(GALLERY_CONN_CANVAS_WORLD_W * 0.38);
    const cy = Math.round(GALLERY_CONN_CANVAS_WORLD_H * 0.5);
    const radius = Math.min(GALLERY_CONN_CANVAS_WORLD_W, GALLERY_CONN_CANVAS_WORLD_H) * 0.28;

    /** @type {Map<string, object>} */
    const nodeById = new Map();
    const savedNodes = Array.isArray(saved?.nodes) ? saved.nodes : [];
    const savedSubject = findSavedSubjectNode(savedNodes);

    nodeById.set(GALLERY_CONN_SUBJECT_NODE_ID, {
        id: GALLERY_CONN_SUBJECT_NODE_ID,
        kind: subjectKind,
        role: 'subject',
        entityKind: subjectKind,
        entityName: subjectEntityToken,
        x: savedSubject?.x ?? cx - 40,
        y: savedSubject?.y ?? cy - 40,
        scale: savedSubject?.scale,
        bgColor: savedSubject?.bgColor,
        factionFilename: savedSubject?.factionFilename,
        portraitKey: savedSubject?.portraitKey,
    });

    for (let i = 0; i < linkedEntities.length; i += 1) {
        const { kind, name } = linkedEntities[i];
        const id = galleryLinkedNodeId(kind, name);
        const savedNode = findSavedLinkedNode(savedNodes, { kind, name });
        const pos = savedNode
            ? { x: savedNode.x, y: savedNode.y }
            : defaultLinkedPosition(linkedEntities.length, i, cx, cy, radius);
        nodeById.set(id, {
            id,
            kind,
            role: 'linked',
            entityKind: kind,
            entityName: name,
            x: pos.x,
            y: pos.y,
            scale: savedNode?.scale,
            bgColor: savedNode?.bgColor,
            factionFilename: savedNode?.factionFilename,
            portraitKey: savedNode?.portraitKey,
        });
    }

    for (let j = 0; j < savedNodes.length; j += 1) {
        const sn = savedNodes[j];
        if (!sn || !sn.id || sn.kind !== 'junction') continue;
        if (nodeById.has(sn.id)) continue;
        nodeById.set(sn.id, { ...sn });
    }

    /** @type {{ fromId: string, toId: string }[]} */
    let edges = [];
    const savedEdges = Array.isArray(saved?.edges) ? saved.edges : [];
    if (savedEdges.length > 0) {
        const validIds = new Set(nodeById.keys());
        edges = savedEdges.filter(
            (e) => e && e.fromId && e.toId && validIds.has(e.fromId) && validIds.has(e.toId),
        );
    }
    const edgeSet = new Set(edges.map((e) => undirectedEdgeKey(e.fromId, e.toId)));
    for (let k = 0; k < linkedEntities.length; k += 1) {
        const { kind, name } = linkedEntities[k];
        const linkedId = galleryLinkedNodeId(kind, name);
        if (reachesNode(edges, GALLERY_CONN_SUBJECT_NODE_ID, linkedId)) continue;
        const key = undirectedEdgeKey(GALLERY_CONN_SUBJECT_NODE_ID, linkedId);
        if (edgeSet.has(key)) continue;
        edges.push({ fromId: GALLERY_CONN_SUBJECT_NODE_ID, toId: linkedId });
        edgeSet.add(key);
    }

    return {
        nodeById,
        edges,
        worldW: GALLERY_CONN_CANVAS_WORLD_W,
        worldH: GALLERY_CONN_CANVAS_WORLD_H,
    };
}

/**
 * @param {object|null} entry
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} displayName
 * @param {string} filterKey
 * @param {object|null|undefined} savedCanvas
 * @param {{ nodes?: object[], edges?: object[], connections?: object[] } | null | undefined} [codexGraph]
 */
export function buildGalleryConnectionCanvasModel(
    entry,
    category,
    displayName,
    filterKey,
    savedCanvas,
    codexGraph = null,
) {
    const subjectKind = subjectKindFromCategory(category);
    const subjectName = subjectNameFromEntry(entry, displayName);
    const subjectEntityToken =
        subjectKind === 'faction' || subjectKind === 'npc'
            ? String(filterKey || subjectName).trim()
            : subjectName;
    const linkedEntities = listDisplayableConnectionEntities(entry);
    const saved = normalizeSavedCanvas(savedCanvas);
    const savedNodes = Array.isArray(saved?.nodes) ? saved.nodes : [];
    const savedEdges = Array.isArray(saved?.edges) ? saved.edges : [];

    // Subject → each linked path only (junctions/breaks included). Peer cords among
    // neighbors are added lightly later — full peer path mesh explodes the subgraph.
    const seed = codexGraph?.nodes?.length
        ? extractCodexEgoSubgraphForGallery({
            subjectKind,
            subjectName,
            subjectFilterKey: filterKey,
            linkedEntities,
            codexNodes: codexGraph.nodes,
            codexEdges: codexGraph.edges || [],
            includePeerPaths: false,
        })
        : null;

    /** @type {Map<string, object>} */
    let nodeById = new Map();
    /** @type {{ fromId: string, toId: string }[]} */
    let edges = [];
    let worldW = GALLERY_CONN_CANVAS_WORLD_W;
    let worldH = GALLERY_CONN_CANVAS_WORLD_H;

    if (!seed?.ok) {
        const ring = buildRingFallbackModel(subjectKind, subjectEntityToken, linkedEntities, saved);
        nodeById = ring.nodeById;
        edges = ring.edges;
        worldW = ring.worldW;
        worldH = ring.worldH;
    } else if (!saved) {
        // Fresh canvas: pure Codex ego subgraph.
        for (let i = 0; i < seed.nodes.length; i += 1) {
            const n = seed.nodes[i];
            nodeById.set(n.id, { ...n });
        }
        // Ensure subject role/token for faction filter keys.
        const sub = nodeById.get(seed.subjectCodexId);
        if (sub) {
            sub.role = 'subject';
            sub.entityKind = subjectKind;
            sub.entityName = subjectEntityToken;
        }
        edges = seed.edges.map((e) => ({ fromId: e.fromId, toId: e.toId }));
        // Orphan linked bios with no path: spoke fallback at Codex coords already in seed nodes.
        const edgeSetFresh = new Set(edges.map((e) => undirectedEdgeKey(e.fromId, e.toId)));
        seed.linkedCodexIds.forEach((linkedId) => {
            if (reachesNode(edges, seed.subjectCodexId, linkedId)) return;
            const key = undirectedEdgeKey(seed.subjectCodexId, linkedId);
            if (edgeSetFresh.has(key)) return;
            edges.push({ fromId: seed.subjectCodexId, toId: linkedId });
            edgeSetFresh.add(key);
        });
    } else {
        // Incremental merge onto an existing personal canvas.
        const edgeSet = new Set();
        const subjectSeed = seed.nodes.find((n) => n.id === seed.subjectCodexId);
        const savedSubject = findSavedSubjectNode(savedNodes);

        // Prefer Codex id for subject going forward; preserve saved pose.
        const subjectId = seed.subjectCodexId;
        nodeById.set(subjectId, {
            ...(subjectSeed || {}),
            id: subjectId,
            kind: subjectKind,
            role: 'subject',
            entityKind: subjectKind,
            entityName: subjectEntityToken,
            x: savedSubject?.x ?? subjectSeed?.x ?? 0,
            y: savedSubject?.y ?? subjectSeed?.y ?? 0,
            scale: savedSubject?.scale ?? subjectSeed?.scale,
            bgColor: savedSubject?.bgColor ?? subjectSeed?.bgColor,
            factionFilename: savedSubject?.factionFilename ?? subjectSeed?.factionFilename,
            portraitKey: savedSubject?.portraitKey ?? subjectSeed?.portraitKey,
            codexNodeId: subjectId,
        });

        /** @type {Set<string>} */
        const newLinkedCodexIds = new Set();
        /** @type {Map<string, string>} entityKey → canvas node id */
        const linkedCanvasIds = new Map();

        for (let i = 0; i < linkedEntities.length; i += 1) {
            const ent = linkedEntities[i];
            const key = linkedEntityKey(ent.kind, ent.name);
            const codexId = seed.linkedCodexIds.get(key);
            const savedNode = findSavedLinkedNode(savedNodes, ent);
            const seedNode = codexId
                ? seed.nodes.find((n) => n.id === codexId)
                : null;

            if (savedNode) {
                // Keep pose; migrate id to Codex id when available so new paths can attach.
                const id = codexId || savedNode.id;
                if (codexId && savedNode.id !== codexId && !nodeById.has(codexId)) {
                    // Remap later in edges
                }
                nodeById.set(id, {
                    ...seedNode,
                    ...savedNode,
                    id,
                    kind: normalizeConnKind(ent.kind),
                    role: 'linked',
                    entityKind: normalizeConnKind(ent.kind),
                    entityName: ent.name,
                    x: savedNode.x,
                    y: savedNode.y,
                    scale: savedNode.scale ?? seedNode?.scale,
                    bgColor: savedNode.bgColor ?? seedNode?.bgColor,
                    codexNodeId: codexId || savedNode.codexNodeId,
                });
                linkedCanvasIds.set(key, id);
            } else if (seedNode) {
                nodeById.set(seedNode.id, { ...seedNode, role: 'linked' });
                linkedCanvasIds.set(key, seedNode.id);
                newLinkedCodexIds.add(seedNode.id);
            } else {
                const id = galleryLinkedNodeId(ent.kind, ent.name);
                const bounds = boundsForGalleryCanvasNodes([...nodeById.values()], 0);
                nodeById.set(id, {
                    id,
                    kind: normalizeConnKind(ent.kind),
                    role: 'linked',
                    entityKind: normalizeConnKind(ent.kind),
                    entityName: ent.name,
                    x: bounds.maxX + 180,
                    y: bounds.minY + 120 + i * 140,
                });
                linkedCanvasIds.set(key, id);
            }
        }

        // Keep user junctions still referenced by saved edges among kept ids
        // (after remapping subject/link ids).
        /** @type {Map<string, string>} oldId → newId */
        const idRemap = new Map();
        if (savedSubject && savedSubject.id !== subjectId) {
            idRemap.set(savedSubject.id, subjectId);
        }
        linkedCanvasIds.forEach((newId, key) => {
            const entKind = key.split(':')[0];
            const entNameLoose = key.slice(key.indexOf(':') + 1);
            // Find old saved id for same entity
            for (let s = 0; s < savedNodes.length; s += 1) {
                const sn = savedNodes[s];
                if (!sn || sn.kind === 'junction') continue;
                if (nodeEntityKey(sn) === key || sn.id === galleryLinkedNodeId(entKind, sn.entityName || '')) {
                    if (sn.id !== newId) idRemap.set(sn.id, newId);
                }
                void entNameLoose;
            }
        });

        const remap = (id) => idRemap.get(id) || id;

        // Restore saved edges among nodes we kept (+ junctions).
        for (let j = 0; j < savedNodes.length; j += 1) {
            const sn = savedNodes[j];
            if (!sn?.id || sn.kind !== 'junction') continue;
            nodeById.set(sn.id, { ...sn });
        }

        for (let e = 0; e < savedEdges.length; e += 1) {
            const raw = savedEdges[e];
            if (!raw?.fromId || !raw?.toId) continue;
            const fromId = remap(raw.fromId);
            const toId = remap(raw.toId);
            if (!nodeById.has(fromId) || !nodeById.has(toId)) continue;
            const key = undirectedEdgeKey(fromId, toId);
            if (edgeSet.has(key)) continue;
            edges.push({ fromId, toId });
            edgeSet.add(key);
        }

        // Drop junctions that are no longer on any kept edge.
        const junctionUsed = new Set();
        for (let e = 0; e < edges.length; e += 1) {
            const ed = edges[e];
            if (nodeById.get(ed.fromId)?.kind === 'junction') junctionUsed.add(ed.fromId);
            if (nodeById.get(ed.toId)?.kind === 'junction') junctionUsed.add(ed.toId);
        }
        [...nodeById.keys()].forEach((id) => {
            const n = nodeById.get(id);
            if (n?.kind === 'junction' && !junctionUsed.has(id)) nodeById.delete(id);
        });

        // Codex paths for newly introduced linked bios (incremental Codex updates).
        newLinkedCodexIds.forEach((linkedId) => {
            const path = undirectedPathIds(seed.edges, subjectId, linkedId);
            if (path?.length) {
                adoptSeedPath(nodeById, edges, edgeSet, path, seed.nodes);
                return;
            }
            if (!reachesNode(edges, subjectId, linkedId)) {
                const key = undirectedEdgeKey(subjectId, linkedId);
                if (!edgeSet.has(key)) {
                    edges.push({ fromId: subjectId, toId: linkedId });
                    edgeSet.add(key);
                }
            }
        });

        // Upgrade bare spokes → Codex junction paths (migrates old ring defaults).
        linkedCanvasIds.forEach((linkedId) => {
            if (!nodeById.has(linkedId)) return;
            upgradeDirectSpokeWithCodexPath(
                nodeById,
                edges,
                edgeSet,
                subjectId,
                linkedId,
                seed.nodes,
                seed.edges,
            );
        });

        // Ensure connectivity subject → each linked.
        linkedCanvasIds.forEach((linkedId) => {
            if (reachesNode(edges, subjectId, linkedId)) return;
            const key = undirectedEdgeKey(subjectId, linkedId);
            if (edgeSet.has(key)) return;
            edges.push({ fromId: subjectId, toId: linkedId });
            edgeSet.add(key);
        });

        // Peer paths among linked when Codex connects them and canvas has no path yet.
        if (codexGraph) {
            const meta = Array.isArray(codexGraph.connections) ? codexGraph.connections : [];
            /** @type {Map<string, { kind: string, name: string, id: string }>} */
            const byKey = new Map();
            linkedCanvasIds.forEach((id, key) => {
                const ent = linkedEntities.find(
                    (row) => linkedEntityKey(row.kind, row.name) === key,
                );
                if (ent) byKey.set(key, { kind: ent.kind, name: ent.name, id });
            });
            byKey.forEach((fromEnt) => {
                const rows = resolveCodexConnectionsForSubject(
                    fromEnt.kind,
                    fromEnt.name,
                    codexGraph.nodes || [],
                    codexGraph.edges || [],
                    meta,
                    { forEdit: false },
                );
                for (let r = 0; r < rows.length; r += 1) {
                    const row = rows[r];
                    if (!bioConnectionRowIsDisplayable(row)) continue;
                    const toEnt = byKey.get(linkedEntityKey(row.kind, row.name));
                    if (!toEnt || toEnt.id === fromEnt.id) continue;
                    if (reachesNode(edges, fromEnt.id, toEnt.id)) continue;
                    const path = undirectedPathIds(seed.edges, fromEnt.id, toEnt.id);
                    if (path?.length) {
                        adoptSeedPath(nodeById, edges, edgeSet, path, seed.nodes);
                        continue;
                    }
                    const key = undirectedEdgeKey(fromEnt.id, toEnt.id);
                    if (!edgeSet.has(key)) {
                        edges.push({ fromId: fromEnt.id, toId: toEnt.id });
                        edgeSet.add(key);
                    }
                }
            });
        }
    }

    // World sized to content (Codex coords can be huge).
    const bounds = boundsForGalleryCanvasNodes([...nodeById.values()]);
    worldW = Math.max(GALLERY_CONN_CANVAS_WORLD_W, Math.ceil(bounds.width));
    worldH = Math.max(GALLERY_CONN_CANVAS_WORLD_H, Math.ceil(bounds.height));
    // If nodes sit far from origin, expand world to include maxX/maxY (not only width).
    worldW = Math.max(worldW, Math.ceil(bounds.maxX + 80));
    worldH = Math.max(worldH, Math.ceil(bounds.maxY + 80));

    return {
        nodes: Array.from(nodeById.values()),
        edges,
        worldW,
        worldH,
        contentBounds: bounds,
        view:
            saved?.view
            && typeof saved.view === 'object'
            && Number.isFinite(Number(saved.view.zoom))
            && Number(saved.view.zoom) > 0
                ? {
                    panX: Number(saved.view.panX) || 0,
                    panY: Number(saved.view.panY) || 0,
                    zoom: Number(saved.view.zoom),
                }
                : null,
        display: {
            showAngles:
                saved?.display && typeof saved.display === 'object'
                    ? saved.display.showAngles !== false
                    : GALLERY_CONN_DEFAULT_DISPLAY.showAngles,
            showBreaks:
                saved?.display && typeof saved.display === 'object'
                    ? saved.display.showBreaks !== false
                    : GALLERY_CONN_DEFAULT_DISPLAY.showBreaks,
            showPackets:
                saved?.display && typeof saved.display === 'object'
                    ? saved.display.showPackets !== false
                    : GALLERY_CONN_DEFAULT_DISPLAY.showPackets,
            snapAngles:
                saved?.display && typeof saved.display === 'object'
                    ? saved.display.snapAngles !== false
                    : GALLERY_CONN_DEFAULT_DISPLAY.snapAngles,
        },
    };
}

/**
 * @param {{ nodes: object[], edges: object[], view?: object|null, display?: object|null, worldW?: number, worldH?: number }} model
 */
export function snapshotGalleryConnectionCanvas(model) {
    const out = {
        v: GALLERY_CONN_CANVAS_VERSION,
        nodes: (model.nodes || []).map((n) => {
            const row = {
                id: n.id,
                kind: n.kind,
                role: n.role || undefined,
                entityKind: n.entityKind || undefined,
                entityName: n.entityName || undefined,
                x: n.x,
                y: n.y,
                scale: n.scale,
                bgColor: n.bgColor,
            };
            if (n.factionFilename) row.factionFilename = n.factionFilename;
            if (n.portraitKey) row.portraitKey = n.portraitKey;
            if (n.codexNodeId) row.codexNodeId = n.codexNodeId;
            return row;
        }),
        edges: (model.edges || []).map((e) => ({
            fromId: e.fromId,
            toId: e.toId,
        })),
        display: {
            showAngles: model.display?.showAngles !== false,
            showBreaks: model.display?.showBreaks !== false,
            showPackets: model.display?.showPackets !== false,
            snapAngles: model.display?.snapAngles !== false,
        },
    };
    if (model.worldW) out.worldW = model.worldW;
    if (model.worldH) out.worldH = model.worldH;
    if (model.view && typeof model.view === 'object') {
        out.view = {
            panX: Number(model.view.panX) || 0,
            panY: Number(model.view.panY) || 0,
            zoom: Number(model.view.zoom) || 0,
        };
    }
    return out;
}
