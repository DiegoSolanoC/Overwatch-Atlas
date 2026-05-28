/**
 * Build / merge gallery personal connection canvas graph from archive entry + saved layout.
 */

import { bioConnectionRowIsDisplayable } from '../../system-interface/interface-shared/bio-archive/bioArchiveConnectionRows.js';

export const GALLERY_CONN_CANVAS_VERSION = 1;
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
 * @param {object|null} entry
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 * @param {string} displayName
 * @param {string} filterKey
 * @param {object|null|undefined} savedCanvas
 * @returns {{ nodes: object[], edges: { fromId: string, toId: string }[] }}
 */
export function buildGalleryConnectionCanvasModel(entry, category, displayName, filterKey, savedCanvas) {
    const subjectKind = subjectKindFromCategory(category);
    const subjectName = subjectNameFromEntry(entry, displayName);
    const subjectEntityToken =
        subjectKind === 'faction' || subjectKind === 'npc'
            ? String(filterKey || subjectName).trim()
            : subjectName;
    const linkedEntities = listDisplayableConnectionEntities(entry);
    const saved = normalizeSavedCanvas(savedCanvas);

    const cx = Math.round(GALLERY_CONN_CANVAS_WORLD_W * 0.38);
    const cy = Math.round(GALLERY_CONN_CANVAS_WORLD_H * 0.5);
    const radius = Math.min(GALLERY_CONN_CANVAS_WORLD_W, GALLERY_CONN_CANVAS_WORLD_H) * 0.28;

    /** @type {Map<string, object>} */
    const nodeById = new Map();

    const savedSubject = saved?.nodes?.find((n) => n && n.id === GALLERY_CONN_SUBJECT_NODE_ID);
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
        const savedNode = saved?.nodes?.find((n) => n && n.id === id);
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

    if (saved?.nodes) {
        for (let j = 0; j < saved.nodes.length; j += 1) {
            const sn = saved.nodes[j];
            if (!sn || !sn.id || sn.kind !== 'junction') continue;
            if (nodeById.has(sn.id)) continue;
            nodeById.set(sn.id, {
                id: sn.id,
                kind: 'junction',
                role: null,
                entityKind: null,
                entityName: null,
                x: sn.x,
                y: sn.y,
                scale: sn.scale,
                bgColor: sn.bgColor,
            });
        }
    }

    /** @type {{ fromId: string, toId: string }[]} */
    let edges = [];
    const savedEdges = Array.isArray(saved?.edges) ? saved.edges : [];

    if (savedEdges.length > 0) {
        const validIds = new Set(nodeById.keys());
        edges = savedEdges.filter(
            (e) =>
                e
                && e.fromId
                && e.toId
                && validIds.has(e.fromId)
                && validIds.has(e.toId),
        );
    }

    const edgeKey = (a, b) => `${a}\0${b}`;
    const edgeSet = new Set(edges.map((e) => edgeKey(e.fromId, e.toId)));

    for (let k = 0; k < linkedEntities.length; k += 1) {
        const { kind, name } = linkedEntities[k];
        const linkedId = galleryLinkedNodeId(kind, name);
        const directA = edgeKey(GALLERY_CONN_SUBJECT_NODE_ID, linkedId);
        const directB = edgeKey(linkedId, GALLERY_CONN_SUBJECT_NODE_ID);
        const hasPath =
            edgeSet.has(directA)
            || edgeSet.has(directB)
            || savedEdges.some(
                (e) =>
                    (e.fromId === GALLERY_CONN_SUBJECT_NODE_ID && reachesNode(savedEdges, e.toId, linkedId))
                    || (e.toId === GALLERY_CONN_SUBJECT_NODE_ID && reachesNode(savedEdges, e.fromId, linkedId)),
            );
        if (!hasPath) {
            edges.push({ fromId: GALLERY_CONN_SUBJECT_NODE_ID, toId: linkedId });
            edgeSet.add(directA);
        }
    }

    return {
        nodes: Array.from(nodeById.values()),
        edges,
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
 * @param {{ nodes: object[], edges: object[], view?: object|null, display?: object|null }} model
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
    if (model.view && typeof model.view === 'object') {
        out.view = {
            panX: Number(model.view.panX) || 0,
            panY: Number(model.view.panY) || 0,
            zoom: Number(model.view.zoom) || 0,
        };
    }
    return out;
}
