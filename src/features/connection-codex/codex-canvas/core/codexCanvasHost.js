/** Codex canvas host — mount lifecycle and runtime registration. */
import { api } from './codexCanvasApi.js';
import { s, resetCanvasSession } from './canvasSession.js';
import { codexEdgePolyIntersectsRect, codexUnionBoundsFromEdgePolys } from '../../codex-controls-ui/camera/viewport/CodexViewportWorldBounds.js';
import { cordSegmentDegreesLabel, cordSegmentWithinOctilinearToleranceDegrees } from '../../codex-edge-cords/geometry/CodexCordOctilinearGeometry.js';
import {
    codexStopCordAnimRafOnly,
    ensureCodexCordAnimationLoop,
    syncCodexCordPacketState
} from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import {
    appendCordFilteredLineGroup,
    appendEdgeGlowFilter,
    appendSoftPacketGlowFilter
} from '../../codex-node-drawing/svg/CodexCordSvgElements.js';
import '../../codex-edge-cords/canvas/CodexEdgeStore.js';
import '../../codex-edge-cords/junction/CodexJunctionOps.js';
import '../../codex-controls-ui/camera/coords/CodexWorldCoords.js';
import '../../codex-controls-ui/camera/transform/CodexViewTransform.js';
import '../../codex-controls-ui/camera/gestures/CodexViewGestures.js';
import '../../codex-data/save/CodexLayoutSave.js';
import '../../codex-controls-ui/stage/CodexTargetedSelection.js';
import '../../codex-data/load/CodexLayoutLoad.js';
import '../../codex-data/import-export/CodexLayoutImportExport.js';
import '../../codex-nodes/filters/CodexNodeFilters.js';
import '../../codex-nodes/selection/CodexNodeSelection.js';
import '../../codex-nodes/placement/CodexNodePlacement.js';
import '../../codex-nodes/cull/CodexNodeDomCull.js';
import '../../codex-controls-ui/toolbar/CodexToolbar.js';
import '../../codex-nodes/picker/CodexNodePicker.js';
import '../mode/shell/CodexCanvasShell.js';
import '../../codex-controls-ui/input/pointer/CodexPointerInput.js';
import { registerCodexVirtualScrollRuntime, unregisterCodexVirtualScrollRuntime, clearCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { registerCodexBioPreviewRuntime, unregisterCodexBioPreviewRuntime, previewBioCodexArchiveLinkDiff } from '../../codex-bio-archive-sync/preview/CodexCanvasBioSyncPreview.js';
import { registerCodexBioArchiveEdgeSyncRuntime, syncCodexEdgesFromBioArchiveConnections, unregisterCodexBioArchiveEdgeSyncRuntime } from '../../codex-bio-archive-sync/reconcile/CodexBioArchiveEdgeSync.js';
import { registerCodexEdgeRedrawRuntime, unregisterCodexEdgeRedrawRuntime, redrawCodexEdges, scheduleRedrawCodexEdges, clearCodexEdgeRedrawSchedule } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { registerCodexCordPacketRuntime, unregisterCodexCordPacketRuntime, stopCordAnimAndClearCordPacketState } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { disconnectCodexImageObserver } from '../../codex-node-drawing/lazy-images/CodexImageLazyLoad.js';
import { terminateCodexJsonParseWorker } from '../../codex-data/load/CodexJsonParseWorker.js';
import { serializeCodexLayoutSnapshot } from '../../codex-data/persistence/CodexLayoutSerialization.js';
import { CODEX_ZOOM_INITIAL } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { DOUBLE_RIGHT_MS } from './canvasConstants.js';

export function initCodexCanvas(rootElement) {
    destroyCodexCanvas();
    s.root = rootElement;
    if (!s.root) return Promise.resolve();

    api.loadCodexDebugUiPref();
    api.loadCodexPacketAnimPref();
    api.loadCodexTargetedLinkPref();
    api.loadCodexModePref();
    api.loadCodexVisualPrefs();
    api.syncCodexDebugUiClass();
    api.syncCodexModeClass();

    s.codexLayoutDirty = false;
    s.codexToolbarEl = null;
    s.codexVisualPanelEl = null;
    s.codexInteractionMode = 'drag';
    s.networkLinkSourceId = null;
    s.codexSelectedNodeEls = new Set();
    s.codexPrimarySelectedNodeEl = null;
    s.cordPendingDeletePairKey = null;
    s.codexBulkNodeDeleteArmedAt = 0;
    s.codexActiveDragNodeIds = new Set();
    s.codexEdges = [];
    s.pointerPending = null;

    api.ensureCodexWorld();
    api.ensureHitLayer();
    api.ensureEdgesLayer();
    api.ensureCodexBorderOverlay();
    api.ensureCodexModeToggle();

    registerCodexVirtualScrollRuntime({
        getRoot: () => s.root,
        getWorldEl: () => s.codexWorldEl,
        getAllNodes: () => s.codexAllNodes,
        getRenderedNodeIds: () => s.codexRenderedNodeIds,
        getNodeElementsMap: () => s.codexNodeElements,
        getMode: () => s.codexMode,
        getViewPanZoom: () => ({ panX: s.codexViewPanX, panY: s.codexViewPanY, zoom: s.codexViewZoom }),
        getSkipEdgeRedrawFlags: () => ({ skipAll: s.codexSkipAllEdgeRedraws, skipEdge: s.codexSkipEdgeRedraw }),
        setSkipEdgeRedrawFlags: (all, edge) => {
            s.codexSkipAllEdgeRedraws = all;
            s.codexSkipEdgeRedraw = edge;
        },
        getPerfDebug: () => false,
        placeLoadedCodexNodeRecord: api.placeLoadedCodexNodeRecord,
        redrawCodexEdges,
        scheduleRedrawCodexEdges,
        syncCodexTargetedSelectionDom: api.syncCodexTargetedSelectionDom
    });

    registerCodexBioArchiveEdgeSyncRuntime({
        getRoot: () => s.root,
        getCodexAllNodes: () => s.codexAllNodes,
        getCodexEdges: () => s.codexEdges,
        setCodexEdges: (edges) => {
            s.codexEdges = edges;
        },
        getCodexUnsavedEdgeKeys: () => s.codexUnsavedEdgeKeys,
        getCordPendingDeletePairKey: () => s.cordPendingDeletePairKey,
        setCordPendingDeletePairKey: (k) => {
            s.cordPendingDeletePairKey = k;
        },
        addDirectedCodexEdge: api.addDirectedCodexEdge,
        markCodexLayoutDirty: api.markCodexLayoutDirty,
        redrawCodexEdges
    });

    registerCodexBioPreviewRuntime({
        getRoot: () => s.root,
        getSerializedSnapshot: () => {
            if (!s.root) return { nodes: [], edges: [] };
            return serializeCodexLayoutSnapshot(s.codexAllNodes, s.codexEdges);
        }
    });

    if (s.codexEdgesSvgEl) {
        s.codexEdgesSvgEl.addEventListener('pointerdown', api.codexSvgPointerDownCapture, true);
        s.codexEdgesSvgEl.addEventListener('pointerover', api.onCodexEdgeSvgPointerOver, true);
        s.codexEdgesSvgEl.addEventListener('pointerout', api.onCodexEdgeSvgPointerOut, true);
    }

    registerCodexCordPacketRuntime({
        getRoot: () => s.root,
        getVisualPrefs: () => s.codexVisualPrefs,
        getPacketStrokeRange: api.codexEffectivePacketStrokeRange,
        codexNodeIsJunctionWaypoint: api.codexNodeIsJunctionWaypoint,
        edgeCordShowsYellow: api.edgeCordShowsYellow,
        samplePacketTailNodeIds: api.samplePacketTailNodeIds,
        tryBuildPacketWorldPoints: api.tryBuildPacketWorldPoints,
        codexNodeElById: api.codexNodeElById,
        getNodeCenterWorldPx: api.getNodeCenterWorldPx
    });

    registerCodexEdgeRedrawRuntime({
        getRoot: () => s.root,
        getWorldEl: () => s.codexWorldEl,
        getMode: () => s.codexMode,
        getViewModeInitialRenderDone: () => s.codexViewModeInitialRenderDone,
        setViewModeInitialRenderDone: (v) => {
            s.codexViewModeInitialRenderDone = v;
        },
        getSkipAllEdgeRedraws: () => s.codexSkipAllEdgeRedraws,
        getSkipEdgeRedraw: () => s.codexSkipEdgeRedraw,
        getPerfDebug: () => false,
        getEdges: () => s.codexEdges,
        getActiveDragNodeIds: () => s.codexActiveDragNodeIds,
        getViewZoom: () => s.codexViewZoom,
        getVisualPrefs: () => s.codexVisualPrefs,
        getDoubleRightMs: () => DOUBLE_RIGHT_MS,
        getCordDoubleRightLastTs: () => s.cordDoubleRightLastTs,
        setCordPendingDeletePairKey: (k) => {
            s.cordPendingDeletePairKey = k;
        },
        findEdge: api.findEdge,
        removeCodexEdgeDirected: api.removeCodexEdgeDirected,
        clearPendingCodexDeleteState: api.clearPendingCodexDeleteState,
        buildPolylineForEdge: api.buildPolylineForEdge,
        getCodexVisibleWorldBoundsExpanded: api.getCodexVisibleWorldBoundsExpanded,
        codexEdgePolyIntersectsRect,
        codexUnionBoundsFromEdgePolys,
        appendCodexJunctionElbowParallelograms: api.appendCodexJunctionElbowParallelograms,
        appendEdgeGlowFilter,
        appendSoftPacketGlowFilter,
        appendCodexEdgeNodeMask: api.appendCodexEdgeNodeMask,
        appendCordFilteredLineGroup,
        syncCodexNodeDomCullFromView: api.syncCodexNodeDomCullFromView,
        syncCodexNodeCoordLabels: api.syncCodexNodeCoordLabels,
        syncCodexCordPacketState,
        codexStopCordAnimRafOnly,
        ensureCodexCordAnimationLoop,
        edgeCordAppearance: api.edgeCordAppearance,
        cordSegmentDegreesLabel,
        cordSegmentWithinOctilinearToleranceDegrees,
        getTargetedSelectionActive: () => s.codexTargetedSelectionActive,
        getTargetedSelectionVisibleIds: () => s.codexTargetedSelectionVisibleIds,
        getTargetedSelectionVisibleEdgeKeys: () => s.codexTargetedSelectionVisibleEdgeKeys
    });

    if (s.hitLayerEl) {
        s.hitLayerEl.addEventListener('pointerdown', api.onHitLayerBackgroundPanPointerDown, true);
    }

    s.onCodexContextMenuCapture = (e) => {
        if (!s.hitLayerEl) return;
        if (e.target.closest('.codex-node')) return;
        if (e.target.closest('.codex-picker')) return;
        if (e.target.closest('.codex-toolbar') || e.target.closest('.codex-visual-panel')) return;
        if (e.target.closest('.codex-stage-controls')) return;
        if (e.target.closest('.filter-autocomplete-list')) return;

        const fromLayer = e.target === s.hitLayerEl || s.hitLayerEl.contains(e.target);
        const fromRootBare = e.target === s.root;
        if (!fromLayer && !fromRootBare) return;

        e.preventDefault();
        api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

        // Prevent picker from opening in view mode
        if (s.codexMode === 'view') return;

        let px;
        let py;
        if (s.codexWorldEl) {
            const wpt = api.clientToWorldCodex(e.clientX, e.clientY);
            px = wpt.x;
            py = wpt.y;
        } else {
            const r = s.hitLayerEl.getBoundingClientRect();
            const layoutScale = api.getCodexBodyLayoutPerViewportPx();
            px = (e.clientX - r.left) / layoutScale;
            py = (e.clientY - r.top) / layoutScale;
        }

        api.openPickerAtRootPoint(px, py, e.clientX, e.clientY);
    };
    s.root.addEventListener('contextmenu', s.onCodexContextMenuCapture, true);

    api.attachCodexViewGestures();

    s.onCodexGlobalKeydown = (ev) => {
        if (!s.root) return;
        if (ev.code !== 'CapsLock' || ev.repeat) return;
        const t = ev.target;
        if (t instanceof Element) {
            if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (t.isContentEditable) return;
        }
        if (s.pickerEl) return;
        
        // Prevent mode toggle in view mode
        if (s.codexMode === 'view') return;
        
        try {
            ev.preventDefault();
        } catch (_) { /* ignore */ }
        if (s.codexInteractionMode === 'drag') {
            s.codexInteractionMode = 'network';
            s.networkLinkSourceId = null;
            api.selectCodexNode(null);
        } else {
            s.codexInteractionMode = 'drag';
            s.networkLinkSourceId = null;
        }
        api.updateCodexToolbar();
    };
    document.addEventListener('keydown', s.onCodexGlobalKeydown, true);

    s.onWindowResizeRedraw = () => {
        redrawCodexEdges();
    };
    window.addEventListener('resize', s.onWindowResizeRedraw);

    api.ensureCodexToolbar();
    return (async () => {
        await api.yieldCodexBrowserPaint();
        await api.loadCodexState();
    })();
}

export function destroyCodexCanvas() {
    disconnectCodexImageObserver();
    terminateCodexJsonParseWorker();
    unregisterCodexBioPreviewRuntime();
    unregisterCodexBioArchiveEdgeSyncRuntime();
    unregisterCodexVirtualScrollRuntime();
    unregisterCodexCordPacketRuntime();
    unregisterCodexEdgeRedrawRuntime();
    s.codexNodeElements.clear(); // Clear the node elements Map
    if (s.onCodexGlobalKeydown) {
        document.removeEventListener('keydown', s.onCodexGlobalKeydown, true);
        s.onCodexGlobalKeydown = null;
    }
    api.detachCodexViewGestures();
    api.cancelPointerPending();
    api.cancelBackgroundPanPointerPending();
    s.codexActiveDragNodeIds.clear();
    s.cordDoubleRightLastTs.clear();
    s.codexNodeDeleteLastRightTs.clear();
    s.cordPendingDeletePairKey = null;
    s.codexBulkNodeDeleteArmedAt = 0;
    if (s.codexEdgesSvgEl) {
        s.codexEdgesSvgEl.removeEventListener('pointerdown', api.codexSvgPointerDownCapture, true);
        s.codexEdgesSvgEl.removeEventListener('pointerover', api.onCodexEdgeSvgPointerOver, true);
        s.codexEdgesSvgEl.removeEventListener('pointerout', api.onCodexEdgeSvgPointerOut, true);
    }
    s.codexEdgeHoverChainKeySet = null;
    s.codexEdgesSvgEl = null;
    api.removePicker();
    if (s.hitLayerEl) {
        s.hitLayerEl.removeEventListener('pointerdown', api.onHitLayerBackgroundPanPointerDown, true);
    }
    if (s.root && s.onCodexContextMenuCapture) {
        s.root.removeEventListener('contextmenu', s.onCodexContextMenuCapture, true);
    }
    if (s.onWindowResizeRedraw) {
        window.removeEventListener('resize', s.onWindowResizeRedraw);
        s.onWindowResizeRedraw = null;
    }
    api.clearCodexEventThumbnailFilterHover();
    s.root = null;
    s.hitLayerEl = null;
    s.codexWorldEl = null;
    s.codexViewPanX = 0;
    s.codexViewPanY = 0;
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    s.codexUnsavedEdgeKeys.clear();
    s.onCodexContextMenuCapture = null;
    s.codexToolbarEl = null;
    s.codexVisualPanelEl = null;
    s.codexLayoutDirty = false;
    s.codexSelectedNodeEls.clear();
    s.codexPrimarySelectedNodeEl = null;
    s.networkLinkSourceId = null;
    s.codexEdges = [];
    s.nodeZ = 20;
    resetCanvasSession();
}

export { previewBioCodexArchiveLinkDiff };
export { saveCodexLayout } from '../../codex-data/save/CodexLayoutSave.js';
export { syncCodexEdgesFromBioArchiveConnections };
