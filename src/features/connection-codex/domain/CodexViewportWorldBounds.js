/**
 * World-space viewport AABB and cheap intersection tests for Codex edges / DOM culling.
 */

/**
 * Expanded world-space AABB of what’s visible in the Codex viewport (same space as node `left`/`top`).
 * @param {{
 *   root: HTMLElement|null,
 *   worldEl: HTMLElement|null,
 *   panX: number,
 *   panY: number,
 *   zoom: number,
 *   marginPx: number,
 *   worldW: number,
 *   worldH: number
 * }} p
 */
export function computeCodexVisibleWorldBoundsExpanded(p) {
    const { root, worldEl, panX, panY, zoom, marginPx, worldW, worldH } = p;
    if (!root) {
        return { minX: 0, minY: 0, maxX: worldW, maxY: worldH };
    }
    const rw = root.clientWidth || 1;
    const rh = root.clientHeight || 1;
    if (!worldEl) {
        const m = marginPx;
        return { minX: -m, minY: -m, maxX: rw + m, maxY: rh + m };
    }
    const z = Math.max(0.05, zoom);
    const m = marginPx / z;
    return {
        minX: (-panX) / z - m,
        maxX: (rw - panX) / z + m,
        minY: (-panY) / z - m,
        maxY: (rh - panY) / z + m
    };
}

export function codexSegmentAabbIntersectsRect(ax, ay, bx, by, r) {
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by);
    const maxY = Math.max(ay, by);
    if (maxX < r.minX || minX > r.maxX || maxY < r.minY || minY > r.maxY) return false;
    return true;
}

export function codexEdgePolyIntersectsRect(pts, r) {
    for (let i = 0; i < pts.length - 1; i += 1) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        if (codexSegmentAabbIntersectsRect(p0.x, p0.y, p1.x, p1.y, r)) return true;
    }
    return false;
}

export function codexUnionBoundsFromEdgePolys(edgePolys, pad) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let e = 0; e < edgePolys.length; e += 1) {
        const pts = edgePolys[e].pts;
        for (let i = 0; i < pts.length; i += 1) {
            const p = pts[i];
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
    }
    if (!Number.isFinite(minX)) return null;
    return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad
    };
}

export function codexPointInWorldRect(x, y, r) {
    return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;
}
