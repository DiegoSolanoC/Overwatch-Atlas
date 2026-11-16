/**
 * Virtual scrolling for Codex nodes (view + dev).
 * Off-screen nodes stay in `codexAllNodes`; edges use layout coords when DOM is missing.
 *
 * Cords can paint from layout instantly; node shells need DOM. To close that gap we:
 *  - mount shells during pan (mount-only, no cull) so hexes appear with the view
 *  - batch appends via DocumentFragment
 *  - rely on CSS frame backgrounds for same-tick shell paint
 */

import {
    computeCodexVirtualViewportBounds,
    isCodexNodeInVirtualViewport
} from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { hydrateCodexPortraitImagesInViewport } from '../lazy-images/CodexImageLazyLoad.js';

/** @type {CodexVirtualScrollRuntime|null} */
let _rt = null;

/** @type {number} */
let codexVirtualScrollRaf = 0;

/** @type {{ mountOnly?: boolean }|null} */
let pendingScrollOpts = null;

/**
 * Soft cap per update so a huge zoom-out still paints some shells this frame.
 * Remaining mounts continue on the next rAF.
 */
const CODEX_VIRTUAL_MOUNT_CAP = 36;

/**
 * @typedef {object} CodexVirtualScrollRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => HTMLElement|null} getWorldEl
 * @property {() => object[]} getAllNodes
 * @property {() => Set<string>} getRenderedNodeIds
 * @property {() => Map<string, HTMLElement>} getNodeElementsMap
 * @property {() => 'dev'|'view'} getMode
 * @property {() => boolean} [getViewBoardMountComplete]
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
    pendingScrollOpts = null;
    if (_rt) {
        clearCodexVirtualScroll();
    }
    _rt = null;
}

/**
 * @param {{ mountOnly?: boolean }} [opts]
 *   mountOnly — add newly visible shells without culling (used mid-pan).
 */
export function scheduleUpdateCodexVirtualScroll(opts = {}) {
    if (!_rt) return;
    if (opts.mountOnly) {
        // Preserve a pending full sync if one was already queued.
        if (!pendingScrollOpts || pendingScrollOpts.mountOnly !== false) {
            pendingScrollOpts = { mountOnly: true };
        }
    } else {
        pendingScrollOpts = { mountOnly: false };
    }
    if (codexVirtualScrollRaf) return;
    codexVirtualScrollRaf = requestAnimationFrame(() => {
        codexVirtualScrollRaf = 0;
        const runOpts = pendingScrollOpts || {};
        pendingScrollOpts = null;
        updateCodexVirtualScroll(runOpts);
    });
}

/**
 * @param {{ mountOnly?: boolean }} [opts]
 */
export function updateCodexVirtualScroll(opts = {}) {
    if (!_rt) return;
    const root = _rt.getRoot();
    const world = _rt.getWorldEl?.() || root;
    const allNodes = _rt.getAllNodes();
    if (!root || !allNodes.length) return;

    const mountOnly = opts.mountOnly === true;
    const CODEX_PERFORMANCE_DEBUG = _rt.getPerfDebug();
    const startTime = performance.now();

    const renderedIds = _rt.getRenderedNodeIds();
    const nodeElements = _rt.getNodeElementsMap();
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

    if (!mountOnly) {
        const nodesToRemove = [];
        for (const id of renderedIds) {
            if (!visibleNodeIds.has(id)) nodesToRemove.push(id);
        }
        for (const id of nodesToRemove) {
            const el = nodeElements.get(id);
            if (el) {
                el.remove();
                renderedIds.delete(id);
                nodeElements.delete(id);
            }
        }
    }

    const batch = nodesToRender.slice(0, CODEX_VIRTUAL_MOUNT_CAP);
    const leftover = nodesToRender.length - batch.length;

    if (batch.length && world) {
        // placeCodexNode appends to world by default; temporary mountParent isn't on placeLoaded.
        // Place sequentially into world — still cheaper than waiting until pan end for all.
        for (const node of batch) {
            _rt.placeLoadedCodexNodeRecord(node);
            renderedIds.add(node.id);
        }
        hydrateCodexPortraitImagesInViewport(root);
    }

    if (leftover > 0) {
        // Continue mounting remaining shells next frame.
        scheduleUpdateCodexVirtualScroll(mountOnly ? { mountOnly: true } : {});
    }

    if (!mountOnly) {
        const { skipAll, skipEdge } = _rt.getSkipEdgeRedrawFlags();
        if (!skipAll && !skipEdge) {
            _rt.scheduleRedrawCodexEdges();
        }
        if (typeof _rt.syncCodexTargetedSelectionDom === 'function') {
            _rt.syncCodexTargetedSelectionDom();
        }
    }

    if (CODEX_PERFORMANCE_DEBUG) {
        console.log(
            `[Codex Perf] virtual scroll mount=${batch.length} left=${leftover} mountOnly=${mountOnly} in ${(performance.now() - startTime).toFixed(1)}ms`
        );
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
