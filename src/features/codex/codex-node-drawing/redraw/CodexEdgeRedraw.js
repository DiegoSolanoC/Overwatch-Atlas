/**
 * Codex directed-edge SVG redraw + RAF debounce. Canvas service registers live state/callbacks once per mount.
 */

import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { codexUnorderedPairKey } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { codexEdgeIsHiddenOnBoard } from '../../codex-connections/codexHiddenConnectionCords.js';
import {
    CODEX_EDGE_CULL_MARGIN_PX,
    CODEX_EDGE_DEGREE_FONT_PX,
    CODEX_EDGE_HIT_PICK_STROKE_PX,
    CODEX_EDGES_NODE_ALPHA_MASK_ID,
    CODEX_MASK_PAD_WORLD_FROM_EDGES,
    CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX,
    CODEX_NODE_DOM_CULL_MIN_NODES,
    CODEX_OCT_SOFT_SNAP_TOL_DEG,
    CODEX_VIEWPORT_CULL_MIN_EDGES,
    CODEX_VIEWPORT_CULL_MIN_NODES
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import {
    registerCodexEdgeDragSyncRuntime,
    syncCodexEdgesDuringNodeDrag,
    unregisterCodexEdgeDragSyncRuntime,
} from './CodexEdgeDragSync.js';
import {
    appendCodexEdgeNodeMaskBlackRect,
    appendCodexEdgeNodeMaskForElement,
    createCodexEdgeNodeMaskShell,
    nodeFrameIntersectsRect,
} from '../svg/CodexNodeFrameSvg.js';
import { codexNodeFrameFromLayoutRecord } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { syncCodexCordPacketStateDuringLoad } from '../packets/CodexCordPacketAnimation.js';

/** @type {CodexEdgeRedrawRuntime|null} */
let _rt = null;

/** @type {ReturnType<typeof setTimeout>|0} */
let edgeRedrawScheduleTimer = 0;

/** @type {number} */
let edgeDragSyncRaf = 0;

const CODEX_LOAD_REDRAW_CHUNK = 96;
const CODEX_LOAD_REDRAW_PROGRESS_EVERY = 64;
const CODEX_LOAD_MASK_CHUNK = 128;
const CODEX_LOAD_DOM_CULL_CHUNK = 32;
const CODEX_LOAD_YIELD_WORK_BUDGET = 160;

const CONNECTION_LOAD_PHASE_SPAN = {
    plan: 0.32,
    prep: 0.08,
    draw: 0.56,
    finish: 0.04,
};

/** @type {Map<string, object>|null} */
let _loadSavedNodeMap = null;

function yieldCodexLoadRedraw() {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve(), { timeout: 16 });
        } else {
            requestAnimationFrame(resolve);
        }
    });
}

async function yieldCodexLoadRedrawIfBudget(workUnits, state) {
    state.units += workUnits;
    if (state.units >= CODEX_LOAD_YIELD_WORK_BUDGET) {
        state.units = 0;
        await yieldCodexLoadRedraw();
    }
}

function buildCodexSavedNodeMap() {
    const nodes = _rt?.getCodexAllNodes?.() || [];
    const map = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node?.id) map.set(node.id, node);
    }
    return map;
}

function buildPolylineForEdgeDuringLoad(edge) {
    if (_loadSavedNodeMap && _rt.buildPolylineForEdgeFromSavedLayout) {
        const pts = _rt.buildPolylineForEdgeFromSavedLayout(edge, _loadSavedNodeMap);
        if (pts && pts.length >= 2) return pts;
    }
    return _rt.buildPolylineForEdge(edge);
}

function resolveVisibleRedrawEdges() {
    if (!_rt) return [];
    let edges = _rt.getEdges().filter((e) => !codexEdgeIsHiddenOnBoard(e));
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
 * @param {object} [opts]
 * @param {(info: { phase: string, done: number, total: number }) => void} [opts.onProgress]
 * @param {(line: string) => void} [opts.onStatusLine]
 * @param {string} phase
 * @param {number} done
 * @param {number} total
 */
function emitRedrawLoadProgress(opts, phase, done, total) {
    if (!opts?.onProgress && !opts?.onStatusLine) return;
    const payload = { phase, done, total };
    opts.onProgress?.(payload);
    if (typeof opts.onStatusLine === 'function') {
        const labels = {
            plan: 'Planning connections',
            prep: 'Preparing connection layer',
            draw: 'Drawing connections',
            hits: 'Preparing connection picks',
            finish: 'Finishing connections',
        };
        const label = labels[phase] || 'Drawing connections';
        opts.onStatusLine(total > 0 ? `${label}… ${done} / ${total}` : `${label}…`);
    }
}

function reportLoadPhaseFraction(opts, phase, done, total) {
    if (!opts?.onProgress) return;
    const phaseSpan = CONNECTION_LOAD_PHASE_SPAN[phase] ?? 0;
    const phaseBase = phase === 'prep'
        ? CONNECTION_LOAD_PHASE_SPAN.plan
        : phase === 'draw'
            ? CONNECTION_LOAD_PHASE_SPAN.plan + CONNECTION_LOAD_PHASE_SPAN.prep
            : phase === 'finish'
                ? CONNECTION_LOAD_PHASE_SPAN.plan + CONNECTION_LOAD_PHASE_SPAN.prep + CONNECTION_LOAD_PHASE_SPAN.draw
                : 0;
    const local = total > 0 ? done / total : 1;
    opts.onProgress({
        phase,
        done,
        total,
        fraction: phaseBase + local * phaseSpan,
    });
}

/**
 * @param {SVGGElement} contentRoot
 * @param {string} ns
 * @param {object} visualPrefs
 * @param {{ fromId: string, toId: string }} edge
 * @param {{ x: number, y: number }[]} pts
 */
function appendEdgeCordPoly(contentRoot, ns, visualPrefs, edge, pts) {
    const { fromId, toId } = edge;
    const appearance = _rt.edgeCordAppearance(edge);
    const filterDormant = _rt.edgeCordIsFilterDormant?.(edge) === true;
    const strokeColor = appearance === 'red'
        ? '#f87171'
        : appearance === 'yellow'
            ? '#fbbf24'
            : appearance === 'green'
                ? '#4ade80'
                : appearance === 'grey'
                    ? 'rgba(100, 108, 128, 0.55)'
                    : visualPrefs.cordColor;
    const filterUrl = appearance === 'red'
        ? 'url(#codex-edge-red-glow)'
        : appearance === 'yellow'
            ? 'url(#codex-edge-yellow-glow)'
            : appearance === 'green'
                ? 'url(#codex-edge-green-glow)'
                : appearance === 'grey'
                    ? 'none'
                    : 'url(#codex-edge-violet-glow)';
    const lineClass = appearance === 'grey'
        ? (filterDormant
            ? 'codex-edge-segment codex-edge-segment--timeline-dormant codex-edge-segment--filter-dormant'
            : 'codex-edge-segment codex-edge-segment--timeline-dormant')
        : appearance === 'violet-dim'
            ? 'codex-edge-segment codex-edge-segment--timeline-range-inactive'
            : appearance === 'green'
                ? 'codex-edge-segment codex-edge-segment--filter-linked'
                : 'codex-edge-segment';
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
            lineClass,
            edgeFromId: fromId,
            edgeToId: toId
        });
    }
}

/**
 * @param {SVGGElement} hitPickRoot
 * @param {string} ns
 * @param {'dev'|'view'} mode
 * @param {{ fromId: string, toId: string }} edge
 * @param {{ x: number, y: number }[]} pts
 */
function appendEdgeHitPoly(hitPickRoot, ns, mode, edge, pts) {
    const { fromId, toId } = edge;
    const filterDormant = _rt.edgeCordIsFilterDormant?.(edge) === true;
    if (filterDormant) return;
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
}

function finalizeCodexEdgePaint(ctx, progressOpts) {
    const {
        svg,
        hitPickRoot,
        degLabelsG,
        ns,
        edgePolys,
        nodeList,
        mode,
        dragIds,
        viewInitialDone,
        perf,
        startTime,
    } = ctx;

    svg.appendChild(hitPickRoot);
    svg.appendChild(degLabelsG);

    if (dragIds.size === 0) {
        _rt.syncCodexNodeCoordLabels(nodeList);
    }

    if (dragIds.size === 0) {
        _rt.syncCodexCordPacketState(edgePolys);
        if (edgePolys.length === 0) {
            _rt.codexStopCordAnimRafOnly();
        } else {
            const pktG = document.createElementNS(ns, 'g');
            pktG.classList.add('codex-edge-packets');
            ctx.contentRoot.appendChild(pktG);
            _rt.ensureCodexCordAnimationLoop();
        }
    }

    _rt.syncCodexNodeDomCullFromView(nodeList);

    if (dragIds.size > 0) {
        _rt.setDragUseLightSync?.(true);
    } else {
        _rt.setDragUseLightSync?.(false);
    }

    if (mode === 'view' && !viewInitialDone) {
        _rt.setViewModeInitialRenderDone(true);
    }

    emitRedrawLoadProgress(progressOpts, 'finish', 1, 1);
    reportLoadPhaseFraction(progressOpts, 'finish', 1, 1);

    const elapsed = performance.now() - startTime;
    if (perf) {
        console.log('[Codex Redraw] Completed in ' + elapsed.toFixed(2) + 'ms');
        console.log(`[Codex Perf] redrawCodexEdges completed in ${elapsed.toFixed(2)}ms`);
    }
}

function scheduleDeferredCodexJunctionDecor(contentRoot, ns, edges) {
    if (!contentRoot || !edges?.length || !_rt) return;
    // Elbow facets scan edges²; keep them off the critical path after open.
    if (_rt.getMode?.() === 'view') return;
    const run = () => {
        if (!contentRoot.isConnected || !_rt) return;
        _rt.appendCodexJunctionElbowParallelograms(contentRoot, ns, null, edges);
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 4000 });
    } else {
        setTimeout(run, 2000);
    }
}

function scheduleDeferredCodexPostLoadDomCull(ctx) {
    const { edgePolys, nodeList, dragIds, mode } = ctx;
    if (!_rt || dragIds.size > 0) return;

    const run = async () => {
        if (!_rt?.getRoot()) return;

        if (edgePolys.length > 0) {
            await syncCodexCordPacketStateDuringLoad(edgePolys, yieldCodexLoadRedraw);
            _rt.ensureCodexCordAnimationLoop?.();
        }

        if (mode !== 'view') {
            await syncCodexNodeDomCullDuringLoad(nodeList, null);
        }
    };

    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => {
            void run();
        }, { timeout: 600 });
    } else {
        setTimeout(() => {
            void run();
        }, 16);
    }
}

async function syncCodexNodeDomCullDuringLoad(nodeList, progressOpts) {
    if (!_rt) return;
    const list = Array.from(nodeList || []);
    if (!list.length) return;

    if (_rt.getActiveDragNodeIds?.().size > 0) return;

    const useCull = list.length >= CODEX_NODE_DOM_CULL_MIN_NODES;
    const visibleRect = useCull
        ? _rt.getCodexVisibleWorldBoundsExpanded(CODEX_EDGE_CULL_MARGIN_PX + CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX)
        : null;

    if (!visibleRect) {
        _rt.syncCodexNodeDomCullFromView(list);
        return;
    }

    const total = list.length;
    if (progressOpts) {
        emitRedrawLoadProgress(progressOpts, 'finish', 0, total);
        reportLoadPhaseFraction(progressOpts, 'finish', 0, total);
        await yieldCodexLoadRedraw();
    }

    for (let start = 0; start < total; start += CODEX_LOAD_DOM_CULL_CHUNK) {
        const end = Math.min(start + CODEX_LOAD_DOM_CULL_CHUNK, total);
        for (let i = start; i < end; i++) {
            const el = list[i];
            if (nodeFrameIntersectsRect(el, visibleRect)) {
                el.classList.remove('codex-node--cv-offscreen');
            } else {
                el.classList.add('codex-node--cv-offscreen');
            }
        }
        if (progressOpts) {
            emitRedrawLoadProgress(progressOpts, 'finish', end, total);
            reportLoadPhaseFraction(progressOpts, 'finish', end, total);
        }
        if (end < total) {
            await yieldCodexLoadRedraw();
        }
    }
}

/**
 * @param {object} ctx
 * @param {object} progressOpts
 */
async function finalizeCodexEdgePaintDuringLoad(ctx, progressOpts) {
    const {
        svg,
        hitPickRoot,
        degLabelsG,
        ns,
        edgePolys,
        nodeList,
        mode,
        dragIds,
        viewInitialDone,
        perf,
        startTime,
        contentRoot,
        edges,
    } = ctx;

    svg.appendChild(hitPickRoot);
    svg.appendChild(degLabelsG);
    await yieldCodexLoadRedraw();

    if (dragIds.size === 0 && edgePolys.length > 0) {
        const pktG = document.createElementNS(ns, 'g');
        pktG.classList.add('codex-edge-packets');
        contentRoot.appendChild(pktG);
    }

    if (dragIds.size > 0) {
        _rt.setDragUseLightSync?.(true);
    } else {
        _rt.setDragUseLightSync?.(false);
    }

    if (mode === 'view' && !viewInitialDone) {
        _rt.setViewModeInitialRenderDone(true);
    }

    scheduleDeferredCodexJunctionDecor(contentRoot, ns, edges);
    scheduleDeferredCodexPostLoadDomCull(ctx);

    emitRedrawLoadProgress(progressOpts, 'finish', 1, 1);
    reportLoadPhaseFraction(progressOpts, 'finish', 1, 1);

    const elapsed = performance.now() - startTime;
    if (perf) {
        console.log('[Codex Redraw] Completed in ' + elapsed.toFixed(2) + 'ms');
        console.log(`[Codex Perf] redrawCodexEdges completed in ${elapsed.toFixed(2)}ms`);
    }
}

/**
 * SVG setup + chunked node-alpha mask before cord paint (initial open only).
 * @param {{ force?: boolean, prebuiltEdgePolysFull?: { edge: object, pts: { x: number, y: number }[] }[], onProgress?: Function, onStatusLine?: Function }} opts
 */
async function prepareCodexEdgePaintContextDuringLoad(opts) {
    if (!_rt) return null;

    const forceRedraw = opts?.force === true;
    const perf = _rt.getPerfDebug();
    const mode = _rt.getMode();
    const viewInitialDone = _rt.getViewModeInitialRenderDone();
    const skipAll = _rt.getSkipAllEdgeRedraws();
    const skipEdge = _rt.getSkipEdgeRedraw();
    const root = _rt.getRoot();
    const worldEl = _rt.getWorldEl();
    const dragIds = _rt.getActiveDragNodeIds();
    const edges = resolveVisibleRedrawEdges();
    const viewZoom = _rt.getViewZoom();
    const visualPrefs = _rt.getVisualPrefs();
    const progressOpts = {
        onProgress: opts.onProgress,
        onStatusLine: opts.onStatusLine,
    };

    if (mode === 'view' && viewInitialDone && !forceRedraw) return null;
    if (skipAll && !forceRedraw && !(mode === 'view' && !viewInitialDone)) return null;
    if (skipEdge && !forceRedraw && !(mode === 'view' && !viewInitialDone)) return null;

    const svg = root?.querySelector('.codex-edges-layer');
    if (!svg || !root) return null;

    if (edgeRedrawScheduleTimer) {
        clearTimeout(edgeRedrawScheduleTimer);
        edgeRedrawScheduleTimer = 0;
    }

    const startTime = performance.now();
    const nodeList = root.querySelectorAll('.codex-node');

    emitRedrawLoadProgress(progressOpts, 'prep', 0, 1);
    reportLoadPhaseFraction(progressOpts, 'prep', 0, 1);
    await yieldCodexLoadRedraw();

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const ns = 'http://www.w3.org/2000/svg';
    const vw = worldEl ? CODEX_WORLD_W : Math.max(1, root.clientWidth);
    const vh = worldEl ? CODEX_WORLD_H : Math.max(1, root.clientHeight);

    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.setAttribute('width', String(vw));
    svg.setAttribute('height', String(vh));

    const useViewportCull = mode === 'view' ? false
        : dragIds.size === 0
        && (nodeList.length >= CODEX_VIEWPORT_CULL_MIN_NODES || edges.length >= CODEX_VIEWPORT_CULL_MIN_EDGES);
    const visibleRect = _rt.getCodexVisibleWorldBoundsExpanded(CODEX_EDGE_CULL_MARGIN_PX);

    let edgePolysFull = opts.prebuiltEdgePolysFull;
    if (!edgePolysFull) {
        edgePolysFull = [];
        edges.forEach((edge) => {
            const pts = _rt.buildPolylineForEdge(edge);
            if (pts && pts.length >= 2) edgePolysFull.push({ edge, pts });
        });
    }

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
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-green-glow', 'greenBlur', cordFilt);
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-yellow-glow', 'yellowBlur', cordFilt);
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-red-glow', 'redBlur', cordFilt);
    _rt.appendSoftPacketGlowFilter(defs, 'codex-edge-packet-pink-soft', 'pktPinkBlur', {
        stdDeviation: visualPrefs.cordBlur * visualPrefs.packetBlurMult,
        morphRadius: visualPrefs.cordMorph * visualPrefs.packetMorphMult,
        blurLayers: visualPrefs.packetGlowLayers,
        viewW: vw,
        viewH: vh
    });

    const mask = createCodexEdgeNodeMaskShell(ns, vw, vh, CODEX_EDGES_NODE_ALPHA_MASK_ID);
    const useFastLayoutMask = mode === 'view' && _rt.getCodexAllNodes?.()?.length > 0;
    const maskRecords = useFastLayoutMask
        ? _rt.getCodexAllNodes().filter((node) => node.kind !== 'junction')
        : null;
    const maskTotal = useFastLayoutMask
        ? maskRecords.length
        : Array.from(nodeList).filter((el) => {
            if (el.dataset.codexKind === 'junction') return false;
            if (maskWorldRect && !nodeFrameIntersectsRect(el, maskWorldRect)) return false;
            return true;
        }).length;

    emitRedrawLoadProgress(progressOpts, 'prep', 0, maskTotal || 1);
    reportLoadPhaseFraction(progressOpts, 'prep', 0, maskTotal || 1);
    await yieldCodexLoadRedraw();

    const maskYield = { units: 0 };
    if (useFastLayoutMask && maskRecords) {
        for (let start = 0; start < maskTotal; start += CODEX_LOAD_MASK_CHUNK) {
            const end = Math.min(start + CODEX_LOAD_MASK_CHUNK, maskTotal);
            for (let i = start; i < end; i++) {
                const frame = codexNodeFrameFromLayoutRecord(maskRecords[i]);
                if (frame) appendCodexEdgeNodeMaskBlackRect(mask, ns, frame);
            }
            emitRedrawLoadProgress(progressOpts, 'prep', end, maskTotal || 1);
            reportLoadPhaseFraction(progressOpts, 'prep', end, maskTotal || 1);
            if (end < maskTotal) {
                await yieldCodexLoadRedrawIfBudget(end - start, maskYield);
            }
        }
    } else {
        const maskNodes = Array.from(nodeList).filter((el) => {
            if (el.dataset.codexKind === 'junction') return false;
            if (maskWorldRect && !nodeFrameIntersectsRect(el, maskWorldRect)) return false;
            return true;
        });
        for (let start = 0; start < maskNodes.length; start += CODEX_LOAD_MASK_CHUNK) {
            const end = Math.min(start + CODEX_LOAD_MASK_CHUNK, maskNodes.length);
            for (let i = start; i < end; i++) {
                appendCodexEdgeNodeMaskForElement(mask, ns, maskNodes[i], maskWorldRect);
            }
            emitRedrawLoadProgress(progressOpts, 'prep', end, maskTotal || 1);
            reportLoadPhaseFraction(progressOpts, 'prep', end, maskTotal || 1);
            if (end < maskNodes.length) {
                await yieldCodexLoadRedrawIfBudget(end - start, maskYield);
            }
        }
    }

    defs.appendChild(mask);
    svg.appendChild(defs);

    const hitPickRoot = document.createElementNS(ns, 'g');
    hitPickRoot.classList.add('codex-edges-hit-pick');

    const contentRoot = document.createElementNS(ns, 'g');
    contentRoot.classList.add('codex-edges-masked');
    contentRoot.setAttribute('mask', `url(#${CODEX_EDGES_NODE_ALPHA_MASK_ID})`);
    svg.appendChild(contentRoot);

    const degLabelsG = document.createElementNS(ns, 'g');
    degLabelsG.classList.add('codex-edge-degree-labels');
    degLabelsG.setAttribute('pointer-events', 'none');

    emitRedrawLoadProgress(progressOpts, 'prep', maskTotal || 1, maskTotal || 1);
    reportLoadPhaseFraction(progressOpts, 'prep', maskTotal || 1, maskTotal || 1);
    await yieldCodexLoadRedraw();

    return {
        contentRoot,
        hitPickRoot,
        degLabelsG,
        ns,
        edgePolys,
        nodeList,
        mode,
        visualPrefs,
        dragIds,
        viewInitialDone,
        svg,
        startTime,
        perf,
        edges,
    };
}

/**
 * @param {object} ctx
 * @param {object} opts
 */
async function completeCodexEdgePaintDuringLoad(ctx, opts) {
    const progressOpts = {
        onProgress: opts.onProgress,
        onStatusLine: opts.onStatusLine,
    };
    const {
        contentRoot,
        hitPickRoot,
        degLabelsG,
        ns,
        edgePolys,
        nodeList,
        mode,
        visualPrefs,
        dragIds,
    } = ctx;
    const total = edgePolys.length;
    const yieldBudget = { units: 0 };

    emitRedrawLoadProgress(progressOpts, 'draw', 0, total);
    reportLoadPhaseFraction(progressOpts, 'draw', 0, total);
    await yieldCodexLoadRedraw();

    for (let start = 0; start < total; start += CODEX_LOAD_REDRAW_CHUNK) {
        const end = Math.min(start + CODEX_LOAD_REDRAW_CHUNK, total);
        for (let i = start; i < end; i++) {
            const { edge, pts } = edgePolys[i];
            appendEdgeCordPoly(contentRoot, ns, visualPrefs, edge, pts);
            appendEdgeHitPoly(hitPickRoot, ns, mode, edge, pts);
        }
        emitRedrawLoadProgress(progressOpts, 'draw', end, total);
        reportLoadPhaseFraction(progressOpts, 'draw', end, total);
        if (end < total) {
            await yieldCodexLoadRedrawIfBudget(end - start, yieldBudget);
        }
    }

    emitRedrawLoadProgress(progressOpts, 'finish', 0, 1);
    reportLoadPhaseFraction(progressOpts, 'finish', 0, 1);
    await yieldCodexLoadRedraw();

    if (dragIds.size === 0 && mode !== 'view') {
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
                stackTitle.textContent = `Bearing ${actualDeg}° (0° = east → 90° = south, world y down), node-center to node-center. `
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
    }

    await finalizeCodexEdgePaintDuringLoad(ctx, progressOpts);
}

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
 * @property {(edge: { fromId: string, toId: string }, nodeById: Map<string, object>) => { x: number, y: number }[]|null} [buildPolylineForEdgeFromSavedLayout]
 * @property {() => { id: string, kind?: string, x: number, y: number, scale?: number }[]} [getCodexAllNodes]
 * @property {(marginPx: number) => object} getCodexVisibleWorldBoundsExpanded
 * @property {(pts: { x: number, y: number }[], r: object) => boolean} codexEdgePolyIntersectsRect
 * @property {(edgePolys: { pts: { x: number, y: number }[] }[], pad: number) => object|null} codexUnionBoundsFromEdgePolys
 * @property {(parentG: SVGGElement, ns: string, worldCullRect: object|null, edgesForDecor?: { fromId: string, toId: string }[]) => void} appendCodexJunctionElbowParallelograms
 * @property {(defs: SVGDefsElement, id: string, blurResultId: string, opts: object) => void} appendEdgeGlowFilter
 * @property {(defs: SVGDefsElement, id: string, blurResultId: string, opts: object) => void} appendSoftPacketGlowFilter
 * @property {(defs: SVGDefsElement, ns: string, vw: number, vh: number, maskWorldRect?: object|null) => void} appendCodexEdgeNodeMask
 * @property {(parent: SVGGElement, ns: string, opts: object) => void} appendCordFilteredLineGroup
 * @property {(nodeList?: NodeListOf<Element>|Element[]|undefined) => void} syncCodexNodeDomCullFromView
 * @property {(nodeList?: NodeListOf<Element>|Element[]|undefined) => void} syncCodexNodeCoordLabels
 * @property {(edgePolys: { edge: object, pts: { x: number, y: number }[] }[]) => void} syncCodexCordPacketState
 * @property {() => void} codexStopCordAnimRafOnly
 * @property {() => void} ensureCodexCordAnimationLoop
 * @property {(edge: { fromId: string, toId: string }) => 'red'|'yellow'|'violet'|'green'|'grey'} edgeCordAppearance
 * @property {(edge: { fromId: string, toId: string }) => boolean} [edgeCordIsFilterDormant]
 * @property {(p0: object, p1: object) => number|null} cordSegmentDegreesLabel
 * @property {(p0: object, p1: object, tolDeg?: number) => boolean} cordSegmentWithinOctilinearToleranceDegrees
 * @property {() => boolean} [getTargetedSelectionActive]
 * @property {() => Set<string>} [getTargetedSelectionVisibleIds]
 * @property {() => Set<string>} [getTargetedSelectionVisibleEdgeKeys]
 * @property {() => boolean} [getDragUseLightSync]
 * @property {(v: boolean) => void} [setDragUseLightSync]
 * @property {(id: string) => HTMLElement|null} [codexNodeElById]
 * @property {(el: HTMLElement) => { x: number, y: number }} [getNodeCenterWorldPx]
 * @property {() => boolean} [syncCodexEdgeNodeMaskDom]
 */

/**
 * @param {CodexEdgeRedrawRuntime} rt
 */
export function registerCodexEdgeRedrawRuntime(rt) {
    _rt = rt;
    registerCodexEdgeDragSyncRuntime({
        getRoot: rt.getRoot,
        getEdges: rt.getEdges,
        getActiveDragNodeIds: rt.getActiveDragNodeIds,
        getDragUseLightSync: rt.getDragUseLightSync ?? (() => false),
        setDragUseLightSync: rt.setDragUseLightSync ?? (() => {}),
        buildPolylineForEdge: rt.buildPolylineForEdge,
        buildPolylineForEdgeFromSavedLayout: rt.buildPolylineForEdgeFromSavedLayout,
        getCodexAllNodes: rt.getCodexAllNodes,
        codexNodeElById: rt.codexNodeElById ?? (() => null),
        getNodeCenterWorldPx: rt.getNodeCenterWorldPx ?? (() => ({ x: 0, y: 0 })),
        getTargetedSelectionActive: rt.getTargetedSelectionActive,
        getTargetedSelectionVisibleIds: rt.getTargetedSelectionVisibleIds,
        getTargetedSelectionVisibleEdgeKeys: rt.getTargetedSelectionVisibleEdgeKeys,
        syncCodexEdgeNodeMaskDom: rt.syncCodexEdgeNodeMaskDom,
    });
}

export function unregisterCodexEdgeRedrawRuntime() {
    clearCodexEdgeRedrawSchedule();
    unregisterCodexEdgeDragSyncRuntime();
    _rt = null;
}

export function clearCodexEdgeRedrawSchedule() {
    if (edgeRedrawScheduleTimer) {
        clearTimeout(edgeRedrawScheduleTimer);
        edgeRedrawScheduleTimer = 0;
    }
    if (edgeDragSyncRaf) {
        cancelAnimationFrame(edgeDragSyncRaf);
        edgeDragSyncRaf = 0;
    }
}

/** Batches edge redraws; uses in-place geometry sync while nodes are dragged. */
export function scheduleRedrawCodexEdges() {
    if (!_rt) return;
    if (_rt.getMode() === 'view' && _rt.getViewModeInitialRenderDone()) return;

    if (_rt.getActiveDragNodeIds().size > 0) {
        if (edgeDragSyncRaf) return;
        edgeDragSyncRaf = requestAnimationFrame(() => {
            edgeDragSyncRaf = 0;
            if (!syncCodexEdgesDuringNodeDrag()) {
                redrawCodexEdges();
            }
        });
        return;
    }

    if (edgeRedrawScheduleTimer) return;
    edgeRedrawScheduleTimer = setTimeout(() => {
        edgeRedrawScheduleTimer = 0;
        requestAnimationFrame(() => redrawCodexEdges());
    }, 16);
}

/**
 * @param {{ force?: boolean, prebuiltEdgePolysFull?: { edge: object, pts: { x: number, y: number }[] }[], deferCordPaint?: boolean, onProgress?: (info: { phase: string, done: number, total: number }) => void, onStatusLine?: (line: string) => void }} [opts]
 */
export function redrawCodexEdges(opts = {}) {
    if (!_rt) return;
    const forceRedraw = opts?.force === true;
    const perf = _rt.getPerfDebug();
    const mode = _rt.getMode();
    const viewInitialDone = _rt.getViewModeInitialRenderDone();
    const skipAll = _rt.getSkipAllEdgeRedraws();
    const skipEdge = _rt.getSkipEdgeRedraw();
    const root = _rt.getRoot();
    const worldEl = _rt.getWorldEl();
    const dragIds = _rt.getActiveDragNodeIds();

    if (
        dragIds.size > 0
        && !forceRedraw
        && _rt.getDragUseLightSync?.()
        && syncCodexEdgesDuringNodeDrag()
    ) {
        return;
    }

    const edges = resolveVisibleRedrawEdges();
    const viewZoom = _rt.getViewZoom();
    const visualPrefs = _rt.getVisualPrefs();

    if (perf) {
        console.log('[Codex Redraw] redrawCodexEdges called - mode=' + mode);
    }

    if (mode === 'view') {
        if (viewInitialDone && !forceRedraw) {
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

    if (skipAll && !forceRedraw) {
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

    if (skipEdge && !forceRedraw && !(mode === 'view' && !viewInitialDone)) {
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
    let edgePolysFull = opts.prebuiltEdgePolysFull;
    if (!edgePolysFull) {
        edgePolysFull = [];
        emitRedrawLoadProgress(opts, 'plan', 0, edges.length);
        edges.forEach((edge, edgeIdx) => {
            const pts = _rt.buildPolylineForEdge(edge);
            if (pts && pts.length >= 2) edgePolysFull.push({ edge, pts });
            const done = edgeIdx + 1;
            if (done % CODEX_LOAD_REDRAW_PROGRESS_EVERY === 0 || done === edges.length) {
                emitRedrawLoadProgress(opts, 'plan', done, edges.length);
            }
        });
    }

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
    _rt.appendEdgeGlowFilter(defs, 'codex-edge-green-glow', 'greenBlur', cordFilt);
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

    const contentRoot = document.createElementNS(ns, 'g');
    contentRoot.classList.add('codex-edges-masked');
    contentRoot.setAttribute('mask', `url(#${CODEX_EDGES_NODE_ALPHA_MASK_ID})`);
    svg.appendChild(contentRoot);

    _rt.appendCodexJunctionElbowParallelograms(
        contentRoot,
        ns,
        useViewportCull ? visibleRect : null,
        edges
    );

    const degLabelsG = document.createElementNS(ns, 'g');
    degLabelsG.classList.add('codex-edge-degree-labels');
    degLabelsG.setAttribute('pointer-events', 'none');

    if (opts.deferCordPaint) {
        return {
            contentRoot,
            hitPickRoot,
            degLabelsG,
            ns,
            edgePolys,
            nodeList,
            mode,
            visualPrefs,
            dragIds,
            viewInitialDone,
            svg,
            startTime,
            perf,
        };
    }

    edgePolys.forEach(({ edge, pts }, polyIdx) => {
        appendEdgeCordPoly(contentRoot, ns, visualPrefs, edge, pts);
        const done = polyIdx + 1;
        if (done % CODEX_LOAD_REDRAW_PROGRESS_EVERY === 0 || done === edgePolys.length) {
            emitRedrawLoadProgress(opts, 'draw', done, edgePolys.length);
        }
    });

    edgePolys.forEach(({ edge, pts }, polyIdx) => {
        appendEdgeHitPoly(hitPickRoot, ns, mode, edge, pts);
        const done = polyIdx + 1;
        if (done % CODEX_LOAD_REDRAW_PROGRESS_EVERY === 0 || done === edgePolys.length) {
            emitRedrawLoadProgress(opts, 'hits', done, edgePolys.length);
        }
    });

    if (dragIds.size === 0 && mode !== 'view') {
        edgePolys.forEach(({ pts }) => {
            for (let seg = 0; seg < pts.length - 1; seg++) {
                const p0 = pts[seg];
                const p1 = pts[seg + 1];
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const len = Math.hypot(dx, dy);
                if (len < 48) continue;
                const actualDeg = _rt.cordSegmentDegreesLabel(p0, p1);
                if (actualDeg == null) continue;
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
                stackTitle.textContent = `Bearing ${actualDeg}° (0° = east → 90° = south, world y down), node-center to node-center. `
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
    }

    finalizeCodexEdgePaint({
        svg,
        hitPickRoot,
        degLabelsG,
        ns,
        edgePolys,
        nodeList,
        mode,
        dragIds,
        viewInitialDone,
        perf,
        startTime,
        contentRoot,
    }, opts);
}

/**
 * Initial Codex open: plan connection geometry in idle slices, then paint with live progress.
 * @param {{ force?: boolean, onProgress?: (info: { phase: string, done: number, total: number, fraction: number }) => void, onStatusLine?: (line: string) => void }} [opts]
 */
export async function redrawCodexEdgesDuringLoad(opts = {}) {
    if (!_rt) return;

    _loadSavedNodeMap = buildCodexSavedNodeMap();
    try {
        const edges = resolveVisibleRedrawEdges();
        const edgePolysFull = [];
        const progressOpts = {
            onProgress: opts.onProgress,
            onStatusLine: opts.onStatusLine,
        };
        const planYield = { units: 0 };

        emitRedrawLoadProgress(progressOpts, 'plan', 0, edges.length);
        reportLoadPhaseFraction(progressOpts, 'plan', 0, edges.length);

        for (let start = 0; start < edges.length; start += CODEX_LOAD_REDRAW_CHUNK) {
            const end = Math.min(start + CODEX_LOAD_REDRAW_CHUNK, edges.length);
            for (let i = start; i < end; i++) {
                const pts = buildPolylineForEdgeDuringLoad(edges[i]);
                if (pts && pts.length >= 2) edgePolysFull.push({ edge: edges[i], pts });
            }
            emitRedrawLoadProgress(progressOpts, 'plan', end, edges.length);
            reportLoadPhaseFraction(progressOpts, 'plan', end, edges.length);
            if (end < edges.length) {
                await yieldCodexLoadRedrawIfBudget(end - start, planYield);
            }
        }

        await yieldCodexLoadRedraw();

        const paintCtx = await prepareCodexEdgePaintContextDuringLoad({
            force: opts.force !== false,
            prebuiltEdgePolysFull: edgePolysFull,
            onProgress: opts.onProgress,
            onStatusLine: opts.onStatusLine,
        });
        if (!paintCtx || typeof paintCtx !== 'object') return;

        await completeCodexEdgePaintDuringLoad(paintCtx, opts);
    } finally {
        _loadSavedNodeMap = null;
    }
}
