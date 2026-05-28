/**
 * Virtual scrolling for Codex nodes in dev mode (view mode renders all nodes for correct edges).
 * Canvas registers getters/setters once per mount.
 */

import {
    computeCodexVirtualViewportBounds,
    isCodexNodeInVirtualViewport
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

/** @type {CodexVirtualScrollRuntime|null} */
let _rt = null;

/** @type {number} */
let codexVirtualScrollRaf = 0;

/**
 * @typedef {object} CodexVirtualScrollRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => HTMLElement|null} getWorldEl
 * @property {() => object[]} getAllNodes
 * @property {() => Set<string>} getRenderedNodeIds
 * @property {() => Map<string, HTMLElement>} getNodeElementsMap
 * @property {() => 'dev'|'view'} getMode
 * @property {() => { panX: number, panY: number, zoom: number }} getViewPanZoom
 * @property {() => { skipAll: boolean, skipEdge: boolean }} getSkipEdgeRedrawFlags
 * @property {(skipAll: boolean, skipEdge: boolean) => void} setSkipEdgeRedrawFlags
 * @property {() => boolean} getPerfDebug
 * @property {(node: object) => void} placeLoadedCodexNodeRecord
 * @property {() => void} redrawCodexEdges
 * @property {() => void} scheduleRedrawCodexEdges
 * @property {() => void} [syncCodexTargetedSelectionDom]
 */

export function registerCodexVirtualScrollRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexVirtualScrollRuntime() {
    if (codexVirtualScrollRaf) {
        cancelAnimationFrame(codexVirtualScrollRaf);
        codexVirtualScrollRaf = 0;
    }
    if (_rt) {
        clearCodexVirtualScroll();
    }
    _rt = null;
}

export function scheduleUpdateCodexVirtualScroll() {
    if (codexVirtualScrollRaf || !_rt) return;
    codexVirtualScrollRaf = requestAnimationFrame(() => {
        codexVirtualScrollRaf = 0;
        updateCodexVirtualScroll();
    });
}

/** Virtual Scrolling: Render only visible nodes, remove off-screen ones */
export function updateCodexVirtualScroll() {
    if (!_rt) return;
    const root = _rt.getRoot();
    const allNodes = _rt.getAllNodes();
    if (!root || !allNodes.length) return;

    const CODEX_PERFORMANCE_DEBUG = _rt.getPerfDebug();

    const startTime = performance.now();
    if (CODEX_PERFORMANCE_DEBUG) {
        console.log('[Codex Perf] updateCodexVirtualScroll started');
    }

    const renderedIds = _rt.getRenderedNodeIds();
    const nodeElements = _rt.getNodeElementsMap();

    if (_rt.getMode() === 'view') {
        const nodesToRender = [];
        for (const node of allNodes) {
            if (!renderedIds.has(node.id)) {
                nodesToRender.push(node);
            }
        }

        if (CODEX_PERFORMANCE_DEBUG) {
            console.log(`[Codex Perf] View Mode: Rendering all ${nodesToRender.length} nodes`);
        }

        for (const node of nodesToRender) {
            _rt.placeLoadedCodexNodeRecord(node);
            renderedIds.add(node.id);
        }

        _rt.setSkipEdgeRedrawFlags(false, false);

        if (nodesToRender.length > 0) {
            if (CODEX_PERFORMANCE_DEBUG) {
                console.log('[Codex Perf] View Mode: Triggering edge redraw after rendering nodes');
            }
            _rt.redrawCodexEdges();
        }

        const elapsed = performance.now() - startTime;
        if (CODEX_PERFORMANCE_DEBUG) {
            console.log(`[Codex Perf] updateCodexVirtualScroll completed in ${elapsed.toFixed(2)}ms`);
        }
        return;
    }

    const { panX, panY, zoom } = _rt.getViewPanZoom();
    const viewport = computeCodexVirtualViewportBounds(
        { clientWidth: root.clientWidth, clientHeight: root.clientHeight },
        { panX, panY, zoom }
    );

    const visibleNodeIds = new Set();
    const nodesToRender = [];

    for (const node of allNodes) {
        if (isCodexNodeInVirtualViewport(node, viewport)) {
            visibleNodeIds.add(node.id);
            if (!renderedIds.has(node.id)) {
                nodesToRender.push(node);
            }
        }
    }

    const nodesToRemove = [];
    for (const id of renderedIds) {
        if (!visibleNodeIds.has(id)) {
            nodesToRemove.push(id);
        }
    }

    if (CODEX_PERFORMANCE_DEBUG) {
        console.log(
            `[Codex Perf] Nodes to add: ${nodesToRender.length}, Nodes to remove: ${nodesToRemove.length}, Total visible: ${visibleNodeIds.size}`
        );
    }

    for (const id of nodesToRemove) {
        const el = nodeElements.get(id);
        if (el) {
            el.remove();
            renderedIds.delete(id);
            nodeElements.delete(id);
        }
    }

    for (const node of nodesToRender) {
        _rt.placeLoadedCodexNodeRecord(node);
        renderedIds.add(node.id);
    }

    const { skipAll, skipEdge } = _rt.getSkipEdgeRedrawFlags();
    if (!skipAll && !skipEdge) {
        _rt.scheduleRedrawCodexEdges();
    } else if (CODEX_PERFORMANCE_DEBUG) {
        if (skipAll) {
            console.log('[Codex Perf] Skipping edge redraw (all skip mode)');
        } else if (skipEdge) {
            console.log('[Codex Perf] Skipping edge redraw during batch load');
        }
    }

    if (typeof _rt.syncCodexTargetedSelectionDom === 'function') {
        _rt.syncCodexTargetedSelectionDom();
    }

    const elapsed = performance.now() - startTime;
    if (CODEX_PERFORMANCE_DEBUG) {
        console.log(`[Codex Perf] updateCodexVirtualScroll completed in ${elapsed.toFixed(2)}ms`);
    }
}

/** Clear all rendered nodes from DOM (keeps model in `s.codexAllNodes` on the canvas). */
export function clearCodexVirtualScroll() {
    if (!_rt) return;
    _rt.getRenderedNodeIds().clear();
    _rt.getNodeElementsMap().clear();
    const world = _rt.getWorldEl();
    if (world) {
        world.querySelectorAll('.codex-node').forEach((el) => el.remove());
    }
}
