/**
 * Codex directed-edge SVG redraw + RAF debounce. Canvas service registers live state/callbacks once per mount.
 */

import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    CODEX_EDGE_CULL_MARGIN_PX,
    CODEX_EDGE_DEGREE_FONT_PX,
    CODEX_EDGE_HIT_PICK_STROKE_PX,
    CODEX_EDGES_NODE_ALPHA_MASK_ID,
    CODEX_MASK_PAD_WORLD_FROM_EDGES,
    CODEX_OCT_SOFT_SNAP_TOL_DEG,
    CODEX_VIEWPORT_CULL_MIN_EDGES,
    CODEX_VIEWPORT_CULL_MIN_NODES
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

/** @type {CodexEdgeRedrawRuntime|null} */
let _rt = null;

/** @type {ReturnType<typeof setTimeout>|0} */
let edgeRedrawScheduleTimer = 0;

/**
 * @typedef {object} CodexEdgeRedrawRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => HTMLElement|null} getWorldEl
 * @property {() => 'dev'|'view'} getMode
 * @property {() => boolean} getViewModeInitialRenderDone
 * @property {(v: boolean) => void} setViewModeInitialRenderDone
 * @property {() => boolean} getSkipAllEdgeRedraws
 * @property {() => boolean} getSkipEdgeRedraw
 * @property {() => boolean} getPerfDebug
 * @property {() => { fromId: string, toId: string }[]} getEdges
 * @property {() => Set<string>} getActiveDragNodeIds
 * @property {() => number} getViewZoom
 * @property {() => object} getVisualPrefs
 * @property {() => number} getDoubleRightMs
 * @property {() => Map<string, number>} getCordDoubleRightLastTs
 * @property {(k: string|null) => void} setCordPendingDeletePairKey
 * @property {(fromId: string, toId: string) => object|null} findEdge
 * @property {(fromId: string, toId: string) => void} removeCodexEdgeDirected
 * @property {() => void} clearPendingCodexDeleteState
 * @property {(edge: { fromId: string, toId: string }) => { x: number, y: number }[]|null} buildPolylineForEdge
 * @property {(marginPx: number) => object} getCodexVisibleWorldBoundsExpanded
 * @property {(pts: { x: number, y: number }[], r: object) => boolean} codexEdgePolyIntersectsRect
 * @property {(edgePolys: { pts: { x: number, y: number }[] }[], pad: number) => object|null} codexUnionBoundsFromEdgePolys
 * @property {(parentG: SVGGElement, ns: string, worldCullRect: object|null) => void} appendCodexJunctionElbowParallelograms
 * @property {(defs: SVGDefsElement, id: string, blurResultId: string, opts: object) => void} appendEdgeGlowFilter
 * @property {(defs: SVGDefsElement, id: string, blurResultId: string, opts: object) => void} appendSoftPacketGlowFilter
 * @property {(defs: SVGDefsElement, ns: string, vw: number, vh: number, maskWorldRect?: object|null) => void} appendCodexEdgeNodeMask
 * @property {(parent: SVGGElement, ns: string, opts: object) => void} appendCordFilteredLineGroup
 * @property {(nodeList?: NodeListOf<Element>|Element[]|undefined) => void} syncCodexNodeDomCullFromView
 * @property {(nodeList?: NodeListOf<Element>|Element[]|undefined) => void} syncCodexNodeCoordLabels
 * @property {(edgePolys: { edge: object, pts: { x: number, y: number }[] }[]) => void} syncCodexCordPacketState
 * @property {() => void} codexStopCordAnimRafOnly
 * @property {() => void} ensureCodexCordAnimationLoop
 * @property {(edge: { fromId: string, toId: string }) => 'red'|'yellow'|'violet'} edgeCordAppearance
 * @property {(p0: object, p1: object) => number|null} cordSegmentDegreesLabel
 * @property {(p0: object, p1: object, tolDeg?: number) => boolean} cordSegmentWithinOctilinearToleranceDegrees
 */

/**
 * @param {CodexEdgeRedrawRuntime} rt
 */
export function registerCodexEdgeRedrawRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexEdgeRedrawRuntime() {
    clearCodexEdgeRedrawSchedule();
    _rt = null;
}

export function clearCodexEdgeRedrawSchedule() {
    if (edgeRedrawScheduleTimer) {
        clearTimeout(edgeRedrawScheduleTimer);
        edgeRedrawScheduleTimer = 0;
    }
}

/** Batches edge redraws to one per animation frame during node drag and view zoom. */
export function scheduleRedrawCodexEdges() {
    if (!_rt) return;
    if (_rt.getMode() === 'view' && _rt.getViewModeInitialRenderDone()) return;
    if (edgeRedrawScheduleTimer) return;
    edgeRedrawScheduleTimer = setTimeout(() => {
        edgeRedrawScheduleTimer = 0;
        requestAnimationFrame(() => redrawCodexEdges());
    }, 16);
}

export function redrawCodexEdges() {
    if (!_rt) return;
    const perf = _rt.getPerfDebug();
    const mode = _rt.getMode();
    const viewInitialDone = _rt.getViewModeInitialRenderDone();
    const skipAll = _rt.getSkipAllEdgeRedraws();
    const skipEdge = _rt.getSkipEdgeRedraw();
    const root = _rt.getRoot();
    const worldEl = _rt.getWorldEl();
    const edges = _rt.getEdges();
    const dragIds = _rt.getActiveDragNodeIds();
    const viewZoom = _rt.getViewZoom();
    const visualPrefs = _rt.getVisualPrefs();

    if (perf) {
        console.log('[Codex Redraw] redrawCodexEdges called - mode=' + mode);
    }

    if (mode === 'view') {
        if (viewInitialDone) {
            if (perf) {
                console.log('[Codex Redraw] Skipping redraw in View Mode (already rendered)');
                console.log('[Codex Perf] Skipping redraw in View Mode (already rendered)');
            }
            return;
        }
        if (perf) {
            console.log('[Codex Redraw] View Mode initial render - forcing through all skips');
            console.log('[Codex Perf] View Mode initial render - forcing through all skips');
        }
    }

    if (perf) {
        console.log('[Codex Redraw] Skip flags - skipAll=' + skipAll + ', skipEdge=' + skipEdge);
    }

    if (skipAll) {
        const isViewModeInitialRender = mode === 'view' && !viewInitialDone;
        if (!isViewModeInitialRender) {
            if (perf) {
                console.log('[Codex Redraw] Skipping ALL edge redraws (batch mode), isViewModeInitialRender=' + isViewModeInitialRender);
                console.log('[Codex Perf] Skipping ALL edge redraws (batch mode), isViewModeInitialRender=' + isViewModeInitialRender);
            }
            return;
        }
        if (perf) {
            console.log('[Codex Redraw] Bypassing batch skip for View Mode initial render');
            console.log('[Codex Perf] Bypassing batch skip for View Mode initial render');
        }
    }

    if (skipEdge && !(mode === 'view' && !viewInitialDone)) {
        if (perf) {
            console.log('[Codex Redraw] Skipping edge redraw (skip flag set)');
            console.log('[Codex Perf] Skipping edge redraw (skip flag set)');
        }
        return;
    }

    const startTime = performance.now();
    if (perf) {
        console.log('[Codex Perf] redrawCodexEdges started');
    }

    const svg = root?.querySelector('.codex-edges-layer');
    if (!svg || !root) {
        if (perf) {
            console.log('[Codex Redraw] No SVG or root found, aborting');
        }
        return;
    }
    if (perf) {
        console.log('[Codex Redraw] SVG found, proceeding with render');
    }

    if (edgeRedrawScheduleTimer) {
        clearTimeout(edgeRedrawScheduleTimer);
        edgeRedrawScheduleTimer = 0;
    }

    const nodeList = root.querySelectorAll('.codex-node');
    const nodeCount = nodeList.length;

    if (perf) {
        console.log('[Codex Redraw] Found ' + nodeCount + ' nodes in DOM');
        console.log(`[Codex Perf] redrawCodexEdges: ${nodeCount} visible nodes, ${edges.length} edges`);
    }

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const ns = 'http://www.w3.org/2000/svg';
    const vw = worldEl ? CODEX_WORLD_W : Math.max(1, root.clientWidth);
    const vh = worldEl ? CODEX_WORLD_H : Math.max(1, root.clientHeight);

    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('width', String(vw));
    svg.setAttribute('height', String(vh));
    const useViewportCull = mode === 'view' ? false
        : dragIds.size === 0
        && (nodeCount >= CODEX_VIEWPORT_CULL_MIN_NODES || edges.length >= CODEX_VIEWPORT_CULL_MIN_EDGES);
    const visibleRect = _rt.getCodexVisibleWorldBoundsExpanded(CODEX_EDGE_CULL_MARGIN_PX);

    if (edges.length === 0) {
        const defs = document.createElementNS(ns, 'defs');
        svg.appendChild(defs);
        const hitPickRoot = document.createElementNS(ns, 'g');
        hitPickRoot.classList.add('codex-edges-hit-pick');
        svg.appendChild(hitPickRoot);
        const contentRoot = document.createElementNS(ns, 'g');
        contentRoot.classList.add('codex-edges-masked');
        svg.appendChild(contentRoot);
        const degLabelsG = document.createElementNS(ns, 'g');
        degLabelsG.classList.add('codex-edge-degree-labels');
        degLabelsG.setAttribute('pointer-events', 'none');
        svg.appendChild(degLabelsG);
        if (dragIds.size === 0) {
            _rt.syncCodexNodeCoordLabels(nodeList);
        }
        _rt.syncCodexCordPacketState([]);
        _rt.codexStopCordAnimRafOnly();
        _rt.syncCodexNodeDomCullFromView(nodeList);
        return;
    }

    /** @type {{ edge: (typeof edges)[0], pts: { x: number, y: number }[] }[]} */
    const edgePolysFull = [];
    edges.forEach((edge) => {
        const pts = _rt.buildPolylineForEdge(edge);
        if (pts && pts.length >= 2) edgePolysFull.push({ edge, pts });
    });

    const edgePolys = useViewportCull
        ? edgePolysFull.filter(({ pts }) => _rt.codexEdgePolyIntersectsRect(pts, visibleRect))
        : edgePolysFull;

    let maskWorldRect = null;
    if (useViewportCull) {
        if (edgePolys.length > 0) {
            maskWorldRect = _rt.codexUnionBoundsFromEdgePolys(edgePolys, CODEX_MASK_PAD_WORLD_FROM_EDGES);
        } else {
            const z = worldEl ? Math.max(0.05, viewZoom) : 1;
            const pad = 360 / z;
            maskWorldRect = {
                minX: visibleRect.minX - pad,
                minY: visibleRect.minY - pad,
                maxX: visibleRect.maxX + pad,
                maxY: visibleRect.maxY + pad
            };
        }
    }

    const defs = document.createElementNS(ns, 'defs');
    const cordFilt = {
        stdDeviation: visualPrefs.cordBlur,
        morphRadius: visualPrefs.cordMorph,
        blurLayers: visualPrefs.cordGlowLayers,
        viewW: vw,
        viewH: vh
    };
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-violet-glow', 'violetBlur', cordFilt);
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-yellow-glow', 'yellowBlur', cordFilt);
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-red-glow', 'redBlur', cordFilt);
    _rt.appendSoftPacketGlowFilter(defs, 'codex-edge-packet-pink-soft', 'pktPinkBlur', {
        stdDeviation: visualPrefs.cordBlur * visualPrefs.packetBlurMult,
        morphRadius: visualPrefs.cordMorph * visualPrefs.packetMorphMult,
        blurLayers: visualPrefs.packetGlowLayers,
        viewW: vw,
        viewH: vh
    });
    _rt.appendCodexEdgeNodeMask(defs, ns, vw, vh, maskWorldRect);
    svg.appendChild(defs);

    const hitPickRoot = document.createElementNS(ns, 'g');
    hitPickRoot.classList.add('codex-edges-hit-pick');
    svg.appendChild(hitPickRoot);

    const contentRoot = document.createElementNS(ns, 'g');
    contentRoot.classList.add('codex-edges-masked');
    contentRoot.setAttribute('mask', `url(#${CODEX_EDGES_NODE_ALPHA_MASK_ID})`);
    svg.appendChild(contentRoot);

    _rt.appendCodexJunctionElbowParallelograms(contentRoot, ns, useViewportCull ? visibleRect : null);

    edgePolys.forEach(({ edge, pts }) => {
        const { fromId, toId } = edge;
        const appearance = _rt.edgeCordAppearance(edge);
        const strokeColor = appearance === 'red'
            ? '#f87171'
            : appearance === 'yellow'
                ? '#fbbf24'
                : visualPrefs.cordColor;
        const filterUrl = appearance === 'red'
            ? 'url(#codex-edge-red-glow)'
            : appearance === 'yellow'
                ? 'url(#codex-edge-yellow-glow)'
                : 'url(#codex-edge-violet-glow)';
        for (let seg = 0; seg < pts.length - 1; seg++) {
            const p0 = pts[seg];
            const p1 = pts[seg + 1];
            _rt.appendCordFilteredLineGroup(contentRoot, ns, {
                x1: p0.x,
                y1: p0.y,
                x2: p1.x,
                y2: p1.y,
                stroke: strokeColor,
                strokeWidth: visualPrefs.cordThickness,
                filterUrl,
                lineClass: 'codex-edge-segment',
                edgeFromId: fromId,
                edgeToId: toId
            });
        }
    });

    edgePolys.forEach(({ edge, pts }) => {
        const { fromId, toId } = edge;
        for (let seg = 0; seg < pts.length - 1; seg++) {
            const p0 = pts[seg];
            const p1 = pts[seg + 1];
            const hit = document.createElementNS(ns, 'line');
            hit.classList.add('codex-edge-hit');
            hit.setAttribute('x1', String(p0.x));
            hit.setAttribute('y1', String(p0.y));
            hit.setAttribute('x2', String(p1.x));
            hit.setAttribute('y2', String(p1.y));
            hit.setAttribute('stroke', 'transparent');
            hit.setAttribute('stroke-width', String(CODEX_EDGE_HIT_PICK_STROKE_PX));
            hit.setAttribute('stroke-linecap', 'round');
            hit.dataset.codexEdgeFrom = fromId;
            hit.dataset.codexEdgeTo = toId;
            hit.dataset.codexSeg = String(seg);

            if (mode !== 'view') {
                hit.addEventListener('contextmenu', (evt) => {
                    evt.preventDefault();
                    evt.stopPropagation();

                    const ed = _rt.findEdge(fromId, toId);
                    if (!ed) return;
                    const k = codexUnorderedPairKey(fromId, toId);
                    const now = Date.now();
                    const cordMap = _rt.getCordDoubleRightLastTs();
                    const prev = cordMap.get(k) || 0;
                    if (now - prev < _rt.getDoubleRightMs()) {
                        cordMap.delete(k);
                        _rt.setCordPendingDeletePairKey(null);
                        _rt.removeCodexEdgeDirected(fromId, toId);
                    } else {
                        _rt.clearPendingCodexDeleteState();
                        _rt.setCordPendingDeletePairKey(k);
                        cordMap.set(k, now);
                        redrawCodexEdges();
                    }
                });
            }
            hitPickRoot.appendChild(hit);
        }
    });

    const degLabelsG = document.createElementNS(ns, 'g');
    degLabelsG.classList.add('codex-edge-degree-labels');
    degLabelsG.setAttribute('pointer-events', 'none');
    edgePolys.forEach(({ edge, pts }) => {
        for (let seg = 0; seg < pts.length - 1; seg++) {
            const p0 = pts[seg];
            const p1 = pts[seg + 1];
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len = Math.hypot(dx, dy);
            if (len < 48) continue;
            const actualDeg = _rt.cordSegmentDegreesLabel(p0, p1);
            if (actualDeg == null) continue;
            const whileDrag = dragIds.size > 0;
            const onOctilinearLane = _rt.cordSegmentWithinOctilinearToleranceDegrees(p0, p1);
            const mx = (p0.x + p1.x) / 2;
            const my = (p0.y + p1.y) / 2;
            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;
            const off = 36;
            const ax = mx + nx * off;
            const ay = my + ny * off;
            const fsD = CODEX_EDGE_DEGREE_FONT_PX;

            const stackG = document.createElementNS(ns, 'g');
            stackG.classList.add('codex-edge-degree-stack');
            const stackTitle = document.createElementNS(ns, 'title');
            stackTitle.textContent = whileDrag
                ? `Bearing ${actualDeg}°. On release, cords snap to the nearest 45° direction when within `
                    + `±${CODEX_OCT_SOFT_SNAP_TOL_DEG}° of that lane. Coordinates under nodes are world centers.`
                : `Bearing ${actualDeg}° (0° = east → 90° = south, world y down), node-center to node-center. `
                    + `Green when within ±${CODEX_OCT_SOFT_SNAP_TOL_DEG}° of a 45° direction. `
                    + 'Coordinates under nodes are world centers.';
            stackG.appendChild(stackTitle);

            const t = document.createElementNS(ns, 'text');
            t.classList.add('codex-edge-degree');
            if (onOctilinearLane) t.classList.add('codex-edge-degree--octilinear');
            t.setAttribute('font-size', String(fsD));
            t.setAttribute('x', String(ax));
            t.setAttribute('y', String(ay));
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'middle');
            t.textContent = `${actualDeg}°`;
            stackG.appendChild(t);

            degLabelsG.appendChild(stackG);
        }
    });
    svg.appendChild(degLabelsG);

    if (dragIds.size === 0) {
        _rt.syncCodexNodeCoordLabels(nodeList);
    }

    _rt.syncCodexCordPacketState(edgePolys);
    if (edgePolys.length === 0) {
        _rt.codexStopCordAnimRafOnly();
    } else {
        const pktG = document.createElementNS(ns, 'g');
        pktG.classList.add('codex-edge-packets');
        contentRoot.appendChild(pktG);

        _rt.ensureCodexCordAnimationLoop();
    }

    _rt.syncCodexNodeDomCullFromView(nodeList);

    if (mode === 'view' && !viewInitialDone) {
        const visibleNodeCount = nodeList ? nodeList.length : 0;
        if (perf) {
            console.log('[Codex Redraw] View Mode render complete - visibleNodeCount=' + visibleNodeCount);
            console.log('[Codex Redraw] Marking View Mode initial render as DONE');
            console.log('[Codex Perf] View Mode initial render complete with ' + visibleNodeCount + ' visible nodes');
        }
        _rt.setViewModeInitialRenderDone(true);
    }

    const elapsed = performance.now() - startTime;
    if (perf) {
        console.log('[Codex Redraw] Completed in ' + elapsed.toFixed(2) + 'ms');
        console.log(`[Codex Perf] redrawCodexEdges completed in ${elapsed.toFixed(2)}ms`);
    }
}
