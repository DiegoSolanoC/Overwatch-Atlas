/** Shared imports for Codex canvas slices. */
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY, CODEX_WORLD_H, CODEX_WORLD_W } from '../codex-data/persistence/CodexLayoutConstants.js';
import {
    codexEdgePolyIntersectsRect,
    codexPointInWorldRect,
    codexUnionBoundsFromEdgePolys,
    computeCodexVisibleWorldBoundsExpanded
} from '../codex-camera/viewport/CodexViewportWorldBounds.js';
import {
    downloadTextFileAsJson,
    serializeCodexLayoutSnapshot,
    stringifyCodexLayoutJson
} from '../codex-data/persistence/CodexLayoutSerialization.js';
import {
    computeCodexPanForNodeBounds,
    computeCodexPanForWorldCenter
} from '../codex-camera/transform/CodexViewFraming.js';
import {
    cordAngleDistToNearestOctilinearDegFromRad,
    cordSegmentDegreesLabel,
    cordSegmentWithinOctilinearToleranceDegrees
} from '../codex-edges/geometry/CodexCordOctilinearGeometry.js';
import {
    codexUnorderedPairKey,
    edgeDirectedKey,
    generateNodeId,
    heroNamesLooselyEqualCodex
} from '../codex-edges/topology/CodexGraphPrimitives.js';
import {
    codexBioEntityPairHasJunctionAlternatePath as topologyJunctionAlternatePath,
    codexEdgeIsBioEntityChord,
    hasCodexConnectionBetween as topologyHasUndirectedLink
} from '../codex-edges/topology/CodexGraphTopology.js';
import { findCodexNodeIdForBioEntity } from '../codex-edges/topology/CodexBioEntityMatching.js';
import { parseMigrateAndDedupeCodexSource } from '../codex-data/migration/CodexPayloadMigration.js';
import { fetchCanonicalCodexJson } from '../codex-data/load/CodexJsonRepository.js';
import {
    applyLocationFlagBioHighlight,
    dispatchBioArchivesRefreshed,
    exposeApplyCodexFilterState,
    flashUiButton,
    getCodexLoadingOverlayLineSetter,
    getEventManager,
    getEventsFromEventManager,
    getFactionMatchHelpers,
    getGlobeController,
    getStandaloneActiveFiltersSet,
    getStandaloneEventSlide,
    getStoryFilterPlacesSync,
    getEventTimelineDataService,
    isCodexPersistToRepoAvailable,
    playSoundEffect,
    resolveCodexRepoApiUrl,
    updateAppStatus,
    userConfirms
} from '../codex-integration/bridge/CodexAppBridge.js';
import { parseCodexJsonInWorker, terminateCodexJsonParseWorker } from '../codex-data/load/CodexJsonParseWorker.js';
import { escapeHtml, hexToRgba } from '../codex-render/svg/CodexPresentationUtils.js';
import {
    appendCordFilteredLineGroup,
    appendEdgeGlowFilter,
    appendSoftPacketGlowFilter
} from '../codex-render/svg/CodexCordSvgElements.js';
import {
    appendCodexEdgeNodeMask as appendCodexEdgeNodeMaskCore,
    nodeFrameIntersectsRect,
    parseTranslatePxFromTransform
} from '../codex-render/svg/CodexNodeFrameSvg.js';
import { observeCodexImage, disconnectCodexImageObserver } from '../codex-render/lazy-images/CodexImageLazyLoad.js';
import { codexFrameVariantForId, codexHexRotationDegreesForId } from '../codex-nodes/placement/CodexNodeVisualHash.js';
import {
    CODEX_ALLOWED_COUNTRY_KEYS,
    CODEX_DEFAULT_SCALE_COUNTRY,
    CODEX_DEFAULT_SCALE_FACTION,
    CODEX_DEFAULT_SCALE_HERO,
    CODEX_DEFAULT_SCALE_JUNCTION,
    CODEX_FRAME_PATH,
    CODEX_IMG_BASE_PX,
    CODEX_JUNCTION_BASE_PX,
    CODEX_NODE_ALPHA_PATH,
    CODEX_SCALE_MAX,
    CODEX_SCALE_MIN,
    CODEX_USE_SIMPLIFIED_DOM,
    codexCountryFlagSrc,
    normalizeCodexCountryKey,
    resolveCodexNodeScale
} from '../codex-nodes/placement/CodexNodePortraitMetrics.js';
import {
    CODEX_EDGE_CULL_MARGIN_PX,
    CODEX_EDGE_DEGREE_FONT_PX,
    CODEX_EDGE_HIT_PICK_STROKE_PX,
    CODEX_EDGE_STROKE_PX,
    CODEX_EDGES_NODE_ALPHA_MASK_ID,
    CODEX_MASK_PAD_WORLD_FROM_EDGES,
    CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX,
    CODEX_NODE_DOM_CULL_MIN_NODES,
    CODEX_OCT_RAD,
    CODEX_OCT_RELEASE_SNAP_EPS,
    CODEX_OCT_SOFT_SNAP_TOL_DEG,
    CODEX_VIEWPORT_CULL_MIN_EDGES,
    CODEX_VIEWPORT_CULL_MIN_NODES,
    CODEX_VISUAL_DEFAULTS,
    CODEX_VISUAL_PREFS_KEY,
    CODEX_ZOOM_FACTOR,
    CODEX_ZOOM_INITIAL,
    CODEX_ZOOM_MAX,
    CODEX_ZOOM_MIN,
    DRAG_THRESHOLD_PX,
    normalizeCodexVisualPrefs
} from '../codex-camera/viewport/CodexCanvasTuning.js';
import {
    clearCodexEdgeRedrawSchedule,
    redrawCodexEdges,
    registerCodexEdgeRedrawRuntime,
    scheduleRedrawCodexEdges,
    unregisterCodexEdgeRedrawRuntime
} from '../codex-render/redraw/CodexEdgeRedraw.js';
import {
    codexStopCordAnimRafOnly,
    deleteCodexCordPacketStateForKey,
    ensureCodexCordAnimationLoop,
    registerCodexCordPacketRuntime,
    stopCordAnimAndClearCordPacketState,
    syncCodexCordPacketState,
    unregisterCodexCordPacketRuntime
} from '../codex-render/packets/CodexCordPacketAnimation.js';
import { appendCodexJunctionElbowParallelograms as appendCodexJunctionElbowParallelogramsCore } from '../codex-render/junction-decor/CodexJunctionElbowParallelograms.js';
import {
    previewBioCodexArchiveLinkDiff,
    registerCodexBioPreviewRuntime,
    unregisterCodexBioPreviewRuntime
} from '../codex-bio-sync/preview/CodexCanvasBioSyncPreview.js';
import {
    clearCodexVirtualScroll,
    registerCodexVirtualScrollRuntime,
    scheduleUpdateCodexVirtualScroll,
    unregisterCodexVirtualScrollRuntime,
    updateCodexVirtualScroll
} from '../codex-render/virtual-scroll/CodexVirtualScroll.js';

