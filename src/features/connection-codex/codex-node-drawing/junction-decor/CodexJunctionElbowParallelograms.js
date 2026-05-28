/**
 * Octilinear elbow facets at simple waypoint junctions (axis segment meets diagonal).
 */

import { CODEX_ELBOW_BEARING_TOL_DEG, CODEX_ELBOW_PARALLELOGRAM_ARM_PX } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { codexPointInWorldRect } from '../../codex-controls-ui/camera/viewport/CodexViewportWorldBounds.js';
import { appendCordFilteredPolygonGroup } from '../svg/CodexCordSvgElements.js';

/**
 * @typedef {object} CodexJunctionElbowContext
 * @property {() => HTMLElement|null} getRoot
 * @property {() => { fromId: string, toId: string }[]} getEdges
 * @property {(nodeId: string) => HTMLElement|null} codexNodeElById
 * @property {(el: HTMLElement) => { x: number, y: number }} getNodeCenterWorldPx
 * @property {(edge: { fromId: string, toId: string }) => 'red'|'yellow'|'violet'} edgeCordAppearance
 * @property {() => string} getCordColorHex
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
        { x: x3, y: y3 }
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
 * Filled elbow facets at waypoints where a straight (axis) cord meets a 45° diagonal on the next segment.
 * Skipped at multi-way junctions (splits/merges); only simple in-degree-1 / out-degree-1 corners.
 * @param {SVGGElement} parentG
 * @param {string} ns
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }|null} worldCullRect — skip elbows whose junction center lies outside (large boards).
 * @param {CodexJunctionElbowContext} ctx
 */
export function appendCodexJunctionElbowParallelograms(parentG, ns, worldCullRect, ctx) {
    const root = ctx.getRoot();
    const edges = ctx.getEdges();
    if (!root || !edges.length) return;
    const seen = new Set();
    const arm = ctx.armPx ?? CODEX_ELBOW_PARALLELOGRAM_ARM_PX;
    const tolDeg = ctx.tolDeg ?? CODEX_ELBOW_BEARING_TOL_DEG;

    for (let i = 0; i < edges.length; i++) {
        const eIn = edges[i];
        const jId = eIn.toId;
        const elJ = ctx.codexNodeElById(jId);
        if (!elJ || !elJ.classList.contains('codex-node--junction')) continue;
        if (elJ.classList.contains('codex-node--target-hidden')) continue;
        if (!codexWaypointIsSimpleCorner(jId, edges)) continue;
        const elA = ctx.codexNodeElById(eIn.fromId);
        if (!elA || elA.classList.contains('codex-node--target-hidden')) continue;
        const cJ = ctx.getNodeCenterWorldPx(elJ);
        if (worldCullRect && !codexPointInWorldRect(cJ.x, cJ.y, worldCullRect)) continue;
        const cA = ctx.getNodeCenterWorldPx(elA);
        const dxIn = cJ.x - cA.x;
        const dyIn = cJ.y - cA.y;
        const clsIn = classifyCodexSegmentAxisOrDiagonal(dxIn, dyIn, tolDeg);
        if (clsIn !== 'axis' && clsIn !== 'diag') continue;

        for (let j = 0; j < edges.length; j++) {
            const eOut = edges[j];
            if (eOut.fromId !== jId) continue;
            const elB = ctx.codexNodeElById(eOut.toId);
            if (!elB || elB.classList.contains('codex-node--target-hidden')) continue;
            const cB = ctx.getNodeCenterWorldPx(elB);
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

            const appearance = ctx.edgeCordAppearance(eOut);
            const fill =
                appearance === 'red' ? '#f87171' : appearance === 'yellow' ? '#fbbf24' : ctx.getCordColorHex();
            const filterUrl =
                appearance === 'red'
                    ? 'url(#codex-edge-red-glow)'
                    : appearance === 'yellow'
                        ? 'url(#codex-edge-yellow-glow)'
                        : 'url(#codex-edge-violet-glow)';
            const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
            const elbowG = appendCordFilteredPolygonGroup(parentG, ns, {
                pointsStr,
                fill,
                filterUrl,
                polyClass: 'codex-edge-elbow-parallelogram'
            });
            const t = document.createElementNS(ns, 'title');
            t.textContent = 'Axis ↔ diagonal elbow at waypoint (octilinear bend)';
            elbowG.appendChild(t);
        }
    }
}
