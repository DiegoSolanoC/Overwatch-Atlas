/**
 * Octilinear elbow facets at simple waypoint junctions (axis segment meets diagonal).
 */

import {
    CODEX_ELBOW_BEARING_TOL_DEG,
    CODEX_ELBOW_PARALLELOGRAM_ARM_PX,
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { codexPointInWorldRect } from '../../codex-controls-ui/camera/viewport/CodexViewportWorldBounds.js';
import { appendCordFilteredPolygonGroup } from '../svg/CodexCordSvgElements.js';
import { codexNodeCenterFromLayoutRecord } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';

/**
 * @typedef {object} CodexJunctionElbowContext
 * @property {() => HTMLElement|null} getRoot
 * @property {() => { fromId: string, toId: string }[]} getEdges
 * @property {(nodeId: string) => HTMLElement|null} [codexNodeElById]
 * @property {(el: HTMLElement) => { x: number, y: number }} [getNodeCenterWorldPx]
 * @property {() => { id: string, kind?: string, x: number, y: number, scale?: number }[]} [getCodexAllNodes]
 * @property {(edgeIn: { fromId: string, toId: string }, edgeOut: { fromId: string, toId: string }) => 'red'|'yellow'|'violet'|'green'|'grey'} edgeCordAppearance
 * @property {() => string} getCordColorHex
 * @property {boolean} [plainFills] — skip SVG filters (view-mode bulk paint)
 * @property {boolean} [skipTitles]
 */

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} [tolDeg]
 * @returns {'axis'|'diag'|'other'|null}
 */
export function classifyCodexSegmentAxisOrDiagonal(dx, dy, tolDeg = CODEX_ELBOW_BEARING_TOL_DEG) {
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return null;
    const ang = Math.atan2(dy, dx);
    let deg = (ang * 180) / Math.PI;
    deg = ((deg % 360) + 360) % 360;
    const mod90 = deg % 90;
    const distToAxis = Math.min(mod90, 90 - mod90);
    const distToDiag = Math.abs(mod90 - 45);
    const T = tolDeg;
    const axis = distToAxis <= T;
    const diag = distToDiag <= T;
    if (axis && diag) return distToAxis <= distToDiag ? 'axis' : 'diag';
    if (axis) return 'axis';
    if (diag) return 'diag';
    return 'other';
}

/**
 * Parallelogram at junction J filling the bend between incoming A→J and outgoing J→B (one arm axis, one 45°).
 * Vertices: J, J−ûL, J−ûL+v̂L, J+v̂L with û = A→J, v̂ = J→B.
 */
export function codexElbowParallelogramPoints(jx, jy, dxIn, dyIn, dxOut, dyOut, armLen) {
    const l1 = Math.hypot(dxIn, dyIn);
    const l2 = Math.hypot(dxOut, dyOut);
    if (l1 < 1e-6 || l2 < 1e-6) return null;
    const ux = dxIn / l1;
    const uy = dyIn / l1;
    const vx = dxOut / l2;
    const vy = dyOut / l2;
    const L = armLen;
    const x0 = jx;
    const y0 = jy;
    const x1 = jx - ux * L;
    const y1 = jy - uy * L;
    const x2 = jx - ux * L + vx * L;
    const y2 = jy - uy * L + vy * L;
    const x3 = jx + vx * L;
    const y3 = jy + vy * L;
    return [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
    ];
}

/** True when `nodeId` is a single bend on a path: exactly one link in and one out (not a split/merge). */
export function codexWaypointIsSimpleCorner(nodeId, edges) {
    if (!nodeId || !edges?.length) return false;
    let outN = 0;
    let inN = 0;
    for (let k = 0; k < edges.length; k += 1) {
        const e = edges[k];
        if (e.fromId === nodeId) outN += 1;
        if (e.toId === nodeId) inN += 1;
    }
    return outN === 1 && inN === 1;
}

/**
 * Precompute in/out degree for every endpoint — O(E) once instead of O(E) per junction.
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Map<string, { inN: number, outN: number }>}
 */
export function buildCodexEdgeEndpointDegrees(edges) {
    /** @type {Map<string, { inN: number, outN: number }>} */
    const degrees = new Map();
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e?.fromId || !e?.toId) continue;
        let from = degrees.get(e.fromId);
        if (!from) {
            from = { inN: 0, outN: 0 };
            degrees.set(e.fromId, from);
        }
        from.outN += 1;
        let to = degrees.get(e.toId);
        if (!to) {
            to = { inN: 0, outN: 0 };
            degrees.set(e.toId, to);
        }
        to.inN += 1;
    }
    return degrees;
}

/**
 * @param {string} nodeId
 * @param {Map<string, { inN: number, outN: number }>} degrees
 */
export function codexWaypointIsSimpleCornerFromDegrees(nodeId, degrees) {
    const d = degrees.get(nodeId);
    return !!(d && d.inN === 1 && d.outN === 1);
}

function buildLayoutCenterMap(nodes) {
    /** @type {Map<string, { x: number, y: number, kind: string }>} */
    const map = new Map();
    if (!Array.isArray(nodes)) return map;
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (!n?.id) continue;
        const c = codexNodeCenterFromLayoutRecord(n);
        if (!c) continue;
        map.set(n.id, { x: c.x, y: c.y, kind: String(n.kind || '') });
    }
    return map;
}

/**
 * @param {CodexJunctionElbowContext} ctx
 * @param {Map<string, { x: number, y: number, kind: string }>|null} layoutCenters
 * @param {string} id
 */
function resolveElbowCenter(ctx, layoutCenters, id) {
    const fromLayout = layoutCenters?.get(id);
    if (fromLayout) return fromLayout;
    const el = ctx.codexNodeElById?.(id);
    if (!el) return null;
    if (el.classList.contains('codex-node--target-hidden')) return null;
    const c = ctx.getNodeCenterWorldPx?.(el);
    if (!c) return null;
    const kind = el.dataset.codexKind || '';
    return { x: c.x, y: c.y, kind };
}

function elbowFillAndFilter(appearance, cordColorHex, plainFills) {
    const isGreyAppearance = appearance === 'grey' || appearance === 'violet-dim';
    const fill =
        appearance === 'red'
            ? '#f87171'
            : appearance === 'yellow'
                ? '#fbbf24'
                : appearance === 'green'
                    ? '#4ade80'
                    : isGreyAppearance
                        ? 'rgba(120, 128, 148, 0.38)'
                        : cordColorHex;
    if (plainFills || isGreyAppearance) {
        return { fill, filterUrl: null };
    }
    const filterUrl =
        appearance === 'red'
            ? 'url(#codex-edge-red-glow)'
            : appearance === 'yellow'
                ? 'url(#codex-edge-yellow-glow)'
                : appearance === 'green'
                    ? 'url(#codex-edge-green-glow)'
                    : 'url(#codex-edge-violet-glow)';
    return { fill, filterUrl };
}

function appendPlainElbowPolygon(parentG, ns, pointsStr, fill, polyClass) {
    const g = document.createElementNS(ns, 'g');
    const vis = document.createElementNS(ns, 'polygon');
    if (polyClass) vis.classList.add(polyClass);
    vis.setAttribute('points', pointsStr);
    vis.setAttribute('fill', fill);
    vis.setAttribute('stroke', 'none');
    g.appendChild(vis);
    parentG.appendChild(g);
    return g;
}

/**
 * Collect elbow draw specs (no DOM writes) — safe to run in chunks.
 * @returns {object[]}
 */
export function collectCodexJunctionElbowSpecs(worldCullRect, ctx) {
    const root = ctx.getRoot();
    const edges = ctx.getEdges();
    if (!root || !edges.length) return [];

    const arm = ctx.armPx ?? CODEX_ELBOW_PARALLELOGRAM_ARM_PX;
    const tolDeg = ctx.tolDeg ?? CODEX_ELBOW_BEARING_TOL_DEG;
    const degrees = buildCodexEdgeEndpointDegrees(edges);
    const layoutCenters = typeof ctx.getCodexAllNodes === 'function'
        ? buildLayoutCenterMap(ctx.getCodexAllNodes())
        : null;
    const cordColorHex = ctx.getCordColorHex();
    const plainFills = ctx.plainFills === true;

    /** @type {Map<string, { fromId: string, toId: string }[]>} */
    const outsByFrom = new Map();
    for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e?.fromId) continue;
        let list = outsByFrom.get(e.fromId);
        if (!list) {
            list = [];
            outsByFrom.set(e.fromId, list);
        }
        list.push(e);
    }

    const seen = new Set();
    /** @type {object[]} */
    const specs = [];

    for (let i = 0; i < edges.length; i++) {
        const eIn = edges[i];
        const jId = eIn.toId;
        if (!codexWaypointIsSimpleCornerFromDegrees(jId, degrees)) continue;

        const cJ = resolveElbowCenter(ctx, layoutCenters, jId);
        if (!cJ || cJ.kind !== 'junction') continue;
        if (worldCullRect && !codexPointInWorldRect(cJ.x, cJ.y, worldCullRect)) continue;

        const cA = resolveElbowCenter(ctx, layoutCenters, eIn.fromId);
        if (!cA) continue;
        const dxIn = cJ.x - cA.x;
        const dyIn = cJ.y - cA.y;
        const clsIn = classifyCodexSegmentAxisOrDiagonal(dxIn, dyIn, tolDeg);
        if (clsIn !== 'axis' && clsIn !== 'diag') continue;

        const outs = outsByFrom.get(jId) || [];
        for (let j = 0; j < outs.length; j++) {
            const eOut = outs[j];
            const cB = resolveElbowCenter(ctx, layoutCenters, eOut.toId);
            if (!cB) continue;
            const dxOut = cB.x - cJ.x;
            const dyOut = cB.y - cJ.y;
            const clsOut = classifyCodexSegmentAxisOrDiagonal(dxOut, dyOut, tolDeg);
            if (clsOut !== 'axis' && clsOut !== 'diag') continue;
            if (clsIn === clsOut) continue;

            const key = `${eIn.fromId}\x1e${jId}\x1e${eOut.toId}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const pts = codexElbowParallelogramPoints(cJ.x, cJ.y, dxIn, dyIn, dxOut, dyOut, arm);
            if (!pts) continue;

            const appearance = ctx.edgeCordAppearance(eIn, eOut);
            if (appearance === 'hidden') continue;
            const { fill, filterUrl } = elbowFillAndFilter(appearance, cordColorHex, plainFills);
            specs.push({
                fromId: eIn.fromId,
                jId,
                toId: eOut.toId,
                pointsStr: pts.map((p) => `${p.x},${p.y}`).join(' '),
                fill,
                filterUrl,
            });
        }
    }
    return specs;
}

function paintCodexElbowSpec(parentG, ns, spec, opts = {}) {
    const plain = !spec.filterUrl;
    const elbowG = plain
        ? appendPlainElbowPolygon(parentG, ns, spec.pointsStr, spec.fill, 'codex-edge-elbow-parallelogram')
        : appendCordFilteredPolygonGroup(parentG, ns, {
            pointsStr: spec.pointsStr,
            fill: spec.fill,
            filterUrl: spec.filterUrl,
            polyClass: 'codex-edge-elbow-parallelogram',
        });
    elbowG.setAttribute('data-codex-elbow-in-from', spec.fromId);
    elbowG.setAttribute('data-codex-elbow-junction', spec.jId);
    elbowG.setAttribute('data-codex-elbow-out-to', spec.toId);
    if (!opts.skipTitles) {
        const t = document.createElementNS(ns, 'title');
        t.textContent = 'Axis ↔ diagonal elbow at waypoint (octilinear bend)';
        elbowG.appendChild(t);
    }
}

/**
 * Filled elbow facets at waypoints where a straight (axis) cord meets a 45° diagonal on the next segment.
 * Skipped at multi-way junctions (splits/merges); only simple in-degree-1 / out-degree-1 corners.
 */
export function appendCodexJunctionElbowParallelograms(parentG, ns, worldCullRect, ctx) {
    const specs = collectCodexJunctionElbowSpecs(worldCullRect, ctx);
    const skipTitles = ctx.skipTitles === true;
    for (let i = 0; i < specs.length; i += 1) {
        paintCodexElbowSpec(parentG, ns, specs[i], { skipTitles });
    }
}

const ELBOW_PAINT_CHUNK = 48;

function yieldElbowPaint() {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve(), { timeout: 48 });
        } else {
            requestAnimationFrame(() => resolve());
        }
    });
}

/**
 * Chunked elbow paint for large boards (view-mode open). Collects via layout coords, paints with yields.
 * @returns {Promise<number>} painted count
 */
export async function appendCodexJunctionElbowParallelogramsChunked(parentG, ns, worldCullRect, ctx) {
    if (!parentG || !ns || !ctx) return 0;
    const specs = collectCodexJunctionElbowSpecs(worldCullRect, {
        ...ctx,
        plainFills: ctx.plainFills !== false,
        skipTitles: true,
    });
    if (!specs.length) return 0;
    for (let start = 0; start < specs.length; start += ELBOW_PAINT_CHUNK) {
        if (!parentG.isConnected) return start;
        const end = Math.min(start + ELBOW_PAINT_CHUNK, specs.length);
        for (let i = start; i < end; i += 1) {
            paintCodexElbowSpec(parentG, ns, specs[i], { skipTitles: true });
        }
        if (end < specs.length) {
            await yieldElbowPaint();
        }
    }
    return specs.length;
}
