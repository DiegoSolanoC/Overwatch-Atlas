/**
 * Mutable mount-scoped state for the Codex canvas (one active session per init/destroy).
 */
import { CODEX_VISUAL_DEFAULTS, CODEX_ZOOM_INITIAL } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';

export const s = {
    root: /** @type {HTMLElement|null} */ (null),
    hitLayerEl: /** @type {HTMLElement|null} */ (null),
    onCodexContextMenuCapture: /** @type {((e: MouseEvent) => void)|null} */ (null),
    pickerEl: /** @type {HTMLElement|null} */ (null),
    listEl: /** @type {HTMLElement|null} */ (null),
    onDocPointerDown: /** @type {((e: PointerEvent) => void)|null} */ (null),
    onDocKeydown: /** @type {((e: KeyboardEvent) => void)|null} */ (null),
    nodeZ: 20,
    pendingNodePos: /** @type {{ x: number, y: number }|null} */ (null),
    codexAllNodes: /** @type {object[]} */ ([]),
    codexRenderedNodeIds: /** @type {Set<string>} */ (new Set()),
    codexNodeElements: /** @type {Map<string, HTMLElement>} */ (new Map()),
    codexSkipEdgeRedraw: false,
    codexSkipAllEdgeRedraws: false,
    codexVisualPrefs: /** @type {object} */ ({ ...CODEX_VISUAL_DEFAULTS }),
    codexInteractionMode: /** @type {'drag'|'network'} */ ('drag'),
    codexMode: /** @type {'dev'|'view'} */ ('view'),
    networkLinkSourceId: /** @type {string|null} */ (null),
    codexEdges: /** @type {{ fromId: string, toId: string }[]} */ ([]),
    codexConnections: /** @type {object[]} */ ([]),
    codexEdgesSvgEl: /** @type {SVGSVGElement|null} */ (null),
    codexEdgeHoverChainKeySet: /** @type {Set<string>|null} */ (null),
    cordDoubleRightLastTs: /** @type {Map<string, number>} */ (new Map()),
    cordPendingDeletePairKey: /** @type {string|null} */ (null),
    codexBulkNodeDeleteArmedAt: 0,
    codexNodeDeleteLastRightTs: /** @type {Map<string, number>} */ (new Map()),
    codexSelectedNodeEls: /** @type {Set<HTMLElement>} */ (new Set()),
    codexPrimarySelectedNodeEl: /** @type {HTMLElement|null} */ (null),
    pointerPending: /** @type {object|null} */ (null),
    codexLayoutDirty: false,
    codexActiveDragNodeIds: /** @type {Set<string>} */ (new Set()),
    codexEdgeDragUseLightSync: false,
    codexUnsavedEdgeKeys: /** @type {Set<string>} */ (new Set()),
    codexWorldEl: /** @type {HTMLElement|null} */ (null),
    codexViewPanX: 0,
    codexViewPanY: 0,
    codexViewZoom: CODEX_ZOOM_INITIAL,
    codexPinchState: /** @type {{ d0: number, z0: number }|null} */ (null),
    onCodexWheelHandler: /** @type {((e: WheelEvent) => void)|null} */ (null),
    onCodexTouchStartHandler: /** @type {((e: TouchEvent) => void)|null} */ (null),
    onCodexTouchMoveHandler: /** @type {((e: TouchEvent) => void)|null} */ (null),
    onCodexTouchEndHandler: /** @type {((e: TouchEvent) => void)|null} */ (null),
    backgroundPanPointerPending: /** @type {object|null} */ (null),
    backgroundPanPointerId: /** @type {number|null} */ (null),
    codexToolbarEl: /** @type {HTMLElement|null} */ (null),
    codexVisualPanelEl: /** @type {HTMLElement|null} */ (null),
    codexDebugUiVisible: false,
    codexPacketAnimEnabled: true,
    /** @type {{ countMin: number, countMax: number, maxEdges: number }} */
    codexPacketEdgePlan: { countMin: 3, countMax: 6, maxEdges: 0 },
    codexStageControlsEl: /** @type {HTMLElement|null} */ (null),
    codexTargetedSelectionActive: false,
    codexTargetedSelectionSeedIds: /** @type {Set<string>} */ (new Set()),
    codexTargetedSelectionVisibleIds: /** @type {Set<string>} */ (new Set()),
    codexTargetedSelectionVisibleEdgeKeys: /** @type {Set<string>} */ (new Set()),
    codexTargetedSelectionLinkSeeds: false,
    onWindowResizeRedraw: /** @type {(() => void)|null} */ (null),
    onCodexGlobalKeydown: /** @type {((e: KeyboardEvent) => void)|null} */ (null),
    codexViewModeInitialRenderDone: false,
    codexZoomDebounceTimer: /** @type {ReturnType<typeof setTimeout>|null} */ (null),
    /** Portrait + junction ids reachable from active filters (null when filters off). */
    codexFilterReachableNodeIds: /** @type {Set<string>|null} */ (null),
    /** Portraits on active filter cords but not in the filter set (null when filters off). */
    codexFilterConnectionEndpointNodeIds: /** @type {Set<string>|null} */ (null),
    /** When Link Filters is on with 2+ chips — only these cord pairs stay active. */
    codexFilterLinkedEdgePairKeys: /** @type {Set<string>|null} */ (null),
    /** Prune-aware active cord pairs while filters are on (null when filters off). */
    codexFilterActiveEdgePairKeys: /** @type {Set<string>|null} */ (null),
    /** Portrait ids on ranged links outside the current dock page span. */
    codexTimelineRangeInactiveNodeIds: /** @type {Set<string>|null} */ (null),
    /** Portrait ids tinted by entry lifetime vs dock page (`before` / `after`). */
    codexEntryLifetimeNodeStatuses: /** @type {Map<string, 'before'|'after'>|null} */ (null),
};

export function resetCanvasSession() {
    s.root = null;
    s.hitLayerEl = null;
    s.onCodexContextMenuCapture = null;
    s.pickerEl = null;
    s.listEl = null;
    s.onDocPointerDown = null;
    s.onDocKeydown = null;
    s.nodeZ = 20;
    s.pendingNodePos = null;
    s.codexAllNodes = [];
    s.codexRenderedNodeIds = new Set();
    s.codexNodeElements = new Map();
    s.codexSkipEdgeRedraw = false;
    s.codexSkipAllEdgeRedraws = false;
    s.codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };
    s.codexInteractionMode = 'drag';
    s.codexMode = 'view';
    s.networkLinkSourceId = null;
    s.codexEdges = [];
    s.codexConnections = [];
    s.codexEdgesSvgEl = null;
    s.codexEdgeHoverChainKeySet = null;
    s.cordDoubleRightLastTs.clear();
    s.cordPendingDeletePairKey = null;
    s.codexBulkNodeDeleteArmedAt = 0;
    s.codexNodeDeleteLastRightTs.clear();
    s.codexSelectedNodeEls = new Set();
    s.codexPrimarySelectedNodeEl = null;
    s.pointerPending = null;
    s.codexLayoutDirty = false;
    s.codexActiveDragNodeIds = new Set();
    s.codexEdgeDragUseLightSync = false;
    s.codexUnsavedEdgeKeys.clear();
    s.codexWorldEl = null;
    s.codexViewPanX = 0;
    s.codexViewPanY = 0;
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    s.codexPinchState = null;
    s.onCodexWheelHandler = null;
    s.onCodexTouchStartHandler = null;
    s.onCodexTouchMoveHandler = null;
    s.onCodexTouchEndHandler = null;
    s.backgroundPanPointerPending = null;
    s.backgroundPanPointerId = null;
    s.codexToolbarEl = null;
    s.codexVisualPanelEl = null;
    s.codexStageControlsEl = null;
    s.codexTargetedSelectionActive = false;
    s.codexTargetedSelectionSeedIds = new Set();
    s.codexTargetedSelectionVisibleIds = new Set();
    s.codexTargetedSelectionVisibleEdgeKeys = new Set();
    s.codexTargetedSelectionLinkSeeds = false;
    s.codexDebugUiVisible = false;
    s.codexPacketAnimEnabled = true;
    s.codexPacketEdgePlan = { countMin: 3, countMax: 6, maxEdges: 0 };
    s.onWindowResizeRedraw = null;
    s.onCodexGlobalKeydown = null;
    s.codexViewModeInitialRenderDone = false;
    s.codexZoomDebounceTimer = null;
    s.codexFilterReachableNodeIds = null;
    s.codexFilterConnectionEndpointNodeIds = null;
    s.codexFilterLinkedEdgePairKeys = null;
    s.codexFilterActiveEdgePairKeys = null;
    s.codexTimelineRangeInactiveNodeIds = null;
    s.codexEntryLifetimeNodeStatuses = null;
}
