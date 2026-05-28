/**
 * Pure graph primitives for Codex node–edge layout (no DOM, no globals).
 */

/**
 * @param {{ fromId: string, toId: string }|null|undefined} e
 * @returns {{ fromId: string, toId: string } | null}
 */
export function normalizeEdgeRecord(e) {
    if (!e || !e.fromId || !e.toId) return null;
    return {
        fromId: e.fromId,
        toId: e.toId
    };
}

export function edgeDirectedKey(fromId, toId) {
    return `${fromId}\x1e${toId}`;
}

/** Stable key for an unordered pair of node ids (at most one link between two nodes). */
export function codexUnorderedPairKey(idA, idB) {
    return idA <= idB ? `${idA}\x1e${idB}` : `${idB}\x1e${idA}`;
}

/**
 * Keeps the first edge for each unordered node pair (handles legacy saves with both A→B and B→A).
 * @param {{ fromId: string, toId: string }[]} list
 */
export function dedupeCodexEdgesByNodePair(list) {
    const seen = new Set();
    const out = [];
    for (let i = 0; i < list.length; i += 1) {
        const e = list[i];
        const k = codexUnorderedPairKey(e.fromId, e.toId);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(e);
    }
    return out;
}

export function generateNodeId() {
    return `cn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeBioNameLoose(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function heroNamesLooselyEqualCodex(a, b) {
    const na = normalizeBioNameLoose(a);
    const nb = normalizeBioNameLoose(b);
    if (na && na === nb) return true;
    const la = na.replace(/:/g, '').replace(/\s/g, '');
    const lb = nb.replace(/:/g, '').replace(/\s/g, '');
    return la.length > 0 && la === lb;
}
