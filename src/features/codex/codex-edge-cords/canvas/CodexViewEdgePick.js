/**
 * View-mode spatial edge picker — replaces per-segment transparent SVG hit lines.
 * Uniform grid over world-space segments; pick is nearest point-to-segment within radius.
 */

import { CODEX_EDGE_HIT_PICK_STROKE_PX } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { edgeDirectedKey } from '../topology/CodexGraphPrimitives.js';

const CELL = 256;

/**
 * @typedef {{
 *   fromId: string,
 *   toId: string,
 *   edge: { fromId: string, toId: string },
 *   x1: number, y1: number, x2: number, y2: number,
 *   order: number,
 * }} CodexViewPickSeg
 */

/** @type {Map<string, number[]>} */
let cells = new Map();
/** @type {CodexViewPickSeg[]} */
let segments = [];
/** @type {Map<string, { x: number, y: number }[]>} */
let polyByDirectedKey = new Map();
/** Half-width of pick stroke in world px */
let pickRadius = CODEX_EDGE_HIT_PICK_STROKE_PX / 2;

/**
 * @param {number} x
 * @param {number} y
 */
function cellKey(x, y) {
    return `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} pad
 * @param {(cx: number, cy: number) => void} visit
 */
function forEachTouchedCell(x1, y1, x2, y2, pad, visit) {
    const minX = Math.min(x1, x2) - pad;
    const maxX = Math.max(x1, x2) + pad;
    const minY = Math.min(y1, y2) - pad;
    const maxY = Math.max(y1, y2) + pad;
    const c0 = Math.floor(minX / CELL);
    const c1 = Math.floor(maxX / CELL);
    const r0 = Math.floor(minY / CELL);
    const r1 = Math.floor(maxY / CELL);
    for (let cy = r0; cy <= r1; cy += 1) {
        for (let cx = c0; cx <= c1; cx += 1) {
            visit(cx, cy);
        }
    }
}

/**
 * Squared distance from point to segment.
 * @param {number} px
 * @param {number} py
 * @param {CodexViewPickSeg} seg
 */
function distSqPointToSeg(px, py, seg) {
    const { x1, y1, x2, y2 } = seg;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) {
        const ex = px - x1;
        const ey = py - y1;
        return ex * ex + ey * ey;
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    const ex = px - qx;
    const ey = py - qy;
    return ex * ex + ey * ey;
}

/**
 * Rebuild pick index from painted edge polylines (view mode only).
 * @param {{ edge: { fromId: string, toId: string }, pts: { x: number, y: number }[] }[]} edgePolys
 * @param {{ isFilterDormant?: (edge: { fromId: string, toId: string }) => boolean }} [opts]
 */
export function rebuildCodexViewEdgePickIndex(edgePolys, opts = {}) {
    cells = new Map();
    segments = [];
    polyByDirectedKey = new Map();
    pickRadius = CODEX_EDGE_HIT_PICK_STROKE_PX / 2;
    const isDormant = opts.isFilterDormant;
    if (!Array.isArray(edgePolys) || edgePolys.length === 0) return;

    let order = 0;
    for (let i = 0; i < edgePolys.length; i += 1) {
        const { edge, pts } = edgePolys[i];
        if (!edge?.fromId || !edge?.toId || !pts || pts.length < 2) continue;
        if (isDormant?.(edge)) continue;
        polyByDirectedKey.set(edgeDirectedKey(edge.fromId, edge.toId), pts);
        for (let s = 0; s < pts.length - 1; s += 1) {
            const p0 = pts[s];
            const p1 = pts[s + 1];
            const seg = {
                fromId: edge.fromId,
                toId: edge.toId,
                edge,
                x1: p0.x,
                y1: p0.y,
                x2: p1.x,
                y2: p1.y,
                order: order++,
            };
            const idx = segments.length;
            segments.push(seg);
            forEachTouchedCell(p0.x, p0.y, p1.x, p1.y, pickRadius, (cx, cy) => {
                const k = `${cx},${cy}`;
                let list = cells.get(k);
                if (!list) {
                    list = [];
                    cells.set(k, list);
                }
                list.push(idx);
            });
        }
    }
}

export function clearCodexViewEdgePickIndex() {
    cells = new Map();
    segments = [];
    polyByDirectedKey = new Map();
}

/** @returns {Map<string, { x: number, y: number }[]>} */
export function getCodexViewEdgePickPolys() {
    return polyByDirectedKey;
}

/**
 * @param {number} worldX
 * @param {number} worldY
 * @returns {{ fromId: string, toId: string, edge: { fromId: string, toId: string } }|null}
 */
export function pickCodexViewEdgeAtWorld(worldX, worldY) {
    if (!segments.length) return null;
    const key = cellKey(worldX, worldY);
    const list = cells.get(key);
    if (!list?.length) return null;
    const r2 = pickRadius * pickRadius;
    let best = null;
    let bestDist = r2;
    let bestOrder = -1;
    for (let i = 0; i < list.length; i += 1) {
        const seg = segments[list[i]];
        if (!seg) continue;
        const d = distSqPointToSeg(worldX, worldY, seg);
        if (d > bestDist) continue;
        if (d < bestDist || seg.order > bestOrder) {
            bestDist = d;
            bestOrder = seg.order;
            best = seg;
        }
    }
    if (!best) return null;
    return { fromId: best.fromId, toId: best.toId, edge: best.edge };
}
