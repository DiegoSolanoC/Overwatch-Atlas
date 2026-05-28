/**
 * Graph helpers for gallery connection canvas packet paths (Codex-aligned).
 */

/**
 * @param {{ id: string, kind?: string, entityKind?: string }[]} nodes
 * @returns {Map<string, string>}
 */
export function buildGalleryNodeKindMap(nodes) {
    const map = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node?.id) continue;
        map.set(node.id, node.kind === 'junction' ? 'junction' : (node.entityKind || node.kind || ''));
    }
    return map;
}

/**
 * @param {Map<string, string>} kindMap
 * @param {string} id
 */
export function galleryNodeIsJunctionWaypoint(kindMap, id) {
    return kindMap.get(id) === 'junction';
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {string} fromId
 * @param {string} toId
 */
export function findGalleryDirectedEdge(edges, fromId, toId) {
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (e.fromId === fromId && e.toId === toId) return e;
    }
    return null;
}

/**
 * Walk forward through junction waypoints from `toId` (Codex packet tail sampling).
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {Map<string, string>} kindMap
 * @param {string} fromId
 * @param {string} toId
 * @returns {string[]}
 */
export function sampleGalleryPacketTailNodeIds(edges, kindMap, fromId, toId) {
    if (!galleryNodeIsJunctionWaypoint(kindMap, toId)) return [];
    const tail = [];
    let cur = toId;
    let prev = fromId;
    while (galleryNodeIsJunctionWaypoint(kindMap, cur)) {
        const outs = edges.filter(
            (e) => e.fromId === cur && e.toId !== prev,
        );
        if (outs.length === 0) break;
        const pick = outs.length === 1
            ? outs[0]
            : outs[Math.floor(Math.random() * outs.length)];
        tail.push(pick.toId);
        prev = cur;
        cur = pick.toId;
    }
    return tail;
}

/**
 * @param {string} fromId
 * @param {string} toId
 * @param {string[]} tailNodeIds
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {(id: string) => { x: number, y: number }|null} getNodeCenter
 * @returns {{ x: number, y: number }[]|null}
 */
export function tryBuildGalleryPacketWorldPoints(fromId, toId, tailNodeIds, edges, getNodeCenter) {
    const ids = [fromId, toId, ...tailNodeIds];
    const pts = [];
    for (let i = 0; i < ids.length; i += 1) {
        const p = getNodeCenter(ids[i]);
        if (!p) return null;
        pts.push(p);
    }
    for (let i = 0; i < ids.length - 1; i += 1) {
        if (!findGalleryDirectedEdge(edges, ids[i], ids[i + 1])) return null;
    }
    return pts;
}
