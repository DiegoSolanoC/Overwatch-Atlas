/**
 * In-place cord geometry updates while dev-mode node drag is active.
 * Avoids wiping/rebuilding the full edges SVG layer every animation frame.
 */

import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    CODEX_ELBOW_BEARING_TOL_DEG,
    CODEX_ELBOW_PARALLELOGRAM_ARM_PX,
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import {
    classifyCodexSegmentAxisOrDiagonal,
    codexElbowParallelogramPoints,
    codexWaypointIsSimpleCorner,
} from '../junction-decor/CodexJunctionElbowParallelograms.js';

/** @type {CodexEdgeDragSyncRuntime|null} */
let _rt = null;

/**
 * @typedef {object} CodexEdgeDragSyncRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => { fromId: string, toId: string }[]} getEdges
 * @property {() => Set<string>} getActiveDragNodeIds
 * @property {() => boolean} getDragUseLightSync
 * @property {(v: boolean) => void} setDragUseLightSync
 * @property {(edge: { fromId: string, toId: string }) => { x: number, y: number }[]|null} buildPolylineForEdge
 * @property {(id: string) => HTMLElement|null} codexNodeElById
 * @property {(el: HTMLElement) => { x: number, y: number }} getNodeCenterWorldPx
 * @property {() => boolean} [getTargetedSelectionActive]
 * @property {() => Set<string>} [getTargetedSelectionVisibleIds]
 * @property {() => Set<string>} [getTargetedSelectionVisibleEdgeKeys]
 * @property {() => boolean} [syncCodexEdgeNodeMaskDom]
 */

/**
 * @param {CodexEdgeDragSyncRuntime} rt
 */
export function registerCodexEdgeDragSyncRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexEdgeDragSyncRuntime() {
    _rt = null;
}

/** @param {string} id */
function escapeEdgeIdForSelector(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
    }
    return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** @returns {{ fromId: string, toId: string }[]} */
function getEdgesForDragSync() {
    let edges = _rt.getEdges();
    if (_rt.getTargetedSelectionActive?.()) {
        const visible = _rt.getTargetedSelectionVisibleIds?.();
        const edgeKeys = _rt.getTargetedSelectionVisibleEdgeKeys?.();
        if (visible && visible.size > 0) {
            edges = edges.filter((e) => {
                if (!visible.has(e.fromId) || !visible.has(e.toId)) return false;
                if (edgeKeys && edgeKeys.size > 0) {
                    return edgeKeys.has(codexUnorderedPairKey(e.fromId, e.toId));
                }
                return true;
            });
        } else {
            edges = [];
        }
    }
    return edges;
}

/**
 * @param {SVGLineElement} line
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function setLineEndpoints(line, x1, y1, x2, y2) {
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
}

/**
 * @param {{ x: number, y: number }[]} pts
 * @returns {string}
 */
function pointsToAttr(pts) {
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * @param {SVGSVGElement} svg
 * @param {Set<string>} dragIds
 * @param {{ fromId: string, toId: string }[]} edges
 */
function syncDraggedEdgeSegments(svg, dragIds, edges) {
    const hitRoot = svg.querySelector('.codex-edges-hit-pick');
    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        if (!dragIds.has(edge.fromId) && !dragIds.has(edge.toId)) continue;
        const pts = _rt.buildPolylineForEdge(edge);
        if (!pts || pts.length < 2) continue;

        const fromEsc = escapeEdgeIdForSelector(edge.fromId);
        const toEsc = escapeEdgeIdForSelector(edge.toId);
        const groups = svg.querySelectorAll(
            `g.codex-edge-segment-group[data-codex-edge-from="${fromEsc}"][data-codex-edge-to="${toEsc}"]`,
        );

        for (let seg = 0; seg < pts.length - 1; seg += 1) {
            const p0 = pts[seg];
            const p1 = pts[seg + 1];
            const g = groups[seg];
            if (g) {
                g.querySelectorAll('line').forEach((line) => {
                    setLineEndpoints(line, p0.x, p0.y, p1.x, p1.y);
                });
            }
            if (hitRoot) {
                const hit = hitRoot.querySelector(
                    `.codex-edge-hit[data-codex-edge-from="${fromEsc}"][data-codex-edge-to="${toEsc}"][data-codex-seg="${seg}"]`,
                );
                if (hit) {
                    setLineEndpoints(hit, p0.x, p0.y, p1.x, p1.y);
                }
            }
        }
    }
}

/**
 * @param {SVGSVGElement} svg
 * @param {Set<string>} dragIds
 * @param {{ fromId: string, toId: string }[]} edges
 */
function syncDraggedJunctionElbows(svg, dragIds, edges) {
    const contentRoot = svg.querySelector('.codex-edges-masked');
    if (!contentRoot) return;

    const arm = CODEX_ELBOW_PARALLELOGRAM_ARM_PX;
    const tolDeg = CODEX_ELBOW_BEARING_TOL_DEG;
    const seen = new Set();

    contentRoot.querySelectorAll('g[data-codex-elbow-junction]').forEach((group) => {
        const jId = group.getAttribute('data-codex-elbow-junction');
        const inFrom = group.getAttribute('data-codex-elbow-in-from');
        const outTo = group.getAttribute('data-codex-elbow-out-to');
        if (!jId || !inFrom || !outTo) return;
        if (
            !dragIds.has(jId)
            && !dragIds.has(inFrom)
            && !dragIds.has(outTo)
        ) {
            return;
        }

        const key = `${inFrom}\x1e${jId}\x1e${outTo}`;
        if (seen.has(key)) return;
        seen.add(key);

        if (!codexWaypointIsSimpleCorner(jId, edges)) return;

        const elJ = _rt.codexNodeElById(jId);
        const elA = _rt.codexNodeElById(inFrom);
        const elB = _rt.codexNodeElById(outTo);
        if (!elJ || !elA || !elB) return;

        const cJ = _rt.getNodeCenterWorldPx(elJ);
        const cA = _rt.getNodeCenterWorldPx(elA);
        const cB = _rt.getNodeCenterWorldPx(elB);
        const dxIn = cJ.x - cA.x;
        const dyIn = cJ.y - cA.y;
        const dxOut = cB.x - cJ.x;
        const dyOut = cB.y - cJ.y;
        const clsIn = classifyCodexSegmentAxisOrDiagonal(dxIn, dyIn, tolDeg);
        const clsOut = classifyCodexSegmentAxisOrDiagonal(dxOut, dyOut, tolDeg);
        if (clsIn !== 'axis' && clsIn !== 'diag') return;
        if (clsOut !== 'axis' && clsOut !== 'diag') return;
        if (clsIn === clsOut) return;

        const pts = codexElbowParallelogramPoints(cJ.x, cJ.y, dxIn, dyIn, dxOut, dyOut, arm);
        if (!pts) return;

        const pointsStr = pointsToAttr(pts);
        group.querySelectorAll('polygon').forEach((poly) => {
            poly.setAttribute('points', pointsStr);
        });
    });
}

/**
 * In-place cord + elbow sync for a set of nodes (scale changes, light drag).
 * Skips full alpha-mask rebuild during frequent updates — callers schedule mask sync on drag end.
 * @param {Iterable<string>|Set<string>} nodeIds
 * @param {{ syncMasks?: boolean }} [opts]
 * @returns {boolean} True when geometry was updated in-place (skip full redraw).
 */
export function syncCodexEdgesAroundNodeIds(nodeIds, opts = {}) {
    if (!_rt) return false;
    const idSet =
        nodeIds instanceof Set
            ? nodeIds
            : new Set([...nodeIds].map((id) => String(id || '')).filter(Boolean));
    if (!idSet.size) return false;

    const root = _rt.getRoot();
    const svg = root?.querySelector('.codex-edges-layer');
    if (!svg?.querySelector('.codex-edges-masked')) return false;

    const edges = getEdgesForDragSync();
    syncDraggedEdgeSegments(svg, idSet, edges);
    syncDraggedJunctionElbows(svg, idSet, edges);
    if (opts.syncMasks === true) {
        _rt.syncCodexEdgeNodeMaskDom?.();
    }

    return true;
}

/**
 * @returns {boolean} True when geometry was updated in-place (skip full redraw).
 */
export function syncCodexEdgesDuringNodeDrag() {
    if (!_rt || !_rt.getDragUseLightSync()) return false;

    const dragIds = _rt.getActiveDragNodeIds();
    if (!dragIds.size) return false;

    // Never rebuild the full portrait alpha mask every pointer frame — that alone freezes the board.
    return syncCodexEdgesAroundNodeIds(dragIds, { syncMasks: false });
}
