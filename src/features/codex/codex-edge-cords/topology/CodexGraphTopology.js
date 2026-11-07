/**
 * Graph algorithms over Codex nodes and directed edges (pure; callers pass snapshots).
 */

/**
 * @param {string} fromId
 * @param {string} toId
 * @param {{ fromId: string, toId: string }[]} edges
 */
export function hasCodexConnectionBetween(fromId, toId, edges) {
    return edges.some(
        (ed) =>
            (ed.fromId === fromId && ed.toId === toId)
            || (ed.fromId === toId && ed.toId === fromId)
    );
}

/**
 * @param {string} startId
 * @param {string} targetId
 * @param {{ fromId: string, toId: string }[]} edges
 */
export function isCodexDirectedReachable(startId, targetId, edges) {
    if (!startId || !targetId || startId === targetId) return false;
    const adj = new Map();
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e || !e.fromId || !e.toId) continue;
        if (!adj.has(e.fromId)) adj.set(e.fromId, []);
        adj.get(e.fromId).push(e.toId);
    }
    const q = [startId];
    const seen = new Set([startId]);
    while (q.length) {
        const cur = q.shift();
        if (cur === targetId) return true;
        const outs = adj.get(cur);
        if (!outs) continue;
        for (let j = 0; j < outs.length; j += 1) {
            const nxt = outs[j];
            if (!seen.has(nxt)) {
                seen.add(nxt);
                q.push(nxt);
            }
        }
    }
    return false;
}

/**
 * True when `aId` and `bId` already have a real break route: an undirected path that
 * does **not** use the direct A↔B chord, visits at least one junction, and whose
 * **every intermediate node is a junction** (no other heroes/factions/NPCs).
 *
 * Long mesh detours like Illari → … → Sombra → … → Inti must NOT count — those made
 * import/sync treat short intended links as “redundant” and drop them.
 *
 * @param {string} aId
 * @param {string} bId
 * @param {Array<{ id?: string, kind?: string }>} allNodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
export function codexBioEntityPairHasJunctionAlternatePath(aId, bId, allNodes, edges) {
    if (!aId || !bId || aId === bId || !Array.isArray(allNodes) || !Array.isArray(edges)) return false;
    const byId = new Map();
    for (let i = 0; i < allNodes.length; i += 1) {
        const n = allNodes[i];
        if (n && n.id) byId.set(n.id, n);
    }
    const isJunctionNode = (id) => {
        const n = byId.get(id);
        return !!(n && n.kind === 'junction');
    };
    const edgeList = edges.filter(
        (e) =>
            e
            && e.fromId
            && e.toId
            && !(
                (e.fromId === aId && e.toId === bId)
                || (e.fromId === bId && e.toId === aId)
            )
    );
    const adj = new Map();
    for (let k = 0; k < edgeList.length; k += 1) {
        const e = edgeList[k];
        if (!adj.has(e.fromId)) adj.set(e.fromId, []);
        if (!adj.has(e.toId)) adj.set(e.toId, []);
        adj.get(e.fromId).push(e.toId);
        adj.get(e.toId).push(e.fromId);
    }
    // BFS from A: may only step onto junctions (or the goal B).
    const q = [aId];
    const seen = new Set([aId]);
    let touchedJunction = false;
    while (q.length) {
        const cur = q.shift();
        if (cur === bId) return touchedJunction;
        const neighbors = adj.get(cur) || [];
        for (let j = 0; j < neighbors.length; j += 1) {
            const nxt = neighbors[j];
            if (seen.has(nxt)) continue;
            if (nxt === bId) {
                // Direct neighbor of current — valid if we already passed a junction,
                // or if current itself is a junction (A → J → B).
                if (touchedJunction || isJunctionNode(cur)) return true;
                continue;
            }
            if (!isJunctionNode(nxt)) continue;
            seen.add(nxt);
            touchedJunction = true;
            q.push(nxt);
        }
    }
    return false;
}

export function codexNodeIsBioEntityKind(node) {
    return !!(node && (node.kind === 'hero' || node.kind === 'faction' || node.kind === 'npc'));
}

export function codexEdgeIsBioEntityChord(nFrom, nTo) {
    return codexNodeIsBioEntityKind(nFrom) && codexNodeIsBioEntityKind(nTo);
}
