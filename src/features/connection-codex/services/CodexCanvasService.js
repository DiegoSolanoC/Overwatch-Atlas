/**
 * Codex canvas: hero/faction/country portrait nodes, junction (waypoint) circle nodes, directed links; persistence.
 * Cords use free positioning while dragging; on release, segments to fixed neighbors snap to 45° if within a small angular window.
 */

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
export { previewBioCodexArchiveLinkDiff };
import {
    clearCodexVirtualScroll,
    registerCodexVirtualScrollRuntime,
    scheduleUpdateCodexVirtualScroll,
    unregisterCodexVirtualScrollRuntime,
    updateCodexVirtualScroll
} from '../codex-render/virtual-scroll/CodexVirtualScroll.js';

let root = null;
let hitLayerEl = null;
let onCodexContextMenuCapture = null;
let pickerEl = null;
let listEl = null;
let onDocPointerDown = null;
let onDocKeydown = null;
let nodeZ = 20;
/** @type {{ x: number, y: number }|null} */
let pendingNodePos = null;

/** Virtual scrolling: all nodes stored here, only visible ones rendered to DOM */
/** @type {Array<{id: string, kind: string, x: number, y: number, [key: string]: any}>} */
let codexAllNodes = [];
/** @type {Set<string>} */
let codexRenderedNodeIds = new Set();
/** Map node ID to DOM element for O(1) lookups (performance optimization) */
/** @type {Map<string, HTMLElement>} */
let codexNodeElements = new Map();
/** Enable performance + verbose redraw / selection logs for Codex (off by default — logging adds jank). */
const CODEX_PERFORMANCE_DEBUG = false;
/** Flag to skip edge redraws during initial batch loading */
let codexSkipEdgeRedraw = false;
/** Flag to skip edge redraws during node placement (more aggressive) */
let codexSkipAllEdgeRedraws = false;

const DOUBLE_RIGHT_MS = 900;
const capOpts = { capture: true };
const CODEX_JUNCTION_PREVIEW_DATA_URI =
    'data:image/svg+xml,'
    + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
        + '<circle cx="24" cy="24" r="14" fill="rgba(196,181,253,0.4)" stroke="rgba(233,213,255,0.95)" stroke-width="3"/>'
        + '</svg>'
    );
const MAX_SUGGEST = 8;
/**
 * Offline / fallback cache only. On load we always try the canonical JSON first (`GET /api/codex` on dev, `src/data/codex-labels.json` on static hosts); this key is used when that fetch fails.
 */
/** @deprecated read for migration only */
const CODEX_DEBUG_UI_PREF_KEY_LEGACY = 'timelineCodexShowJunctionControls';
const CODEX_MODE_PREF_KEY = 'timelineCodexMode';

/** @type {ReturnType<typeof normalizeCodexVisualPrefs>} */
let codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };

/** @type {'drag'|'network'} */
let codexInteractionMode = 'drag';
/** @type {'dev'|'view'} */
let codexMode = 'view';
/** First node id picked in network mode (waiting for second tap to draw a link). */
let networkLinkSourceId = null;
/** @type {{ fromId: string, toId: string }[]} */
let codexEdges = [];
/** @type {SVGSVGElement|null} */
let codexEdgesSvgEl = null;
/** Directed edge keys (`edgeDirectedKey`) for the cord chain currently under pointer hover (view mode). */
let codexEdgeHoverChainKeySet = null;
/** Unordered node-pair keys for double–right-click delete on links. */
const cordDoubleRightLastTs = new Map();
/** Cord armed for delete — second right-click removes the link. */
let cordPendingDeletePairKey = null;
/** Multi-select node delete: first right-click arms; second within window removes all selected nodes. */
let codexBulkNodeDeleteArmedAt = 0;
/** nodeId → last right-click time (ms) for double–right delete; Map survives virtual-scroll DOM remounts. */
const codexNodeDeleteLastRightTs = new Map();
/** @type {Set<HTMLElement>} */
let codexSelectedNodeEls = new Set();
/** Last node picked (non–shift-click multi-select); used for toolbar when one node is primary. */
let codexPrimarySelectedNodeEl = null;
/** Pending pointer for drag-threshold (drag mode). */
let pointerPending = null;

let codexLayoutDirty = false;
/** Node ids mid-drag (single or group) — incident cords render yellow. */
let codexActiveDragNodeIds = new Set();
/** Directed edges (`fromId\x1etoId`) that stay yellow until Save Codex. */
const codexUnsavedEdgeKeys = new Set();
/** Pannable/zoomable layer containing hit target, SVG, nodes (not the toolbar). */
let codexWorldEl = null;

let codexViewPanX = 0;
let codexViewPanY = 0;
let codexViewZoom = CODEX_ZOOM_INITIAL;

/** @type {{ d0: number, z0: number }|null} */
let codexPinchState = null;
/** @type {((e: WheelEvent) => void)|null} */
let onCodexWheelHandler = null;
/** @type {((e: TouchEvent) => void)|null} */
let onCodexTouchStartHandler = null;
let onCodexTouchMoveHandler = null;
let onCodexTouchEndHandler = null;
/** @type {object|null} */
let backgroundPanPointerPending = null;
/** @type {number|null} Active background pan pointer ID (for performance checks). */
let backgroundPanPointerId = null;
/** @type {HTMLElement|null} */
let codexToolbarEl = null;
/** Right-side cord/packet look panel (child of {@link root}). */
let codexVisualPanelEl = null;
/** When false, waypoint dots, Break picker, cord angle labels, and node coordinate labels are hidden. */
let codexDebugUiVisible = true;

/** @type {(() => void)|null} */
let onWindowResizeRedraw = null;
/** @type {((e: KeyboardEvent) => void)|null} */
let onCodexGlobalKeydown = null;

/** True when dev server `/api/codex` persistence is expected (delegates to app bridge). */
function isCodexFileApiAvailable() {
    return isCodexPersistToRepoAvailable();
}

function findEdge(fromId, toId) {
    return codexEdges.find((ed) => ed.fromId === fromId && ed.toId === toId) || null;
}

function hasCodexConnectionBetween(fromId, toId) {
    return topologyHasUndirectedLink(fromId, toId, codexEdges);
}

function markCodexEdgeUnsaved(fromId, toId) {
    codexUnsavedEdgeKeys.add(edgeDirectedKey(fromId, toId));
}

function markIncidentCodexEdgesUnsaved(nodeId) {
    if (!nodeId) return;
    codexEdges.forEach((e) => {
        if (e.fromId === nodeId || e.toId === nodeId) {
            markCodexEdgeUnsaved(e.fromId, e.toId);
        }
    });
}

function removeCodexEdgeDirected(fromId, toId) {
    const next = codexEdges.filter((e) => !(e.fromId === fromId && e.toId === toId));
    if (next.length === codexEdges.length) return;
    codexEdges = next;
    codexUnsavedEdgeKeys.delete(edgeDirectedKey(fromId, toId));
    const pk = codexUnorderedPairKey(fromId, toId);
    cordDoubleRightLastTs.delete(pk);
    if (cordPendingDeletePairKey === pk) cordPendingDeletePairKey = null;
    markCodexLayoutDirty();
    redrawCodexEdges();
}

/**
 * Swap directed endpoints so packet flow (A → B) flips.
 * @param {{ fromId: string, toId: string }} edge
 */
function reverseCodexDirectedEdge(edge) {
    if (!edge || !edge.fromId || !edge.toId) return;
    const oldFrom = edge.fromId;
    const oldTo = edge.toId;
    const oldKey = edgeDirectedKey(oldFrom, oldTo);
    codexUnsavedEdgeKeys.delete(oldKey);
    deleteCodexCordPacketStateForKey(oldKey);
    edge.fromId = oldTo;
    edge.toId = oldFrom;
    markCodexEdgeUnsaved(edge.fromId, edge.toId);

    markCodexLayoutDirty();
    redrawCodexEdges();
}

function reverseCodexEdgeForSelectedPair() {
    const selected = getSelectedCodexNodesInRoot();
    if (selected.length !== 2) return;
    const ida = selected[0].dataset.codexNodeId;
    const idb = selected[1].dataset.codexNodeId;
    const e = findEdge(ida, idb) || findEdge(idb, ida);
    if (!e) return;
    reverseCodexDirectedEdge(e);
}

/** Add a single directed link if absent (no duplicate pair; respects {@link hasCodexConnectionBetween}). */
function addDirectedCodexEdge(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return false;
    if (findEdge(fromId, toId)) return false;
    if (hasCodexConnectionBetween(fromId, toId)) return false;
    codexEdges.push({ fromId, toId });
    markCodexEdgeUnsaved(fromId, toId);
    return true;
}



/**
 * Reconcile Codex cords with archive JSON (heroes/factions/npcs): drop edges that no longer have a matching
 * `showInCodex` row, then add any missing links from archives. (Junction / country links are left untouched.)
 *
 * Bio↔bio chords listed in the archive are also **removed** when the graph already connects the same pair
 * through at least one junction (“break”) waypoint — same rule as skipping adds — so merged breaks do not
 * leave a misleading direct cord alongside A→J→…→B routing.
 */
async function syncCodexEdgesFromBioArchiveConnections() {
    if (!root || !Array.isArray(codexAllNodes) || codexAllNodes.length === 0) return;
    const files = [
        ['heroes', 'src/data/story-archive-heroes.json'],
        ['factions', 'src/data/story-archive-factions.json'],
        ['npcs', 'src/data/story-archive-npcs.json']
    ];
    /** @type {Set<string>} */
    const allowedUnorderedNodePairKeys = new Set();
    /** @type {{ arch: string, events: object[] }[]} */
    const loadedArchives = [];
    for (let fi = 0; fi < files.length; fi += 1) {
        const arch = files[fi][0];
        const url = files[fi][1];
        let events = [];
        try {
            const sep = url.includes('?') ? '&' : '?';
            const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) continue;
            const data = await res.json();
            events = Array.isArray(data.events) ? data.events : [];
        } catch (_) {
            continue;
        }
        loadedArchives.push({ arch, events });
        const subjectKind = arch === 'heroes' ? 'hero' : arch === 'factions' ? 'faction' : 'npc';
        for (let ei = 0; ei < events.length; ei += 1) {
            const ev = events[ei];
            if (!ev) continue;
            let subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (
                !subjectName
                && Array.isArray(ev.variants)
                && ev.variants[0]
                && ev.variants[0].name != null
            ) {
                subjectName = String(ev.variants[0].name).trim();
            }
            if (!subjectName) continue;
            const conns = Array.isArray(ev.connections) ? ev.connections : [];
            for (let ci = 0; ci < conns.length; ci += 1) {
                const c = conns[ci];
                if (!c || c.showInCodex !== true) continue;
                let lk = String(c.kind || 'hero').toLowerCase();
                if (lk === 'character') lk = 'hero';
                if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
                const linkedName = c.name != null ? String(c.name).trim() : '';
                if (!linkedName) continue;
                const fromId = findCodexNodeIdForBioEntity(subjectKind, subjectName, codexAllNodes);
                const toId = findCodexNodeIdForBioEntity(lk, linkedName, codexAllNodes);
                if (!fromId || !toId || fromId === toId) continue;
                allowedUnorderedNodePairKeys.add(codexUnorderedPairKey(fromId, toId));
            }
        }
    }

    let removed = 0;
    const nextEdges = [];
    for (let ei = 0; ei < codexEdges.length; ei += 1) {
        const e = codexEdges[ei];
        if (!e || !e.fromId || !e.toId) continue;
        const nFrom = codexAllNodes.find((n) => n && n.id === e.fromId);
        const nTo = codexAllNodes.find((n) => n && n.id === e.toId);
        if (!codexEdgeIsBioEntityChord(nFrom, nTo)) {
            nextEdges.push(e);
            continue;
        }
        const pk = codexUnorderedPairKey(e.fromId, e.toId);
        const authorized = allowedUnorderedNodePairKeys.has(pk);
        const redundantChord =
            authorized && topologyJunctionAlternatePath(e.fromId, e.toId, codexAllNodes, codexEdges);
        if (authorized && !redundantChord) {
            nextEdges.push(e);
        } else {
            removed += 1;
            codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    }
    if (removed > 0) {
        codexEdges = nextEdges;
        const pk = cordPendingDeletePairKey;
        if (pk && !codexEdges.some((ed) => codexUnorderedPairKey(ed.fromId, ed.toId) === pk)) {
            cordPendingDeletePairKey = null;
        }
    }

    let added = 0;
    for (let ai = 0; ai < loadedArchives.length; ai += 1) {
        const { arch, events } = loadedArchives[ai];
        const subjectKind = arch === 'heroes' ? 'hero' : arch === 'factions' ? 'faction' : 'npc';
        for (let ei = 0; ei < events.length; ei += 1) {
            const ev = events[ei];
            if (!ev) continue;
            let subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (
                !subjectName
                && Array.isArray(ev.variants)
                && ev.variants[0]
                && ev.variants[0].name != null
            ) {
                subjectName = String(ev.variants[0].name).trim();
            }
            if (!subjectName) continue;
            const conns = Array.isArray(ev.connections) ? ev.connections : [];
            for (let ci = 0; ci < conns.length; ci += 1) {
                const c = conns[ci];
                if (!c || c.showInCodex !== true) continue;
                let lk = String(c.kind || 'hero').toLowerCase();
                if (lk === 'character') lk = 'hero';
                if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
                const linkedName = c.name != null ? String(c.name).trim() : '';
                if (!linkedName) continue;
                const fromId = findCodexNodeIdForBioEntity(subjectKind, subjectName, codexAllNodes);
                const toId = findCodexNodeIdForBioEntity(lk, linkedName, codexAllNodes);
                if (!fromId || !toId || fromId === toId) continue;
                if (topologyJunctionAlternatePath(fromId, toId, codexAllNodes, codexEdges)) continue;
                if (addDirectedCodexEdge(fromId, toId)) added += 1;
            }
        }
    }

    if (removed > 0 || added > 0) {
        markCodexLayoutDirty();
        redrawCodexEdges();
        const parts = [];
        if (removed > 0) parts.push(`removed ${removed} orphan link(s)`);
        if (added > 0) parts.push(`added ${added} from archives`);
        updateAppStatus(`Codex: ${parts.join('; ')} (“Show in Codex”).`, 'success');
    }
}

function findCodexDuplicatePortraitNodeId(kind, heroName, faction, countryKey) {
    if (!Array.isArray(codexAllNodes)) return '';
    if (kind === 'hero' && String(heroName || '').trim()) {
        const t = String(heroName).trim();
        for (let i = 0; i < codexAllNodes.length; i += 1) {
            const n = codexAllNodes[i];
            if (n && n.kind === 'hero' && heroNamesLooselyEqualCodex(n.heroName, t)) return n.id;
        }
    } else if (kind === 'npc' && String(heroName || '').trim()) {
        const t = String(heroName).trim().toLowerCase();
        for (let j = 0; j < codexAllNodes.length; j += 1) {
            const n = codexAllNodes[j];
            if (n && n.kind === 'npc' && String(n.npcName || '').trim().toLowerCase() === t) return n.id;
        }
    } else if (kind === 'faction' && faction && faction.filename) {
        const fn = String(faction.filename).trim();
        for (let k = 0; k < codexAllNodes.length; k += 1) {
            const n = codexAllNodes[k];
            if (n && n.kind === 'faction' && String(n.factionFilename || '').trim() === fn) return n.id;
        }
    } else if (kind === 'country' && countryKey) {
        const ck = String(countryKey).trim();
        for (let m = 0; m < codexAllNodes.length; m += 1) {
            const n = codexAllNodes[m];
            if (n && n.kind === 'country' && String(n.countryKey || '').trim() === ck) return n.id;
        }
    }
    return '';
}

/** World top-left for a new junction centered between two node centers. */
function junctionTopLeftBetweenNodeElements(elFrom, elTo) {
    const cA = getNodeCenterWorldPx(elFrom);
    const cB = getNodeCenterWorldPx(elTo);
    const mx = (cA.x + cB.x) / 2;
    const my = (cA.y + cB.y) / 2;
    const scale = resolveCodexNodeScale('junction', undefined);
    const dim = CODEX_JUNCTION_BASE_PX * scale;
    const x = mx - dim / 2;
    const y = my - dim / 2;
    return clampCodexNodeTopLeftToWorld(x, y, scale, 'junction');
}

/**
 * Dev mode: with two nodes selected, insert a junction on the segment and wire A → break → B.
 * If a directed link already exists between the pair, it is replaced by two links through the new waypoint.
 * If there is no link, creates first-selected → break → second-selected (same order as A/B preview).
 */
function insertCodexBreakBetweenSelectedPair() {
    if (codexMode !== 'dev') return;
    const selected = getSelectedCodexNodesInRoot();
    if (selected.length !== 2) return;
    const elA = selected[0];
    const elB = selected[1];
    const ida = elA.dataset.codexNodeId;
    const idb = elB.dataset.codexNodeId;
    if (!ida || !idb || ida === idb) return;

    const existing = findEdge(ida, idb) || findEdge(idb, ida);
    let fromId;
    let toId;
    let elFrom;
    let elTo;
    if (existing) {
        fromId = existing.fromId;
        toId = existing.toId;
        elFrom = codexNodeElements.get(fromId);
        elTo = codexNodeElements.get(toId);
        if (!elFrom || !elTo) return;
        removeCodexEdgeDirected(fromId, toId);
    } else {
        fromId = ida;
        toId = idb;
        elFrom = elA;
        elTo = elB;
    }

    const { x: jx, y: jy } = junctionTopLeftBetweenNodeElements(elFrom, elTo);
    const jId = generateNodeId();
    placeCodexNode(jx, jy, 'junction', null, null, { fromSaved: false, id: jId, skipRedraw: true });

    const added1 = addDirectedCodexEdge(fromId, jId);
    const added2 = addDirectedCodexEdge(jId, toId);
    if (!added1 || !added2) {
        updateAppStatus('Could not add links through the new break node (duplicate or invalid).', 'warning');
    }

    const elJ = codexNodeElements.get(jId);
    if (elFrom && elJ) {
        markNodeVisualUnsaved(elFrom);
        markNodeVisualUnsaved(elJ);
    }
    if (elTo) markNodeVisualUnsaved(elTo);
    markCodexLayoutDirty();
    redrawCodexEdges();
    scheduleUpdateCodexVirtualScroll();
    selectCodexNodesPair(elFrom, elJ, elJ);
    updateAppStatus('Inserted break waypoint between the two nodes.', 'success');
}

/**
 * Dev mode: merge two selected junction (“break”) nodes into one at the **primary** selection’s position.
 * Rewires every edge that touched the secondary junction to use the primary id; removes the secondary node.
 * Does not synthesize new bio↔bio edges — only remaps endpoints onto the kept junction id.
 * @returns {boolean}
 */
function mergeCodexJunctionPairKeepPrimary(primaryId, secondaryId) {
    if (!primaryId || !secondaryId || primaryId === secondaryId || !Array.isArray(codexAllNodes) || !Array.isArray(codexEdges)) {
        return false;
    }
    const p = codexAllNodes.find((n) => n && n.id === primaryId);
    const s = codexAllNodes.find((n) => n && n.id === secondaryId);
    if (!p || !s || p.kind !== 'junction' || s.kind !== 'junction') return false;

    const next = [];
    const seen = new Set();
    const take = (f, t) => {
        if (!f || !t || f === t) return;
        const k = edgeDirectedKey(f, t);
        if (seen.has(k)) return;
        seen.add(k);
        next.push({ fromId: f, toId: t });
    };
    for (let i = 0; i < codexEdges.length; i += 1) {
        const e = codexEdges[i];
        if (!e || !e.fromId || !e.toId) continue;
        let f = e.fromId;
        let t = e.toId;
        if (f === secondaryId) f = primaryId;
        if (t === secondaryId) t = primaryId;
        take(f, t);
    }
    codexEdges = next;

    codexAllNodes = codexAllNodes.filter((n) => n && n.id !== secondaryId);
    const elS = codexNodeElements.get(secondaryId);
    if (elS) {
        codexSelectedNodeEls.delete(elS);
        if (codexPrimarySelectedNodeEl === elS) {
            codexPrimarySelectedNodeEl = codexNodeElements.get(primaryId) || null;
        }
        if (elS.parentNode) elS.remove();
    }
    unregisterCodexNodeRenderTracking(secondaryId);
    codexNodeElements.delete(secondaryId);

    const elP = codexNodeElements.get(primaryId);
    if (elP) {
        markNodeVisualUnsaved(elP);
        markCodexLayoutDirty();
        redrawCodexEdges();
        scheduleUpdateCodexVirtualScroll();
        selectCodexNode(elP);
        updateAppStatus('Merged two break nodes into one at the primary selection.', 'success');
        return true;
    }
    markCodexLayoutDirty();
    redrawCodexEdges();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus('Merged junctions; primary DOM was missing — check the board.', 'warning');
    return true;
}

function mergeCodexSelectedJunctionPair() {
    if (codexMode !== 'dev') return;
    const selected = getSelectedCodexNodesInRoot();
    if (selected.length !== 2) return;
    const el0 = selected[0];
    const el1 = selected[1];
    if (!el0?.classList.contains('codex-node--junction') || !el1?.classList.contains('codex-node--junction')) {
        updateAppStatus('Merge: select two break (junction) nodes.', 'warning');
        return;
    }
    const id0 = el0.dataset.codexNodeId;
    const id1 = el1.dataset.codexNodeId;
    if (!id0 || !id1 || id0 === id1) return;
    /** First in selection order matches preview “A” (first picked). */
    mergeCodexJunctionPairKeepPrimary(id0, id1);
}

/**
 * Toolbar preview: single node, two nodes + link (reverse), two nodes no link, or network link-in-progress.
 * @returns {{ kind: 'none' } | { kind: 'single', fromEl: HTMLElement } | { kind: 'edge', fromEl: HTMLElement|null, toEl: HTMLElement|null, edge: object } | { kind: 'pair-no-edge', fromEl: HTMLElement, toEl: HTMLElement } | { kind: 'pending', fromEl: HTMLElement, toEl: null } | { kind: 'cord-pending', fromEl: HTMLElement, toEl: HTMLElement }}
 */
function getCodexToolbarEndpointPreviewState() {
    if (!root) return { kind: 'none' };
    const selected = getSelectedCodexNodesInRoot();

    if (codexInteractionMode === 'network' && networkLinkSourceId) {
        const srcEl =
            selected.find((n) => n.dataset.codexNodeId === networkLinkSourceId)
            || codexNodeElements.get(networkLinkSourceId); // Use Map for O(1) lookup
        if (srcEl && root.contains(srcEl)) {
            const srcInSel = selected.some((n) => n.dataset.codexNodeId === networkLinkSourceId);
            if (selected.length === 2 && srcInSel) {
                const other = selected.find((n) => n.dataset.codexNodeId !== networkLinkSourceId);
                if (other) {
                    const ida = networkLinkSourceId;
                    const idb = other.dataset.codexNodeId;
                    const e = findEdge(ida, idb) || findEdge(idb, ida);
                    if (e) {
                        // Use Map for O(1) lookups instead of querySelector (performance optimization)
                        const fromEl = codexNodeElements.get(e.fromId);
                        const toEl = codexNodeElements.get(e.toId);
                        return { kind: 'edge', fromEl, toEl, edge: e };
                    }
                    return { kind: 'cord-pending', fromEl: srcEl, toEl: other };
                }
            }
            return { kind: 'pending', fromEl: srcEl, toEl: null };
        }
    }

    if (selected.length === 2) {
        const ida = selected[0].dataset.codexNodeId;
        const idb = selected[1].dataset.codexNodeId;
        const e = findEdge(ida, idb) || findEdge(idb, ida);
        if (e) {
            // Use Map for O(1) lookups instead of querySelector (performance optimization)
            const fromEl = codexNodeElements.get(e.fromId);
            const toEl = codexNodeElements.get(e.toId);
            return { kind: 'edge', fromEl, toEl, edge: e };
        }
        return { kind: 'pair-no-edge', fromEl: selected[0], toEl: selected[1] };
    }
    if (selected.length === 1) {
        return { kind: 'single', fromEl: selected[0] };
    }
    return { kind: 'none' };
}

/**
 * `body` uses `transform: scale(var(--desktop-scale))` (base.css). Layout `left`/`top` on Codex children are in
 * pre-scale space; `clientX`/`getBoundingClientRect` are viewport pixels — convert viewport delta → layout px.
 */
function getCodexBodyLayoutPerViewportPx() {
    const raw = getComputedStyle(document.body).getPropertyValue('--desktop-scale').trim();
    const fromVar = parseFloat(raw);
    if (Number.isFinite(fromVar) && fromVar > 0.05 && fromVar < 20) return fromVar;
    const tr = getComputedStyle(document.body).transform;
    if (!tr || tr === 'none') return 1;
    const m = tr.match(/matrix\(([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),/);
    if (m) {
        const a = Math.abs(parseFloat(m[1]));
        if (Number.isFinite(a) && a > 0.01) return a;
    }
    const sc = tr.match(/scale\(([-\d.e]+)\)/);
    if (sc) {
        const s = Math.abs(parseFloat(sc[1]));
        if (Number.isFinite(s) && s > 0.01) return s;
    }
    return 1;
}

/**
 * Screen → root layout px, then world (same model as `translate(pan) scale(z)` on `.codex-world`).
 * Must match {@link openPickerAtRootPoint}: body scale turns viewport deltas into layout px.
 */
function clientToWorldCodex(clientX, clientY) {
    if (!root) return { x: 0, y: 0 };
    const rr = root.getBoundingClientRect();
    const s = getCodexBodyLayoutPerViewportPx();
    const lx = (clientX - rr.left) / s;
    const ly = (clientY - rr.top) / s;
    if (!codexWorldEl) {
        return { x: lx, y: ly };
    }
    const z = Math.max(0.05, codexViewZoom);
    return {
        x: (lx - codexViewPanX) / z,
        y: (ly - codexViewPanY) / z
    };
}

/** Expanded world-space AABB of what’s visible in the Codex viewport (same space as node `left`/`top`). */
function getCodexVisibleWorldBoundsExpanded(marginPx) {
    return computeCodexVisibleWorldBoundsExpanded({
        root,
        worldEl: codexWorldEl,
        panX: codexViewPanX,
        panY: codexViewPanY,
        zoom: codexViewZoom,
        marginPx,
        worldW: CODEX_WORLD_W,
        worldH: CODEX_WORLD_H
    });
}

/** Keep node top-left inside the board (world or root) for the given scale. */
function clampCodexNodeTopLeftToWorld(x, y, scale, kind = 'hero') {
    const s = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(scale) || 1));
    const dim = (kind === 'junction' ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX) * s;
    const W = codexWorldEl ? CODEX_WORLD_W : Math.max(1, root?.clientWidth || 1);
    const H = codexWorldEl ? CODEX_WORLD_H : Math.max(1, root?.clientHeight || 1);
    const maxX = Math.max(0, W - dim);
    const maxY = Math.max(0, H - dim);
    return {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY))
    };
}

/** Node center in world / SVG user space (same as style.left/top + drag translate). */
function getNodeCenterWorldPx(el) {
    if (!el) return { x: 0, y: 0 };
    const baseLeft = parseFloat(el.style.left) || 0;
    const baseTop = parseFloat(el.style.top) || 0;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const { tx, ty } = parseTranslatePxFromTransform(el.style.transform);
    return {
        x: baseLeft + w / 2 + tx,
        y: baseTop + h / 2 + ty
    };
}

/** One line per node: world-space center px (same as cord geometry). JSON stores top-left. */
function ensureCodexNodeCoordLabel(el) {
    if (!el) return null;
    let lab = el.querySelector(':scope > .codex-node__coord-label');
    if (!lab) {
        lab = document.createElement('div');
        lab.className = 'codex-node__coord-label';
        lab.setAttribute('aria-hidden', 'true');
        lab.title =
            'Node center in world px (cord math). Saved layout uses top-left — center ≈ top-left + half size.';
        el.appendChild(lab);
    }
    return lab;
}

/** @param {NodeListOf<Element>|Element[]|undefined} [nodeList] */
function syncCodexNodeCoordLabels(nodeList) {
    if (!root || !codexDebugUiVisible) return;
    // Skip in View Mode for performance
    if (codexMode === 'view') return;
    const list = nodeList || root.querySelectorAll('.codex-node');
    list.forEach((nodeEl) => {
        if (!root.contains(nodeEl)) return;
        const lab = ensureCodexNodeCoordLabel(nodeEl);
        const { x, y } = getNodeCenterWorldPx(nodeEl);
        lab.textContent = `${Math.round(x)}, ${Math.round(y)}`;
    });
}

/**
 * After a drag, snap each moved node's center so incident segments to **fixed** neighbors are octilinear,
 * but only when the current bearing is already within {@link CODEX_OCT_SOFT_SNAP_TOL_DEG} of a 45° lane.
 * Multiple fixed neighbors: average candidate centers (then clamp). Runs in passes for small chains.
 */
function applyOctilinearSnapOnDragRelease(draggedIds, maxPasses = 14) {
    if (!root || !draggedIds || draggedIds.size === 0 || !codexEdges.length) return;

    const snapOneNodeFromFixedNeighbors = (nodeEl) => {
        const id = nodeEl.dataset.codexNodeId;
        if (!id) return false;
        const candidates = [];
        for (let j = 0; j < codexEdges.length; j++) {
            const e = codexEdges[j];
            let fixedId = null;
            let asToEndpoint = false;
            if (e.toId === id && !draggedIds.has(e.fromId)) {
                fixedId = e.fromId;
                asToEndpoint = true;
            } else if (e.fromId === id && !draggedIds.has(e.toId)) {
                fixedId = e.toId;
                asToEndpoint = false;
            }
            if (!fixedId) continue;
            const fixEl = codexNodeElById(fixedId);
            if (!fixEl || !root.contains(fixEl)) continue;
            const cFix = getNodeCenterWorldPx(fixEl);
            const cMe = getNodeCenterWorldPx(nodeEl);
            if (asToEndpoint) {
                const dx = cMe.x - cFix.x;
                const dy = cMe.y - cFix.y;
                const len = Math.hypot(dx, dy);
                if (len < 0.5) continue;
                const ang = Math.atan2(dy, dx);
                if (cordAngleDistToNearestOctilinearDegFromRad(ang) > CODEX_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                    continue;
                }
                const snappedAng = Math.round(ang / CODEX_OCT_RAD) * CODEX_OCT_RAD;
                candidates.push({
                    x: cFix.x + len * Math.cos(snappedAng),
                    y: cFix.y + len * Math.sin(snappedAng)
                });
            } else {
                const dx = cFix.x - cMe.x;
                const dy = cFix.y - cMe.y;
                const len = Math.hypot(dx, dy);
                if (len < 0.5) continue;
                const ang = Math.atan2(dy, dx);
                if (cordAngleDistToNearestOctilinearDegFromRad(ang) > CODEX_OCT_SOFT_SNAP_TOL_DEG + 1e-9) {
                    continue;
                }
                const snappedAng = Math.round(ang / CODEX_OCT_RAD) * CODEX_OCT_RAD;
                candidates.push({
                    x: cFix.x - len * Math.cos(snappedAng),
                    y: cFix.y - len * Math.sin(snappedAng)
                });
            }
        }
        if (!candidates.length) return false;
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < candidates.length; i++) {
            sx += candidates[i].x;
            sy += candidates[i].y;
        }
        const nx = sx / candidates.length;
        const ny = sy / candidates.length;
        const cur = getNodeCenterWorldPx(nodeEl);
        if ((nx - cur.x) ** 2 + (ny - cur.y) ** 2 < CODEX_OCT_RELEASE_SNAP_EPS * CODEX_OCT_RELEASE_SNAP_EPS) {
            return false;
        }
        applyWorldCenterToNodeTopLeft(nodeEl, nx, ny);
        return true;
    };

    const ids = [...draggedIds];
    for (let p = 0; p < maxPasses; p++) {
        let any = false;
        for (let i = 0; i < ids.length; i++) {
            const el = codexNodeElById(ids[i]);
            if (el && root.contains(el) && snapOneNodeFromFixedNeighbors(el)) any = true;
        }
        if (!any) break;
    }
}

/** Move node so its center is `(cx, cy)` after clamping to the board. */
function applyWorldCenterToNodeTopLeft(el, cx, cy) {
    if (!el || !root) return;
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const kind = el.dataset.codexKind || 'hero';
    const scale = parseFloat(el.dataset.codexScale) || 1;
    const left = cx - w / 2;
    const top = cy - h / 2;
    const { x, y } = clampCodexNodeTopLeftToWorld(left, top, scale, kind);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    /* Octilinear snap updates DOM after finishDrag wrote codexAllNodes; export uses the model. */
    const nodeId = el.dataset.codexNodeId;
    if (nodeId && Array.isArray(codexAllNodes)) {
        const nodeObj = codexAllNodes.find((n) => n && n.id === nodeId);
        if (nodeObj) {
            nodeObj.x = x;
            nodeObj.y = y;
        }
    }
}

function codexNodeElById(nodeId) {
    if (!nodeId) return null;
    // Use Map for O(1) lookup instead of querySelector (performance optimization)
    return codexNodeElements.get(nodeId) || null;
}

/** Junction waypoint (“break”): cord packets may continue along outgoing directed edges. */
function codexNodeIsJunctionWaypoint(nodeId) {
    const el = codexNodeElById(nodeId);
    return !!(el && el.classList.contains('codex-node--junction'));
}

function buildPolylineForEdge(edge) {
    if (!root) return null;
    // Use Map for O(1) lookups instead of querySelector (performance optimization)
    const a = codexNodeElements.get(edge.fromId);
    const b = codexNodeElements.get(edge.toId);
    if (!a || !b) return null;
    const ca = getNodeCenterWorldPx(a);
    const cb = getNodeCenterWorldPx(b);
    return [{ x: ca.x, y: ca.y }, { x: cb.x, y: cb.y }];
}

function appendCodexJunctionElbowParallelograms(parentG, ns, worldCullRect = null) {
    appendCodexJunctionElbowParallelogramsCore(parentG, ns, worldCullRect, {
        getRoot: () => root,
        getEdges: () => codexEdges,
        codexNodeElById,
        getNodeCenterWorldPx,
        edgeCordAppearance,
        getCordColorHex: () => codexVisualPrefs.cordColor
    });
}

function clearPendingCodexDeleteState() {
    cordPendingDeletePairKey = null;
    codexBulkNodeDeleteArmedAt = 0;
    cordDoubleRightLastTs.clear();
    if (root) {
        root.querySelectorAll('.codex-node--pending-delete').forEach((el) => {
            el.classList.remove('codex-node--pending-delete');
        });
    }
}

/** True when edge/node visuals depend on pending-delete state (call before clearPendingCodexDeleteState). */
function codexHasPendingDeleteVisuals() {
    if (cordPendingDeletePairKey != null) return true;
    if (root && root.querySelector('.codex-node--pending-delete')) return true;
    return false;
}

/** Clears pending-delete state and schedules an edge redraw only if that state affected drawing (avoids ~O(nodes) SVG rebuild on every pointerdown). */
function clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded() {
    const had = codexHasPendingDeleteVisuals();
    clearPendingCodexDeleteState();
    if (had) scheduleRedrawCodexEdges();
}

/** Drop virtual-scroll + double–right-click tracking for a removed node id. */
function unregisterCodexNodeRenderTracking(nodeId) {
    if (!nodeId) return;
    codexRenderedNodeIds.delete(nodeId);
    codexNodeElements.delete(nodeId);
    codexNodeDeleteLastRightTs.delete(nodeId);
}

/**
 * Dev toolbar: clear every node and link from the board (Save Codex still required to persist).
 * Confirmation prompts the user with the current totals.
 */
function clearAllCodexBoard() {
    if (codexMode !== 'dev' || !root) return;
    const totalNodes = codexAllNodes.length;
    const totalEdges = codexEdges.length;
    if (totalNodes === 0 && totalEdges === 0) {
        updateAppStatus('Codex is already empty.', 'info');
        return;
    }
    const ok = userConfirms(
        `Clear the entire Codex board? This removes ${totalNodes} node${totalNodes === 1 ? '' : 's'} and ${totalEdges} link${totalEdges === 1 ? '' : 's'}. Use Save Codex to persist the change.`
    );
    if (!ok) return;

    stripCodexBoardForFullReplace();
    codexAllNodes = [];
    codexEdges = [];
    codexUnsavedEdgeKeys.clear();
    cordDoubleRightLastTs.clear();
    codexNodeDeleteLastRightTs.clear();
    clearPendingCodexDeleteState();
    codexRenderedNodeIds.clear();
    codexNodeElements.clear();
    codexSelectedNodeEls = new Set();
    codexPrimarySelectedNodeEl = null;
    codexBulkNodeDeleteArmedAt = 0;

    markCodexLayoutDirty();
    redrawCodexEdges();
    applyCodexSelectionToDom();
    updateCodexToolbar();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus(
        `Cleared Codex (${totalNodes} node${totalNodes === 1 ? '' : 's'}, ${totalEdges} link${totalEdges === 1 ? '' : 's'}). Save Codex to persist.`,
        'success'
    );
}

/**
 * Dev toolbar: delete all selected nodes immediately (edges removed; layout marked dirty).
 */
function deleteCodexToolbarSelectedNodes() {
    if (codexMode !== 'dev' || !root) return;
    const toRemove = getSelectedCodexNodesInRoot().filter((n) => root.contains(n));
    const ids = toRemove.map((n) => n.dataset.codexNodeId).filter(Boolean);
    if (!ids.length) return;
    clearPendingCodexDeleteState();
    removeEdgesForDeletedNodesWithJunctionBridging(ids);
    codexAllNodes = codexAllNodes.filter((n) => !ids.includes(n.id));
    markCodexLayoutDirty();
    codexSelectedNodeEls.clear();
    codexPrimarySelectedNodeEl = null;
    for (const id of ids) unregisterCodexNodeRenderTracking(id);
    toRemove.forEach((n) => n.remove());
    applyCodexSelectionToDom();
    redrawCodexEdges();
    updateCodexToolbar();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus(ids.length === 1 ? 'Deleted 1 node.' : `Deleted ${ids.length} nodes.`, 'success');
}

function pruneStaleCodexSelection() {
    for (const el of [...codexSelectedNodeEls]) {
        if (!root || !root.contains(el)) codexSelectedNodeEls.delete(el);
    }
    if (codexPrimarySelectedNodeEl && (!root || !root.contains(codexPrimarySelectedNodeEl))) {
        codexPrimarySelectedNodeEl = null;
    }
    if (codexPrimarySelectedNodeEl && !codexSelectedNodeEls.has(codexPrimarySelectedNodeEl)) {
        const rest = [...codexSelectedNodeEls];
        codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
    }
}

function getSelectedCodexNodesInRoot() {
    pruneStaleCodexSelection();
    if (!root) return [];
    return [...codexSelectedNodeEls].filter((el) => root.contains(el));
}

function stripCodexSelectionFromDom() {
    if (!root) return;
    root.querySelectorAll('.codex-node--selected').forEach((el) => {
        el.classList.remove('codex-node--selected');
    });
}

function stripCodexBDescendantGlowFromDom() {
    if (!root) return;
    root.querySelectorAll('.codex-node--b-of-selected-a').forEach((el) => {
        el.classList.remove('codex-node--b-of-selected-a');
    });
}

/** All node ids reachable from `fromId` following directed edges (from → to), excluding `fromId`. */
function getCodexStrictOutgoingDescendantIds(fromId) {
    const result = new Set();
    const visited = new Set();
    const queue = [fromId];
    visited.add(fromId);
    while (queue.length) {
        const id = queue.shift();
        for (let i = 0; i < codexEdges.length; i++) {
            const e = codexEdges[i];
            if (e.fromId !== id) continue;
            const t = e.toId;
            if (!t || visited.has(t)) continue;
            visited.add(t);
            result.add(t);
            queue.push(t);
        }
    }
    return result;
}

function refreshCodexBDescendantGlowForSelection() {
    stripCodexBDescendantGlowFromDom();
    if (!root || codexInteractionMode !== 'drag' || codexSelectedNodeEls.size !== 1) return;
    const aEl = codexPrimarySelectedNodeEl;
    if (!aEl || !root.contains(aEl) || !codexSelectedNodeEls.has(aEl)) return;
    const aId = aEl.dataset.codexNodeId;
    if (!aId) return;
    getCodexStrictOutgoingDescendantIds(aId).forEach((bid) => {
        const bel = codexNodeElById(bid);
        if (bel && root.contains(bel)) bel.classList.add('codex-node--b-of-selected-a');
    });
}

function applyCodexSelectionToDom() {
    stripCodexSelectionFromDom();
    codexSelectedNodeEls.forEach((el) => {
        if (root && root.contains(el)) el.classList.add('codex-node--selected');
    });
    refreshCodexBDescendantGlowForSelection();
}

function edgeIsCordPendingDelete(edge) {
    return cordPendingDeletePairKey === codexUnorderedPairKey(edge.fromId, edge.toId);
}

/**
 * @returns {'red'|'yellow'|'violet'}
 */
function edgeCordAppearance(edge) {
    if (edgeIsCordPendingDelete(edge)) return 'red';
    if (edgeCordShowsYellow(edge)) return 'yellow';
    return 'violet';
}

/**
 * Clamp a shared translate so every node stays inside the board.
 * @param {number} tx
 * @param {number} ty
 * @param {HTMLElement[]} nodeEls
 */
function clampCodexGroupDragDelta(tx, ty, nodeEls) {
    let minTx = -Infinity;
    let maxTx = Infinity;
    let minTy = -Infinity;
    let maxTy = Infinity;
    for (let i = 0; i < nodeEls.length; i++) {
        const nodeEl = nodeEls[i];
        const bl = parseFloat(nodeEl.style.left) || 0;
        const bt = parseFloat(nodeEl.style.top) || 0;
        const w = nodeEl.offsetWidth;
        const h = nodeEl.offsetHeight;
        let maxX;
        let maxY;
        if (codexWorldEl) {
            maxX = Math.max(0, CODEX_WORLD_W - w);
            maxY = Math.max(0, CODEX_WORLD_H - h);
        } else {
            maxX = Math.max(0, root.clientWidth - w);
            maxY = Math.max(0, root.clientHeight - h);
        }
        minTx = Math.max(minTx, -bl);
        maxTx = Math.min(maxTx, maxX - bl);
        minTy = Math.max(minTy, -bt);
        maxTy = Math.min(maxTy, maxY - bt);
    }
    return {
        tx: Math.max(minTx, Math.min(maxTx, tx)),
        ty: Math.max(minTy, Math.min(maxTy, ty))
    };
}

function selectDragGroupForNode(el) {
    if (codexInteractionMode !== 'drag') return [el];
    pruneStaleCodexSelection();
    if (codexSelectedNodeEls.size > 1 && codexSelectedNodeEls.has(el)) {
        return [...codexSelectedNodeEls].filter((n) => root && root.contains(n));
    }
    return [el];
}

function markCodexLayoutDirty() {
    codexLayoutDirty = true;
    updateCodexToolbar();
}

function updateCodexToolbar() {
    if (!codexToolbarEl) return;
    const saveBtn = codexToolbarEl.querySelector('.codex-toolbar__save');
    const hint = codexToolbarEl.querySelector('.codex-toolbar__hint');
    const shrinkBtn = codexToolbarEl.querySelector('.codex-toolbar__shrink');
    const growBtn = codexToolbarEl.querySelector('.codex-toolbar__grow');
    const btnDrag = codexToolbarEl.querySelector('.codex-toolbar__mode-drag');
    const btnNet = codexToolbarEl.querySelector('.codex-toolbar__mode-network');
    const netHint = codexToolbarEl.querySelector('.codex-toolbar__network-hint');
    const selectAllBtn = codexToolbarEl.querySelector('.codex-toolbar__select-all');
    const deleteSelBtn = codexToolbarEl.querySelector('.codex-toolbar__delete-selected');

    if (saveBtn) {
        saveBtn.disabled = !codexLayoutDirty;
        saveBtn.title = codexLayoutDirty
            ? 'Save Codex (browser cache + data/codex-labels.json on dev server). Load always uses that JSON first; GitHub Pages uses data/codex-labels.json from the site.'
            : 'No unsaved Codex changes';
    }
    if (hint) hint.style.display = codexLayoutDirty ? 'inline' : 'none';

    const selectedNodes = getSelectedCodexNodesInRoot();
    const hasSel = selectedNodes.length > 0;
    if (shrinkBtn) {
        shrinkBtn.disabled = !hasSel;
        shrinkBtn.title = hasSel
            ? (selectedNodes.length > 1
                ? 'Shrink selected nodes (size). Header +/− zooms the board.'
                : 'Shrink selected node (size). Header +/− zooms the board.')
            : 'Select a node — or use Select all. Header +/− zooms the board.';
    }
    if (growBtn) {
        growBtn.disabled = !hasSel;
        growBtn.title = hasSel
            ? (selectedNodes.length > 1
                ? 'Grow selected nodes (size). Header +/− zooms the board.'
                : 'Grow selected node (size). Header +/− zooms the board.')
            : 'Select a node — or use Select all. Header +/− zooms the board.';
    }

    if (selectAllBtn && root) {
        const totalNodes = root.querySelectorAll('.codex-node').length;
        selectAllBtn.disabled = totalNodes === 0;
        selectAllBtn.title = totalNodes === 0
            ? 'No nodes on the board'
            : `Select all ${totalNodes} nodes. Use toolbar − / + to change node size; header + / − zooms the whole board.`;
    }

    if (deleteSelBtn) {
        const dev = codexMode === 'dev';
        deleteSelBtn.disabled = !dev || !hasSel;
        deleteSelBtn.title = !dev
            ? 'Switch to Dev mode to delete nodes from the board.'
            : !hasSel
                ? 'Select one or more nodes, then delete them from the board.'
                : selectedNodes.length > 1
                    ? `Delete ${selectedNodes.length} selected nodes (and their links).`
                    : 'Delete the selected node (and its links).';
    }

    const clearAllBtn = codexToolbarEl.querySelector('.codex-toolbar__clear-all');
    if (clearAllBtn) {
        const dev = codexMode === 'dev';
        const totalNodesAll = codexAllNodes.length;
        const totalEdgesAll = codexEdges.length;
        const empty = totalNodesAll === 0 && totalEdgesAll === 0;
        clearAllBtn.disabled = !dev || empty;
        clearAllBtn.title = !dev
            ? 'Switch to Dev mode to clear the board.'
            : empty
                ? 'Codex is already empty.'
                : `Remove all ${totalNodesAll} node${totalNodesAll === 1 ? '' : 's'} and ${totalEdgesAll} link${totalEdgesAll === 1 ? '' : 's'} from the board. Save Codex to persist.`;
    }

    const scaleInput = codexToolbarEl.querySelector('.codex-toolbar__scale-input');
    if (scaleInput) {
        const inputActive = document.activeElement === scaleInput;
        scaleInput.disabled = !hasSel;
        if (!inputActive) {
            if (!hasSel) {
                scaleInput.value = '';
                scaleInput.placeholder = '';
            } else {
                const uniform = getUniformCodexScaleForNodes(selectedNodes);
                if (uniform != null) {
                    scaleInput.value = formatCodexScaleForInput(uniform);
                    scaleInput.placeholder = '';
                } else {
                    scaleInput.value = '';
                    scaleInput.placeholder = '—';
                }
            }
        } else if (!hasSel) {
            scaleInput.disabled = true;
        }
    }

    ensureCodexToolbarSelectionPreviewRow(codexToolbarEl);
    const previewRow = codexToolbarEl.querySelector('.codex-toolbar__row--selection-preview');
    const singleWrap = previewRow?.querySelector('.codex-toolbar__endpoint-preview-single');
    const dualWrap = previewRow?.querySelector('.codex-toolbar__endpoint-preview-dual');
    const previewImgSingle = singleWrap?.querySelector('.codex-toolbar__selection-preview-img');
    const wrapA = dualWrap?.querySelector('.codex-toolbar__selection-preview--from');
    const wrapB = dualWrap?.querySelector('.codex-toolbar__selection-preview--to');
    const previewImgA = wrapA?.querySelector('.codex-toolbar__selection-preview-img');
    const previewImgB = wrapB?.querySelector('.codex-toolbar__selection-preview-img');
    const btnEdgeReverse = dualWrap?.querySelector('.codex-toolbar__edge-reverse');
    const btnInsertBreak = dualWrap?.querySelector('.codex-toolbar__insert-break');
    const btnMergeJunctions = dualWrap?.querySelector('.codex-toolbar__merge-junctions');

    function fillCodexToolbarPreviewImg(img, nodeEl) {
        if (!img) return;
        if (!nodeEl) {
            img.removeAttribute('src');
            img.alt = '';
            return;
        }
        if (nodeEl.classList.contains('codex-node--junction')) {
            img.src = CODEX_JUNCTION_PREVIEW_DATA_URI;
            img.alt = 'Junction';
            return;
        }
        const portrait = nodeEl.querySelector('.codex-node__img');
        const src = portrait?.getAttribute('src') || portrait?.src || '';
        if (src) {
            img.src = src;
            img.alt = portrait?.getAttribute('alt') || '';
        } else {
            img.removeAttribute('src');
            img.alt = '';
        }
    }

    if (previewRow && previewImgSingle && dualWrap && wrapA && wrapB && previewImgA && previewImgB) {
        const st = getCodexToolbarEndpointPreviewState();
        if (st.kind === 'none') {
            previewImgSingle.removeAttribute('src');
            previewRow.style.display = 'none';
        } else if (st.kind === 'single') {
            singleWrap.style.display = '';
            dualWrap.style.display = 'none';
            const isJunction = st.fromEl.classList.contains('codex-node--junction');
            const portrait = st.fromEl.querySelector('.codex-node__img');
            const src = portrait?.getAttribute('src') || portrait?.src || '';
            if (isJunction || src) {
                fillCodexToolbarPreviewImg(previewImgSingle, st.fromEl);
                previewRow.style.display = '';
            } else {
                previewImgSingle.removeAttribute('src');
                previewRow.style.display = 'none';
            }
        } else {
            singleWrap.style.display = 'none';
            dualWrap.style.display = 'flex';
            wrapB.classList.remove('codex-toolbar__selection-preview--empty');
            if (st.kind === 'edge') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, st.toEl);
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = false;
                    btnEdgeReverse.title =
                        'Reverse link direction (swap A and B; packets flow A → B)';
                }
                if (btnInsertBreak) {
                    btnInsertBreak.disabled = codexMode !== 'dev';
                    btnInsertBreak.title =
                        codexMode === 'dev'
                            ? 'Insert break (waypoint): replace A → B with A → break → B (same direction).'
                            : 'Switch to Dev Mode to insert a break between these nodes.';
                }
                if (btnMergeJunctions) {
                    const bothJ =
                        !!st.fromEl?.classList.contains('codex-node--junction')
                        && !!st.toEl?.classList.contains('codex-node--junction');
                    btnMergeJunctions.disabled = !(codexMode === 'dev' && bothJ);
                    btnMergeJunctions.title =
                        codexMode !== 'dev'
                            ? 'Switch to Dev mode to merge break nodes.'
                            : bothJ
                                ? 'Merge both break nodes into one at the primary selection (first picked / highlighted A).'
                                : 'Select two break (junction) nodes to merge.';
                }
            } else if (st.kind === 'pair-no-edge' || st.kind === 'cord-pending') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, st.toEl);
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = true;
                    btnEdgeReverse.title =
                        st.kind === 'cord-pending'
                            ? 'Finish or cancel the link first — direction is set when the cord exists'
                            : 'No link between these nodes — reverse applies to an existing link';
                }
                if (btnInsertBreak) {
                    if (st.kind === 'cord-pending') {
                        btnInsertBreak.disabled = true;
                        btnInsertBreak.title =
                            'Finish or cancel the link first — then you can insert a break on the new cord.';
                    } else {
                        btnInsertBreak.disabled = codexMode !== 'dev';
                        btnInsertBreak.title =
                            codexMode === 'dev'
                                ? 'Insert break (waypoint): create A → break → B using selection order (first → second).'
                                : 'Switch to Dev Mode to insert a break between these nodes.';
                    }
                }
                if (btnMergeJunctions) {
                    const bothJ =
                        !!st.fromEl?.classList.contains('codex-node--junction')
                        && !!st.toEl?.classList.contains('codex-node--junction');
                    btnMergeJunctions.disabled = !(codexMode === 'dev' && bothJ);
                    btnMergeJunctions.title =
                        codexMode !== 'dev'
                            ? 'Switch to Dev mode to merge break nodes.'
                            : bothJ
                                ? 'Merge both break nodes into one at the primary selection (first picked / highlighted A).'
                                : 'Select two break (junction) nodes to merge.';
                }
            } else if (st.kind === 'pending') {
                fillCodexToolbarPreviewImg(previewImgA, st.fromEl);
                fillCodexToolbarPreviewImg(previewImgB, null);
                wrapB.classList.add('codex-toolbar__selection-preview--empty');
                if (btnEdgeReverse) {
                    btnEdgeReverse.disabled = true;
                    btnEdgeReverse.title =
                        'Pick the second node — then you can reverse direction on the new link';
                }
                if (btnInsertBreak) {
                    btnInsertBreak.disabled = true;
                    btnInsertBreak.title = 'Select two nodes to insert a break between them.';
                }
                if (btnMergeJunctions) {
                    btnMergeJunctions.disabled = true;
                    btnMergeJunctions.title = 'Select two break (junction) nodes to merge.';
                }
            }
            previewRow.style.display = '';
        }
    }

    if (btnDrag) {
        btnDrag.classList.toggle('codex-toolbar__mode-btn--active', codexInteractionMode === 'drag');
    }
    if (btnNet) {
        btnNet.classList.toggle('codex-toolbar__mode-btn--active', codexInteractionMode === 'network');
    }
    if (netHint) {
        netHint.style.display = codexInteractionMode === 'network' ? 'block' : 'none';
        if (codexInteractionMode === 'network') {
            const line = networkLinkSourceId
                ? 'Tap another node to connect. Tap the same node again to cancel.'
                : 'Tap a node to start a link.';
            netHint.textContent = `${line} Caps Lock toggles drag / network.`;
        }
    }

    ensureCodexToolbarDebugToggle(codexToolbarEl);
    ensureCodexVisualPrefsPanel();
    syncCodexVisualToolbarFromPrefs();
    syncCodexDebugUiClass();
    refreshCodexBDescendantGlowForSelection();
}

function markNodeVisualUnsaved(el) {
    if (el && el.classList) el.classList.add('codex-node--unsaved');
}

/**
 * @param {HTMLElement|null} el
 * @param {{ network?: boolean, mode?: 'replace'|'toggle' }} [opts]
 */
function debugLogNodeInfo(el) {
    if (!CODEX_PERFORMANCE_DEBUG || !el) return;
    const nid = el.dataset.codexNodeId || 'unknown';
    const kind = el.dataset.codexKind || 'unknown';
    const hero = el.dataset.codexHero || '';
    const npc = el.dataset.codexNpc || '';
    const faction = el.dataset.codexFactionFile || '';
    const country = el.dataset.codexCountryKey || '';

    const variant = el.dataset.codexFrameVariant || '1';
    const rotation = el.dataset.codexHexRotation || '0';
    const isSimplified = el.classList.contains('codex-node--simplified');

    const nodeImage = `${CODEX_FRAME_PATH}${variant}.png`;
    const alphaImage = `${CODEX_NODE_ALPHA_PATH}${variant}.png`;

    console.group(`🎯 Node Selected: ${nid}`);
    console.log('  Kind:', kind);
    console.log('  Hero:', hero || '-');
    console.log('  NPC:', npc || '-');
    console.log('  Faction:', faction || '-');
    console.log('  Country:', country || '-');
    console.log('---');
    console.log('  Frame Variant:', variant);
    console.log('  Hex Rotation:', rotation + '°');
    console.log('  DOM Structure:', isSimplified ? 'simplified (4 elements)' : 'legacy (8 elements)');
    console.log('---');
    console.log('  📦 Node Image (frame):', nodeImage);
    console.log('  🔲 Alpha Image (edges):', alphaImage);
    console.log('  🎭 Mask Image (DOM):', `Mask Node${variant}.png`);
    console.groupEnd();
}

function selectCodexNode(el, opts = {}) {
    if (!root) return;
    if (el == null) {
        codexSelectedNodeEls.clear();
        codexPrimarySelectedNodeEl = null;
        stripCodexSelectionFromDom();
        stripCodexBDescendantGlowFromDom();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        // Skip edge redraw on selection unless pending-delete visuals were cleared
        updateCodexToolbar();
        // Reset toolbar color picker and hex input to default when no node selected
        const colorPicker = root.querySelector('[data-codex-bg-color-picker]');
        const hexInput = root.querySelector('[data-codex-bg-hex-input]');
        if (colorPicker) {
            colorPicker.value = '#ffffff';
        }
        if (hexInput) {
            hexInput.value = '#ffffff';
        }
        return;
    }
    if (!root.contains(el)) return;

    // Debug: log node info when selected
    debugLogNodeInfo(el);

    // Update toolbar color picker and hex input to show selected node's background color
    const colorPicker = root.querySelector('[data-codex-bg-color-picker]');
    const hexInput = root.querySelector('[data-codex-bg-hex-input]');
    const savedBgColor = el.dataset.codexBgColor || '#ffffff';
    if (colorPicker) {
        colorPicker.value = savedBgColor;
    }
    if (hexInput) {
        hexInput.value = savedBgColor;
    }

    if (opts.network) {
        codexSelectedNodeEls.clear();
        codexSelectedNodeEls.add(el);
        codexPrimarySelectedNodeEl = el;
        applyCodexSelectionToDom();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        updateCodexToolbar();
        return;
    }

    const mode = opts.mode || 'replace';
    if (mode === 'toggle') {
        if (codexSelectedNodeEls.has(el)) {
            codexSelectedNodeEls.delete(el);
            if (codexPrimarySelectedNodeEl === el) {
                const rest = [...codexSelectedNodeEls];
                codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
            }
        } else {
            codexSelectedNodeEls.add(el);
            codexPrimarySelectedNodeEl = el;
        }
    } else {
        codexSelectedNodeEls.clear();
        codexSelectedNodeEls.add(el);
        codexPrimarySelectedNodeEl = el;
    }
    applyCodexSelectionToDom();
    clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    // Skip edge redraw on selection unless pending-delete visuals were cleared
    updateCodexToolbar();
}

/** Select exactly two nodes (e.g. after linking). `primaryEl` drives toolbar preview when both exist. */
function selectCodexNodesPair(elA, elB, primaryEl) {
    if (!root) return;
    codexSelectedNodeEls.clear();
    if (elA && root.contains(elA)) codexSelectedNodeEls.add(elA);
    if (elB && root.contains(elB)) codexSelectedNodeEls.add(elB);
    if (primaryEl && root.contains(primaryEl)) {
        codexPrimarySelectedNodeEl = primaryEl;
    } else if (elB && root.contains(elB)) {
        codexPrimarySelectedNodeEl = elB;
    } else if (elA && root.contains(elA)) {
        codexPrimarySelectedNodeEl = elA;
    } else {
        codexPrimarySelectedNodeEl = null;
    }
    applyCodexSelectionToDom();
    clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    updateCodexToolbar();
}

/** Select every node on the board (drag-style multi-select). Header +/− zoom the view; toolbar − / + resize nodes. */
function selectAllCodexNodes() {
    if (!root) return;
    pruneStaleCodexSelection();
    const els = [...root.querySelectorAll('.codex-node')];
    if (!els.length) return;
    networkLinkSourceId = null;
    codexSelectedNodeEls.clear();
    els.forEach((el) => codexSelectedNodeEls.add(el));
    codexPrimarySelectedNodeEl = els[els.length - 1];
    applyCodexSelectionToDom();
    clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    updateCodexToolbar();
}

/** Toolbar mode buttons + clearing network pick state when entering network. */
function applyCodexToolbarInteractionMode(mode) {
    if (mode === 'network') {
        codexInteractionMode = 'network';
        networkLinkSourceId = null;
        selectCodexNode(null); /* updates toolbar */
    } else {
        codexInteractionMode = 'drag';
        networkLinkSourceId = null;
        updateCodexToolbar();
    }
}

function applyNodeScale(el, scale, skipRedraw) {
    const s = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(scale) || 1));
    el.dataset.codexScale = String(s);
    const junction = el.classList.contains('codex-node--junction');
    const simplified = el.classList.contains('codex-node--simplified');
    const basePx = junction ? CODEX_JUNCTION_BASE_PX : CODEX_IMG_BASE_PX;
    const px = basePx * s;
    if (junction) {
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
    } else if (simplified) {
        // Simplified DOM: scale the root element directly
        el.style.width = `${px}px`;
        el.style.height = `${px}px`;
        // Frame scales with parent via CSS inheritance
    } else {
        // Legacy nested DOM
        const inner = el.querySelector('.codex-node__inner');
        const frame = el.querySelector('.codex-node__frame');
        if (inner) {
            inner.style.width = `${px}px`;
            inner.style.height = `${px}px`;
        }
        if (frame) {
            frame.style.width = `${px}px`;
            frame.style.height = `${px}px`;
        }
    }
    /*
     * Mirror scale into codexAllNodes — serializeCodexLayoutSnapshot reads node.scale
     * from this model, NOT the DOM. Without this write, Save / Export ship the original
     * placement scale and resizes don't survive a round-trip.
     */
    const nodeId = el.dataset.codexNodeId;
    if (nodeId) {
        const nodeObj = codexAllNodes.find((n) => n && n.id === nodeId);
        if (nodeObj) nodeObj.scale = s;
    }
    if (!skipRedraw) redrawCodexEdges();
}

function nudgeSelectedNodeScale(factor) {
    const nodes = getSelectedCodexNodesInRoot();
    if (!nodes.length) return;
    nodes.forEach((nodeEl) => {
        const cur = parseFloat(nodeEl.dataset.codexScale) || 1;
        applyNodeScale(nodeEl, cur * factor, true);
        markNodeVisualUnsaved(nodeEl);
        markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
    });
    markCodexLayoutDirty();
    redrawCodexEdges();
}

/** @param {HTMLElement[]} nodes */
function getUniformCodexScaleForNodes(nodes) {
    if (!nodes.length) return null;
    const s0 = parseFloat(nodes[0].dataset.codexScale) || 1;
    for (let i = 1; i < nodes.length; i++) {
        const si = parseFloat(nodes[i].dataset.codexScale) || 1;
        if (Math.abs(si - s0) > 1e-4) return null;
    }
    return s0;
}

function formatCodexScaleForInput(s) {
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    const r = Math.round(n * 1000) / 1000;
    return String(r);
}

function setSelectedNodesAbsoluteScale(raw) {
    const s = Math.max(CODEX_SCALE_MIN, Math.min(CODEX_SCALE_MAX, Number(raw) || 1));
    const nodes = getSelectedCodexNodesInRoot();
    if (!nodes.length) return;
    nodes.forEach((nodeEl) => {
        applyNodeScale(nodeEl, s, true);
        markNodeVisualUnsaved(nodeEl);
        markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
    });
    markCodexLayoutDirty();
    redrawCodexEdges();
}

function bindCodexToolbarScaleInput(input) {
    input.type = 'number';
    input.className = 'codex-toolbar__scale-input';
    input.step = '0.05';
    input.min = String(CODEX_SCALE_MIN);
    input.max = String(CODEX_SCALE_MAX);
    input.setAttribute('aria-label', 'Selected node scale');
    input.title = `Node scale ${CODEX_SCALE_MIN}–${CODEX_SCALE_MAX}. Same value for all selected nodes; empty if sizes differ.`;
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            input.blur();
        }
    });
    input.addEventListener('change', () => {
        if (!codexToolbarEl || input.disabled) return;
        const v = String(input.value || '').trim();
        if (v === '') {
            updateCodexToolbar();
            return;
        }
        setSelectedNodesAbsoluteScale(v);
        updateCodexToolbar();
    });
}

function ensureCodexToolbarSelectAllRow(bar) {
    if (!bar || bar.querySelector('.codex-toolbar__select-all')) return;
    const row = document.createElement('div');
    row.className = 'codex-toolbar__row codex-toolbar__row--select-all';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-toolbar__select-all';
    btn.textContent = 'Select all';
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        selectAllCodexNodes();
    });
    row.appendChild(btn);
    const netHint = bar.querySelector('.codex-toolbar__network-hint');
    if (netHint) {
        bar.insertBefore(row, netHint);
    } else {
        const rowScale = bar.querySelector('.codex-toolbar__row--scale');
        if (rowScale) bar.insertBefore(row, rowScale);
        else bar.appendChild(row);
    }
}

function ensureCodexToolbarDeleteSelectedButton(bar) {
    if (!bar) return;
    const row = bar.querySelector('.codex-toolbar__row--select-all');
    if (!row || row.querySelector('.codex-toolbar__delete-selected')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-toolbar__delete-selected';
    btn.textContent = 'Delete selected';
    btn.title = 'Remove selected nodes from the board (Dev mode).';
    btn.disabled = true;
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        deleteCodexToolbarSelectedNodes();
    });
    row.appendChild(btn);
}

function ensureCodexToolbarScaleInput(bar) {
    const row = bar?.querySelector('.codex-toolbar__shrink')?.parentElement;
    if (!row || row.querySelector('.codex-toolbar__scale-input')) return;
    const input = document.createElement('input');
    bindCodexToolbarScaleInput(input);
    const grow = row.querySelector('.codex-toolbar__grow');
    if (grow) {
        row.insertBefore(input, grow);
    } else {
        row.appendChild(input);
    }
}

function removeEdgesTouchingNodeId(nodeId) {
    codexEdges.forEach((e) => {
        if (e.fromId === nodeId || e.toId === nodeId) {
            codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    });
    const next = codexEdges.filter((e) => e.fromId !== nodeId && e.toId !== nodeId);
    if (next.length !== codexEdges.length) {
        codexEdges = next;
        redrawCodexEdges();
    }
}

function removeEdgesTouchingNodeIds(nodeIds) {
    const idSet = new Set((nodeIds || []).filter(Boolean));
    if (!idSet.size) return;
    codexEdges.forEach((e) => {
        if (idSet.has(e.fromId) || idSet.has(e.toId)) {
            codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    });
    const next = codexEdges.filter((e) => !idSet.has(e.fromId) && !idSet.has(e.toId));
    if (next.length !== codexEdges.length) {
        codexEdges = next;
        redrawCodexEdges();
    }
}

function codexNodeKindById(id) {
    const n = codexAllNodes.find((x) => x.id === id);
    return n && n.kind ? n.kind : null;
}

/**
 * A junction in `deleteSet` whose every incoming edge starts outside `deleteSet` (or has no incoming).
 * Splicing those first preserves chains like A→J1→J2→B when deleting {J1,J2}.
 */
function pickJunctionReadyToSpliceAmongDeleteSet(deleteSet) {
    for (const id of deleteSet) {
        if (codexNodeKindById(id) !== 'junction') continue;
        const incoming = codexEdges.filter((e) => e.toId === id);
        const outgoing = codexEdges.filter((e) => e.fromId === id);
        if (!incoming.length && !outgoing.length) continue;
        const predsOk = incoming.length === 0 || incoming.every((e) => !deleteSet.has(e.fromId));
        if (predsOk) return id;
    }
    return null;
}

/**
 * Splice one junction out: for each X→J and J→Y, add X→Y unless an endpoint is in `removedIds` (except J itself).
 * Then removes all edges incident to J. Does not redraw.
 * @param {string} junctionId
 * @param {Set<string>} removedIds - full delete batch (other deleted junctions may appear as bridge endpoints until spliced).
 */
function removeJunctionAndBridgeEdges(junctionId, removedIds) {
    if (!junctionId) return;
    const skip = new Set(removedIds instanceof Set ? removedIds : [removedIds]);
    skip.delete(junctionId);
    const incoming = codexEdges.filter((e) => e.toId === junctionId);
    const outgoing = codexEdges.filter((e) => e.fromId === junctionId);
    for (const e of [...incoming, ...outgoing]) {
        codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        cordDoubleRightLastTs.delete(codexUnorderedPairKey(e.fromId, e.toId));
        const pk = codexUnorderedPairKey(e.fromId, e.toId);
        if (cordPendingDeletePairKey === pk) cordPendingDeletePairKey = null;
    }
    codexEdges = codexEdges.filter((e) => e.fromId !== junctionId && e.toId !== junctionId);
    for (const ein of incoming) {
        for (const eout of outgoing) {
            const fromId = ein.fromId;
            const toId = eout.toId;
            if (fromId === junctionId || toId === junctionId) continue;
            if (fromId === toId) continue;
            if (skip.has(fromId) || skip.has(toId)) continue;
            addDirectedCodexEdge(fromId, toId);
        }
    }
}

/**
 * Removes edges for nodes in `ids`. Junctions are spliced in dependency order so cords reconnect
 * (e.g. A→J1→J2→B with both breaks deleted becomes A→B). Non-junction deletes unchanged.
 * @param {string[]} ids
 */
function removeEdgesForDeletedNodesWithJunctionBridging(ids) {
    const idSet = new Set((ids || []).filter(Boolean));
    if (!idSet.size) return;
    const safety = idSet.size + codexEdges.length + 8;
    let guard = 0;
    while (guard++ < safety) {
        const j = pickJunctionReadyToSpliceAmongDeleteSet(idSet);
        if (!j) break;
        removeJunctionAndBridgeEdges(j, idSet);
    }
    removeEdgesTouchingNodeIds([...idSet]);
}

function edgeCordIsActivelyUpdating(edge) {
    if (codexActiveDragNodeIds.size > 0) {
        if (codexActiveDragNodeIds.has(edge.fromId) || codexActiveDragNodeIds.has(edge.toId)) {
            return true;
        }
    }
    return false;
}

function edgeCordShowsYellow(edge) {
    return (
        codexUnsavedEdgeKeys.has(edgeDirectedKey(edge.fromId, edge.toId))
        || edgeCordIsActivelyUpdating(edge)
    );
}

function appendCodexEdgeNodeMask(defs, ns, vw, vh, maskWorldRect = null) {
    appendCodexEdgeNodeMaskCore(defs, ns, vw, vh, maskWorldRect, {
        getRoot: () => root,
        getDebugUiVisible: () => codexDebugUiVisible,
        maskId: CODEX_EDGES_NODE_ALPHA_MASK_ID
    });
}

function codexEffectivePacketStrokeRange() {
    const base = codexVisualPrefs.cordThickness * codexVisualPrefs.packetThicknessMult;
    return { min: base * 0.97, max: base * 1.03 };
}

function loadCodexVisualPrefs() {
    try {
        const raw = JSON.parse(localStorage.getItem(CODEX_VISUAL_PREFS_KEY) || 'null');
        codexVisualPrefs = normalizeCodexVisualPrefs(raw);
    } catch (_) {
        codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };
    }
}

function persistCodexVisualPrefs() {
    try {
        localStorage.setItem(CODEX_VISUAL_PREFS_KEY, JSON.stringify(codexVisualPrefs));
    } catch (_) {
        /* ignore */
    }
}

/**
 * Random forward continuation after the first hop `fromId → toId`: walk through junction waypoints,
 * picking a random outgoing edge at each split (never immediately back to `prev`).
 * Stops at the first hero/faction (non-junction) node.
 * @returns {string[]}
 */
function samplePacketTailNodeIds(fromId, toId) {
    if (!codexNodeIsJunctionWaypoint(toId)) return [];
    const tail = [];
    let cur = toId;
    let prev = fromId;
    while (codexNodeIsJunctionWaypoint(cur)) {
        const outs = codexEdges.filter((e) => e.fromId === cur && e.toId !== prev);
        if (outs.length === 0) break;
        const pick = outs[Math.floor(Math.random() * outs.length)];
        tail.push(pick.toId);
        prev = cur;
        cur = pick.toId;
    }
    return tail;
}

/**
 * @param {string} fromId
 * @param {string} toId
 * @param {string[]} tailNodeIds
 * @returns {{ x: number, y: number }[]|null}
 */
function tryBuildPacketWorldPoints(fromId, toId, tailNodeIds) {
    const ids = [fromId, toId, ...tailNodeIds];
    const pts = [];
    for (let i = 0; i < ids.length; i++) {
        const el = codexNodeElById(ids[i]);
        if (!el) return null;
        pts.push(getNodeCenterWorldPx(el));
    }
    for (let i = 0; i < ids.length - 1; i++) {
        if (!findEdge(ids[i], ids[i + 1])) return null;
    }
    return pts;
}

/** Skip full paint for far-off nodes when the board is large (paired with CSS `content-visibility`). */
/** @param {NodeListOf<Element>|Element[]|undefined} [nodeList] */
function syncCodexNodeOffscreenContentVisibility(visibleRect, nodeList) {
    if (!root) return;
    if (!visibleRect || codexActiveDragNodeIds.size > 0) {
        root.querySelectorAll('.codex-node--cv-offscreen').forEach((el) => {
            el.classList.remove('codex-node--cv-offscreen');
        });
        return;
    }
    const list = nodeList || root.querySelectorAll('.codex-node');
    list.forEach((el) => {
        if (nodeFrameIntersectsRect(el, visibleRect)) el.classList.remove('codex-node--cv-offscreen');
        else el.classList.add('codex-node--cv-offscreen');
    });
}

/** World rect for which nodes should stay "visually on"; cheap O(n) — safe to call while panning (no SVG rebuild).
 *  Skips work during any drag operations for performance.
 */
/** @param {NodeListOf<Element>|Element[]|undefined} [nodeList] */
function syncCodexNodeDomCullFromView(nodeList) {
    if (!root) return;
    /* Performance: skip during any drag/pan operations */
    if (codexActiveDragNodeIds.size > 0 || backgroundPanPointerId != null) return;
    const list = nodeList || root.querySelectorAll('.codex-node');
    const nodeCount = list.length;
    const use = nodeCount >= CODEX_NODE_DOM_CULL_MIN_NODES;
    const rect = use
        ? getCodexVisibleWorldBoundsExpanded(CODEX_EDGE_CULL_MARGIN_PX + CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX)
        : null;
    syncCodexNodeOffscreenContentVisibility(rect, list);
}

/** @type {boolean} Track if View Mode has done its initial edge render */
let codexViewModeInitialRenderDone = false;

/** Check if a Codex node matches the active filters */
function codexNodeMatchesFilters(nodeEl) {
    const activeFilters = getStandaloneActiveFiltersSet();
    if (!activeFilters || activeFilters.size === 0) {
        return true; // No filters active, all nodes match
    }
    
    const kind = nodeEl.dataset.codexKind;
    const hero = nodeEl.dataset.codexHero || '';
    const npc = nodeEl.dataset.codexNpc || '';
    const faction = nodeEl.dataset.codexFactionFile || '';
    const country = nodeEl.dataset.codexCountryKey || '';
    
    // Junction nodes (break points) are never filtered out
    if (kind === 'junction') {
        return true;
    }
    
    // Special case: Numbani country node matches if Efi, Adawe, or Orisa are selected
    if (kind === 'country' && country.toLowerCase() === 'numbani') {
        const numbaniRelatedFilters = ['Efi', 'Adawe', 'Orisa'];
        for (const filter of activeFilters) {
            for (const related of numbaniRelatedFilters) {
                if (filter === related || filter === `hero:${related}` || filter === `npc:${related}`) {
                    return true;
                }
            }
        }
        // Numbani node doesn't match if none of the related filters are selected
        return false;
    }
    
    // Build filter keys for this node
    const nodeFilterKeys = new Set();
    if (kind === 'hero' && hero) {
        nodeFilterKeys.add(hero);
        nodeFilterKeys.add(`hero:${hero}`);
    } else if (kind === 'npc' && npc) {
        nodeFilterKeys.add(npc);
        nodeFilterKeys.add(`npc:${npc}`);
    } else if (kind === 'faction' && faction) {
        nodeFilterKeys.add(faction);
        nodeFilterKeys.add(`faction:${faction}`);
    } else if (kind === 'country' && country) {
        nodeFilterKeys.add(country);
        nodeFilterKeys.add(`country:${country}`);
    }
    
    // Check if any of the node's filter keys are in the active filters
    for (const filter of activeFilters) {
        if (nodeFilterKeys.has(filter)) {
            return true;
        }
    }
    
    return false;
}

/** Apply filter state to all Codex nodes */
function applyCodexFilterState() {
    if (!root) return;
    
    const nodes = root.querySelectorAll('.codex-node');
    console.log(`[Codex Filter] Applying filter state to ${nodes.length} nodes`);
    console.log(`[Codex Filter] Active filters:`, Array.from(getStandaloneActiveFiltersSet() || []));
    
    let matchCount = 0;
    let filteredCount = 0;
    
    nodes.forEach((nodeEl) => {
        const matches = codexNodeMatchesFilters(nodeEl);
        
        if (matches) {
            nodeEl.classList.remove('codex-node--filtered-out');
            nodeEl.classList.add('codex-node--filter-match');
            matchCount++;
        } else {
            nodeEl.classList.add('codex-node--filtered-out');
            nodeEl.classList.remove('codex-node--filter-match');
            filteredCount++;
        }
    });
    
    console.log(`[Codex Filter] Result: ${matchCount} matching, ${filteredCount} filtered out`);
}

// FilterService invokes this hook when filter chips change
if (typeof window !== 'undefined') {
    exposeApplyCodexFilterState(applyCodexFilterState);
}

function handleNetworkNodeActivate(el) {
    const id = el.dataset.codexNodeId;
    if (!id) return;

    if (!networkLinkSourceId) {
        networkLinkSourceId = id;
        selectCodexNode(el, { network: true });
        updateCodexToolbar();
        return;
    }
    if (networkLinkSourceId === id) {
        networkLinkSourceId = null;
        selectCodexNode(el, { network: true });
        updateCodexToolbar();
        return;
    }
    const fromId = networkLinkSourceId;
    const toId = id;
    networkLinkSourceId = null;

    let created = false;
    if (!hasCodexConnectionBetween(fromId, toId)) {
        codexEdges.push({ fromId, toId });
        markCodexEdgeUnsaved(fromId, toId);
        markCodexLayoutDirty();
        redrawCodexEdges();
        created = true;
    } else {
        updateAppStatus('Those Codex nodes are already linked.', 'warning');
    }

    const elFrom = codexNodeElById(fromId);
    const elTo = codexNodeElById(toId);
    if (created) {
        codexInteractionMode = 'drag';
        if (elFrom && elTo) {
            markNodeVisualUnsaved(elTo);
        }
    }
    selectCodexNodesPair(elFrom, elTo, elTo);
}

/**
 * Codex save payload (see {@link saveCodexLayout}, {@link CODEX_SAVE_VERSION}).
 * - `nodes[]`: `x`,`y` = top-left world px; `scale`; `id`; `kind` junction | hero | faction | country | npc.
 * - `edges[]`: directed `fromId`→`toId` (A→B). Cord centers use top-left + half width/height (+ drag transform if any).
 */
function serializeCodexState() {
    if (!root) return { nodes: [], edges: [] };
    return serializeCodexLayoutSnapshot(codexAllNodes, codexEdges);
}

export function saveCodexLayout() {
    if (!root) return;
    const { nodes, edges } = serializeCodexState();
    const payload = { v: CODEX_SAVE_VERSION, nodes, edges };
    try {
        localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('CodexCanvasService: localStorage save failed', e);
        return;
    }

    root.querySelectorAll('.codex-node--unsaved').forEach((el) => {
        el.classList.remove('codex-node--unsaved');
    });
    codexUnsavedEdgeKeys.clear();
    codexLayoutDirty = false;
    clearPendingCodexDeleteState();
    updateCodexToolbar();
    redrawCodexEdges();

    if (isCodexFileApiAvailable()) {
        const codexPost = resolveCodexRepoApiUrl('api/codex');
        fetch(codexPost, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then(async (data) => {
                let archList = Array.isArray(data?.bioArchiveFilesWritten)
                    ? data.bioArchiveFilesWritten.filter(Boolean)
                    : [];
                if (
                    !archList.length
                    && (Number(data?.bioConnectionsUpserted) > 0 || Number(data?.bioConnectionsRemoved) > 0)
                ) {
                    archList = ['heroes', 'factions', 'npcs'];
                }
                const ds = getEventTimelineDataService();
                if (archList.length && typeof ds?.refreshBioArchivesFromCodexDiskWrite === 'function') {
                    try {
                        const r = await ds.refreshBioArchivesFromCodexDiskWrite(archList);
                        const out = r?.updated && r.updated.length ? r.updated : archList;
                        dispatchBioArchivesRefreshed({ archives: out });
                    } catch (reErr) {
                        console.warn('CodexCanvasService: post-codex bio archive refresh failed', reErr);
                    }
                }
                try {
                    await syncCodexEdgesFromBioArchiveConnections();
                } catch (reconcileErr) {
                    console.warn('CodexCanvasService: post-save codex/archive edge reconcile failed', reconcileErr);
                }
                let msg = `✓ Codex saved (${data?.nodesCount ?? nodes.length} nodes, ${data?.edgesCount ?? edges.length} links)`;
                const nBio = Number(data?.bioConnectionsUpserted) || 0;
                const nRm = Number(data?.bioConnectionsRemoved) || 0;
                if (nBio > 0 || nRm > 0) {
                    const parts = [];
                    if (nBio > 0) parts.push(`${nBio} row(s) added/updated`);
                    if (nRm > 0) parts.push(`${nRm} stale “show in Codex” row(s) removed`);
                    msg += `. Archive JSON: ${parts.join('; ')}.`;
                }
                const warns = Array.isArray(data?.bioArchiveWarnings) ? data.bioArchiveWarnings : [];
                if (warns.length) {
                    msg += ` (${warns.slice(0, 2).join(' ')}${warns.length > 2 ? '…' : ''})`;
                }
                if (data?.bioArchiveError) {
                    msg += ` Bio archive sync error: ${data.bioArchiveError}`;
                }
                updateAppStatus(msg, data?.bioArchiveError ? 'warning' : 'success');
            })
            .catch((e) => {
                console.warn('CodexCanvasService: /api/codex write failed', e);
                updateAppStatus(
                    `Codex saved in browser; could not write data/codex-labels.json (${e?.message || 'API error'})`,
                    'warning'
                );
            });
    } else {
        updateAppStatus('Codex saved (this browser).', 'success');
    }
}

/** One saved node record → DOM (used by initial load and JSON import). */
function placeLoadedCodexNodeRecord(L) {
    if (!L || typeof L !== 'object') return;
    const placeKind =
        L.kind === 'junction'
            ? 'junction'
            : L.kind === 'faction'
                ? 'faction'
                : L.kind === 'country'
                    ? 'country'
                    : L.kind === 'npc'
                        ? 'npc'
                        : 'hero';
    const opts = {
        fromSaved: true,
        skipRedraw: true,
        skipLazyLoad: true, // Load images immediately for virtual scroll
        id: L.id,
        scale: resolveCodexNodeScale(placeKind, L.scale),
        bgColor: L.bgColor || null
    };
    if (L.kind === 'hero' && L.heroName) {
        placeCodexNode(L.x, L.y, 'hero', L.heroName, null, opts);
    } else if (L.kind === 'npc' && L.npcName) {
        placeCodexNode(L.x, L.y, 'npc', L.npcName, null, opts);
    } else if (L.kind === 'faction' && L.factionFilename) {
        placeCodexNode(L.x, L.y, 'faction', null, {
            filename: L.factionFilename,
            displayName: L.factionDisplay || L.factionFilename
        }, opts);
    } else if (L.kind === 'country' && normalizeCodexCountryKey(L.countryKey)) {
        placeCodexNode(L.x, L.y, 'country', null, null, {
            ...opts,
            countryKey: normalizeCodexCountryKey(L.countryKey)
        });
    } else if (L.kind === 'junction') {
        placeCodexNode(L.x, L.y, 'junction', null, null, opts);
    }
}

/** Chunked placement + optional status line (load overlay / large imports). */
async function placeCodexNodeRecordsInChunks(nodes) {
    const overlayLine = getCodexLoadingOverlayLineSetter();
    if (overlayLine && nodes.length) {
        overlayLine(`Placing ${nodes.length} nodes…`);
    }
    await yieldCodexBrowserPaint();

    const CODEX_LOAD_NODE_CHUNK = 22;
    for (let start = 0; start < nodes.length; start += CODEX_LOAD_NODE_CHUNK) {
        const end = Math.min(start + CODEX_LOAD_NODE_CHUNK, nodes.length);
        for (let i = start; i < end; i++) {
            placeLoadedCodexNodeRecord(nodes[i]);
        }
        if (overlayLine && nodes.length > CODEX_LOAD_NODE_CHUNK) {
            overlayLine(`Placing nodes… ${end} / ${nodes.length}`);
        }
        if (end < nodes.length) {
            await yieldBetweenCodexLoadChunks();
        }
    }
}

/** Frame world center in the Codex viewport (zoom must be set first). */
function centerCodexViewOnWorldCenter() {
    if (!root || !codexWorldEl) return;
    const rw = root.clientWidth || 1;
    const rh = root.clientHeight || 1;
    const pan = computeCodexPanForWorldCenter(rw, rh, codexViewZoom);
    codexViewPanX = pan.panX;
    codexViewPanY = pan.panY;
}

/** Frame the bounding box of all nodes using stored data (works with virtual scroll). */
function centerCodexViewOnNodes() {
    if (!root) return;
    const nodes = codexAllNodes;
    if (!nodes?.length) return;
    const rw = root.clientWidth || 1;
    const rh = root.clientHeight || 1;
    const pan = computeCodexPanForNodeBounds(nodes, rw, rh, codexViewZoom);
    if (!pan) return;
    codexViewPanX = pan.panX;
    codexViewPanY = pan.panY;
}

/** Yield so the loading overlay can paint before large DOM batches (see CodexModeService). */
function yieldCodexBrowserPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 0);
            });
        });
    });
}

/** Between load chunks: prefer idle time so the main thread can paint / handle input. */
function yieldBetweenCodexLoadChunks() {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve(), { timeout: 120 });
        } else {
            requestAnimationFrame(resolve);
        }
    });
}

async function loadCodexState() {
    if (!root) return;

    let sourceObj = null;
    let loadedFromCanonical = false;

    const canonical = await fetchCanonicalCodexJson();
    if (canonical.ok) {
        sourceObj = canonical.data;
        loadedFromCanonical = true;
    } else {
        // Use Web Worker to parse JSON without blocking main thread
        try {
            const raw = localStorage.getItem(CODEX_STORAGE_KEY);
            if (raw) {
                const result = await parseCodexJsonInWorker(raw);
                if (result.ok) {
                    sourceObj = result.data;
                }
            }
        } catch (_) {
            sourceObj = null;
        }
    }

    if (!sourceObj) {
        sourceObj = { v: CODEX_SAVE_VERSION, nodes: [], edges: [] };
    }

    const mirrorCanonicalToLocalStorage = () => {
        if (!loadedFromCanonical) return;
        try {
            const { nodes: nPersist, edges: ePersist } = serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
    };

    const { nodes, edges, migratedNow } = parseMigrateAndDedupeCodexSource(sourceObj);
    codexEdges = edges;
    codexUnsavedEdgeKeys.clear();
    codexViewZoom = CODEX_ZOOM_INITIAL;
    
    // Store all nodes for virtual scrolling
    codexAllNodes = nodes || [];
    // Clear previously rendered nodes
    clearCodexVirtualScroll();
    
    // Reset View Mode initial render flag when loading new layout
    codexViewModeInitialRenderDone = false;
    
    if (!nodes.length) {
        centerCodexViewOnWorldCenter();
        applyCodexWorldTransformStyle();
        redrawCodexEdges();
        codexLayoutDirty = false;
        updateCodexToolbar();
        mirrorCanonicalToLocalStorage();
        return;
    }

    // Center view on all nodes FIRST (using data, not DOM elements)
    centerCodexViewOnNodes();
    applyCodexWorldTransformStyle();

    // Skip ALL edge redraws during initial load for performance (O(n²) otherwise)
    codexSkipAllEdgeRedraws = true;
    codexSkipEdgeRedraw = true;

    // Then render visible nodes via virtual scroll
    updateCodexVirtualScroll();

    // Re-enable edge redraws and do one final redraw
    codexSkipAllEdgeRedraws = false;
    codexSkipEdgeRedraw = false;
    
    // In View Mode, force a redraw after nodes are loaded
    if (codexMode === 'view') {
        codexViewModeInitialRenderDone = false;
        redrawCodexEdges();
    } else {
        scheduleRedrawCodexEdges();
    }

    // Failsafe: if no nodes rendered after initial load, render all nodes
    if (codexRenderedNodeIds.size === 0 && nodes.length > 0) {
        codexSkipAllEdgeRedraws = true;
        codexSkipEdgeRedraw = true;
        for (const node of nodes) {
            placeLoadedCodexNodeRecord(node);
            codexRenderedNodeIds.add(node.id);
        }
        // Don't reset flags or schedule redraw here - let the main redraw handle it
    }

    if (migratedNow) {
        try {
            const { nodes: nPersist, edges: ePersist } = serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
        if (loadedFromCanonical) {
            markCodexLayoutDirty();
        }
    }

    // Redraw already scheduled by scheduleRedrawCodexEdges() above
    if (!migratedNow) {
        codexLayoutDirty = false;
    }
    updateCodexToolbar();
    mirrorCanonicalToLocalStorage();
    void syncCodexEdgesFromBioArchiveConnections();
}

function stripCodexBoardForFullReplace() {
    if (!root) return;
    removePicker();
    networkLinkSourceId = null;
    cancelPointerPending();
    cancelBackgroundPanPointerPending();
    selectCodexNode(null);
    codexBulkNodeDeleteArmedAt = 0;
    const world = codexWorldEl || root;
    world.querySelectorAll('.codex-node').forEach((n) => n.remove());
    stopCordAnimAndClearCordPacketState();
}

/**
 * Replace the board from user JSON (GitHub Pages backup / restore). Same shape as `src/data/codex-labels.json`.
 * @param {string} jsonText
 * @param {{ skipConfirm?: boolean }} [opts]
 */
async function importCodexLayoutFromJsonText(jsonText, opts = {}) {
    if (!root) return;
    if (!opts.skipConfirm) {
        const ok = userConfirms(
            'Replace the entire Codex with this file? All current nodes and links on the board will be removed.'
        );
        if (!ok) return;
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (_) {
        updateAppStatus('Codex import: file is not valid JSON.', 'error');
        return;
    }

    const { nodes, edges, migratedNow } = parseMigrateAndDedupeCodexSource(parsed);
    stripCodexBoardForFullReplace();
    codexEdges = edges;
    codexUnsavedEdgeKeys.clear();
    cordDoubleRightLastTs.clear();
    codexNodeDeleteLastRightTs.clear();
    clearPendingCodexDeleteState();
    /*
     * Set the in-memory model BEFORE placing DOM nodes — placeLoadedCodexNodeRecord calls
     * placeCodexNode with fromSaved:true, which does not push into codexAllNodes (only new
     * user-placed nodes do). Without this, save serializes 0 nodes + N edges and the board
     * disappears on next reload (centerCodexViewOnNodes also early-returns on empty model).
     */
    codexAllNodes = nodes || [];
    clearCodexVirtualScroll();
    codexViewZoom = CODEX_ZOOM_INITIAL;
    if (!nodes.length) {
        centerCodexViewOnWorldCenter();
    } else {
        codexViewPanX = 0;
        codexViewPanY = 0;
    }
    applyCodexWorldTransformStyle();

    if (!nodes.length) {
        redrawCodexEdges();
        markCodexLayoutDirty();
        try {
            const { nodes: nPersist, edges: ePersist } = serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
        /*
         * Verbatim import: do NOT run syncCodexEdgesFromBioArchiveConnections here.
         * The bio reconcile runs automatically after a successful Save Codex (saveCodexLayout
         * line ~2195), so the imported state lands first and reconciliation is applied
         * against the new, persisted layout.
         */
        updateCodexToolbar();
        updateAppStatus('Codex import: board cleared (empty layout). Save Codex to persist and reconcile with archives.', 'success');
        return;
    }

    await placeCodexNodeRecordsInChunks(nodes);
    /*
     * placeCodexNode(fromSaved) doesn't add to codexRenderedNodeIds — populate explicitly so
     * the next updateCodexVirtualScroll doesn't try to place duplicate DOM elements. Mirrors
     * the failsafe loop in loadCodexState.
     */
    for (const n of nodes) {
        if (n && n.id) codexRenderedNodeIds.add(n.id);
    }
    centerCodexViewOnNodes();
    applyCodexWorldTransformStyle();
    syncCodexNodeDomCullFromView();
    requestAnimationFrame(() => redrawCodexEdges());
    markCodexLayoutDirty();
    try {
        const { nodes: nPersist, edges: ePersist } = serializeCodexState();
        localStorage.setItem(
            CODEX_STORAGE_KEY,
            JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
        );
    } catch (_) {
        /* ignore */
    }
    if (migratedNow) {
        updateAppStatus(
            'Codex import: layout was upgraded from an older format — use Save Codex to persist (archives reconcile after save).',
            'info'
        );
    } else {
        updateAppStatus(
            `Codex import: ${nodes.length} nodes, ${codexEdges.length} links (verbatim). Use Save Codex to persist; archive reconciliation runs after save.`,
            'success'
        );
    }
    /*
     * Verbatim import: skip bio-sync here. The reconciler runs automatically after a
     * successful Save Codex (saveCodexLayout, see post-write hook), so the imported
     * state — including any direct entity-to-entity cords from another user's export
     * that aren't in the local archives — survives until the user explicitly saves.
     * After save, the status line reports any reconcile changes ("removed N orphan
     * link(s); added M from archives") and the user can Save again to commit them.
     */
    updateCodexToolbar();
}

function exportCodexLayoutJsonDownload() {
    if (!root) return;
    const snap = serializeCodexState();
    const text = stringifyCodexLayoutJson(CODEX_SAVE_VERSION, snap);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadTextFileAsJson(text, `codex-layout-${stamp}.json`);
    updateAppStatus(`Codex export: ${snap.nodes.length} nodes, ${snap.edges.length} links.`, 'success');
}

function applyCodexWorldTransformStyle() {
    if (!codexWorldEl) return;
    codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, codexViewZoom));
    codexWorldEl.style.transform = `translate(${codexViewPanX}px, ${codexViewPanY}px) scale(${codexViewZoom})`;
}

let codexZoomDebounceTimer = null;

function applyCodexViewTransform() {
    applyCodexWorldTransformStyle();
    // Skip edge redraws during virtual scroll to prevent freeze (same as pan)
    codexSkipAllEdgeRedraws = true;
    codexSkipEdgeRedraw = true; // Also skip the internal redraw from updateCodexVirtualScroll
    scheduleUpdateCodexVirtualScroll();
    clearCodexEdgeRedrawSchedule();
    // Debounce the final redraw to prevent multiple rapid calls during zoom
    if (codexZoomDebounceTimer) {
        clearTimeout(codexZoomDebounceTimer);
    }
    codexZoomDebounceTimer = setTimeout(() => {
        codexSkipAllEdgeRedraws = false;
        codexSkipEdgeRedraw = false; // Reset before calling redrawCodexEdges
        redrawCodexEdges(); // Call directly to bypass RAF throttling
        codexZoomDebounceTimer = null;
    }, 200);
}

/** Keep world point under (clientX, clientY) fixed while changing zoom (wheel / pinch / buttons). */
function applyCodexZoomWithAnchor(clientX, clientY, newZoom) {
    if (!root) return;
    const rr = root.getBoundingClientRect();
    const s = getCodexBodyLayoutPerViewportPx();
    const oldZoom = codexViewZoom;
    const lx = (clientX - rr.left) / s;
    const ly = (clientY - rr.top) / s;
    const w = clientToWorldCodex(clientX, clientY);
    codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, newZoom));
    codexViewPanX = lx - w.x * codexViewZoom;
    codexViewPanY = ly - w.y * codexViewZoom;
    applyCodexViewTransform();
    // Update virtual scroll if zoom changed significantly (>10%)
    if (Math.abs(codexViewZoom - oldZoom) / oldZoom > 0.1) {
        scheduleUpdateCodexVirtualScroll();
    }
}

function codexZoomByFactorAt(factor, clientX, clientY) {
    if (!root) return;
    applyCodexZoomWithAnchor(clientX, clientY, codexViewZoom * factor);
}

function getCodexViewCenterClient() {
    if (!root) return { cx: 0, cy: 0 };
    const rr = root.getBoundingClientRect();
    return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2 };
}

function codexZoomInFromUi() {
    const { cx, cy } = getCodexViewCenterClient();
    codexZoomByFactorAt(CODEX_ZOOM_FACTOR, cx, cy);
}

function codexZoomOutFromUi() {
    const { cx, cy } = getCodexViewCenterClient();
    codexZoomByFactorAt(1 / CODEX_ZOOM_FACTOR, cx, cy);
}

function codexWheelShouldDeferToScroll(e) {
    const t = e.target;
    if (t && typeof t.closest === 'function') {
        if (t.closest('.codex-picker') || t.closest('.filter-autocomplete-list')) return true;
    }
    return false;
}

function detachCodexViewGestures() {
    const r = root;
    if (r && onCodexWheelHandler) {
        r.removeEventListener('wheel', onCodexWheelHandler);
    }
    onCodexWheelHandler = null;
    if (r && onCodexTouchStartHandler) {
        r.removeEventListener('touchstart', onCodexTouchStartHandler, true);
    }
    if (r && onCodexTouchMoveHandler) {
        r.removeEventListener('touchmove', onCodexTouchMoveHandler, true);
    }
    if (r && onCodexTouchEndHandler) {
        r.removeEventListener('touchend', onCodexTouchEndHandler, true);
        r.removeEventListener('touchcancel', onCodexTouchEndHandler, true);
    }
    onCodexTouchStartHandler = null;
    onCodexTouchMoveHandler = null;
    onCodexTouchEndHandler = null;
    codexPinchState = null;
}

function attachCodexViewGestures() {
    if (!root) return;
    detachCodexViewGestures();

    onCodexWheelHandler = (e) => {
        if (!root) return;
        if (codexWheelShouldDeferToScroll(e)) return;
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0012);
        applyCodexZoomWithAnchor(e.clientX, e.clientY, codexViewZoom * factor);
    };
    root.addEventListener('wheel', onCodexWheelHandler, { passive: false });

    onCodexTouchStartHandler = (e) => {
        if (e.touches.length === 2) {
            const a = e.touches[0];
            const b = e.touches[1];
            const d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            if (d0 > 10) {
                codexPinchState = { d0, z0: codexViewZoom };
            }
        }
    };
    onCodexTouchMoveHandler = (e) => {
        if (e.touches.length !== 2 || !codexPinchState) return;
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        const d1 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = d1 / codexPinchState.d0;
        if (ratio <= 0 || !Number.isFinite(ratio)) return;
        applyCodexZoomWithAnchor(midX, midY, codexPinchState.z0 * ratio);
    };
    onCodexTouchEndHandler = (e) => {
        if (e.touches.length < 2) codexPinchState = null;
    };

    root.addEventListener('touchstart', onCodexTouchStartHandler, { passive: true, capture: true });
    root.addEventListener('touchmove', onCodexTouchMoveHandler, { passive: false, capture: true });
    root.addEventListener('touchend', onCodexTouchEndHandler, { passive: true, capture: true });
    root.addEventListener('touchcancel', onCodexTouchEndHandler, { passive: true, capture: true });
}

function codexResetView() {
    codexViewZoom = CODEX_ZOOM_INITIAL;
    if (root?.querySelector('.codex-node')) {
        centerCodexViewOnNodes();
    } else {
        centerCodexViewOnWorldCenter();
    }
    applyCodexViewTransform();
}

function ensureCodexWorld() {
    if (!root) return null;
    let w = root.querySelector('.codex-world');
    if (!w) {
        w = document.createElement('div');
        w.className = 'codex-world';
        root.insertBefore(w, root.firstChild);
    }
    codexWorldEl = w;
    w.style.width = `${CODEX_WORLD_W}px`;
    w.style.height = `${CODEX_WORLD_H}px`;
    applyCodexWorldTransformStyle();
    return w;
}

function ensureCodexBorderOverlay() {
    if (!root) return null;
    let border = root.querySelector('.codex-border-overlay');
    if (!border) {
        border = document.createElement('img');
        border.className = 'codex-border-overlay';
        border.src = 'src/assets/images/Misc/UI/Border.png';
        border.alt = '';
        border.style.position = 'absolute';
        border.style.top = '0';
        border.style.left = '0';
        border.style.width = '100%';
        border.style.height = '100%';
        border.style.pointerEvents = 'none';
        border.style.zIndex = '1';
        root.appendChild(border);
    }
    return border;
}

function ensureCodexModeToggle() {
    if (!root) return null;
    let modeBtn = root.querySelector('.codex-mode-toggle-btn');
    if (!modeBtn) {
        modeBtn = document.createElement('button');
        modeBtn.type = 'button';
        modeBtn.className = 'globe-control-btn codex-mode-toggle-btn';
        modeBtn.title = 'Toggle Dev Mode (edit) / View Mode (read-only)';
        
        const label = document.createElement('span');
        label.className = 'codex-mode-toggle-label';
        label.textContent = 'Dev Mode';
        
        modeBtn.appendChild(label);
        
        modeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            codexMode = codexMode === 'view' ? 'dev' : 'view';
            persistCodexModePref();
            syncCodexModeClass();
            
            // Update button state
            label.textContent = codexMode === 'dev' ? 'Dev Mode' : 'View Mode';
            
            // Play sound effect
            playSoundEffect('switchMap');

            // Flash effect (global helper when present; otherwise brief background pulse)
            if (typeof window !== 'undefined' && typeof window.flashButton === 'function') {
                flashUiButton(modeBtn);
            } else {
                modeBtn.style.transition = 'background-color 0.1s ease-out';
                const originalBg = modeBtn.style.backgroundColor;
                modeBtn.style.backgroundColor = 'rgba(255, 152, 0, 0.5)';
                setTimeout(() => {
                    modeBtn.style.backgroundColor = originalBg;
                }, 100);
            }
            
            updateCodexToolbar();
        });
        
        root.appendChild(modeBtn);
    }
    
    // Update initial state
    const label = modeBtn.querySelector('.codex-mode-toggle-label');
    if (label) {
        label.textContent = codexMode === 'dev' ? 'Dev Mode' : 'View Mode';
    }
    
    return modeBtn;
}

function cancelBackgroundPanPointerPending() {
    if (!backgroundPanPointerPending) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    backgroundPanPointerPending = null;
}

/** Left-button pan threshold → {@link beginActualBackgroundPan}; caller must cancel other pointer state first. */
function armCodexBackgroundPanPendingFromEvent(e) {
    if (e.button !== 0) return;
    backgroundPanPointerPending = {
        pointerId: e.pointerId,
        startCX: e.clientX,
        startCY: e.clientY,
        origPanX: codexViewPanX,
        origPanY: codexViewPanY
    };
    document.addEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.addEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.addEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
}

function onBackgroundPanMoveMaybe(ev) {
    const p = backgroundPanPointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    const dx = ev.clientX - p.startCX;
    const dy = ev.clientY - p.startCY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    const prep = backgroundPanPointerPending;
    backgroundPanPointerPending = null;
    beginActualBackgroundPan(prep, ev);
}

function onBackgroundPanUpMaybe(ev) {
    const p = backgroundPanPointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    backgroundPanPointerPending = null;
    if (codexInteractionMode === 'network') {
        networkLinkSourceId = null;
        selectCodexNode(null);
        updateCodexToolbar();
    }
}

function beginActualBackgroundPan(prep, firstMoveEv) {
    if (!hitLayerEl) return;
    const { pointerId, startCX, startCY, origPanX, origPanY } = prep;
    backgroundPanPointerId = pointerId;
    try {
        hitLayerEl.setPointerCapture(pointerId);
    } catch (_) { /* ignore */ }

    /* Performance: enable GPU optimization for panning */
    if (codexWorldEl) codexWorldEl.classList.add('codex-world--panning');

    const layoutPerVp = getCodexBodyLayoutPerViewportPx();
    const applyClient = (clientX, clientY) => {
        codexViewPanX = origPanX + (clientX - startCX) / layoutPerVp;
        codexViewPanY = origPanY + (clientY - startCY) / layoutPerVp;
        /* Cords live under .codex-world; pan is CSS translate only — no full SVG rebuild per move. */
        applyCodexWorldTransformStyle();
        /* Skip expensive DOM culling during pan - only run after pan ends */
        // Set skip flags during pan to prevent edge redraws
        codexSkipAllEdgeRedraws = true;
        codexSkipEdgeRedraw = true;
        // Cancel any pending debounce timer
        if (codexZoomDebounceTimer) {
            clearTimeout(codexZoomDebounceTimer);
        }
        // Schedule debounced redraw after pan completes (skip in View Mode)
        if (codexMode !== 'view') {
            codexZoomDebounceTimer = setTimeout(() => {
                codexSkipAllEdgeRedraws = false;
                codexSkipEdgeRedraw = false;
                redrawCodexEdges();
                codexZoomDebounceTimer = null;
            }, 200);
        }
    };

    applyClient(firstMoveEv.clientX, firstMoveEv.clientY);

    const rawOpts = { capture: true, passive: true };
    const usePointerRawUpdate = typeof window !== 'undefined'
        && typeof PointerEvent !== 'undefined'
        && 'onpointerrawupdate' in window;
    const moveEvent = usePointerRawUpdate ? 'pointerrawupdate' : 'pointermove';

    let dragFinished = false;
    const finishDrag = () => {
        if (dragFinished) return;
        dragFinished = true;
        document.removeEventListener(moveEvent, onMove, usePointerRawUpdate ? rawOpts : capOpts);
        document.removeEventListener('pointerup', onUp, capOpts);
        document.removeEventListener('pointercancel', onUp, capOpts);
        hitLayerEl.removeEventListener('lostpointercapture', onLost);
        try {
            hitLayerEl.releasePointerCapture(pointerId);
        } catch (_) { /* ignore */ }
        if (hitLayerEl) hitLayerEl.style.cursor = '';
        /* Performance: cleanup GPU optimization, then sync visibility */
        if (codexWorldEl) codexWorldEl.classList.remove('codex-world--panning');
        backgroundPanPointerId = null;
        syncCodexNodeDomCullFromView();

        // Skip edge redraws during post-pan virtual scroll to prevent freeze
        codexSkipAllEdgeRedraws = true;
        codexSkipEdgeRedraw = true;
        scheduleUpdateCodexVirtualScroll();
        clearCodexEdgeRedrawSchedule();
        // Note: Debounce timer is already managed by applyClient during pan
    };

    const onMove = (ev) => {
        if (!root || ev.pointerId !== pointerId) return;
        const coalesced = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : null;
        if (coalesced && coalesced.length > 0) {
            const last = coalesced[coalesced.length - 1];
            applyClient(last.clientX, last.clientY);
        } else {
            applyClient(ev.clientX, ev.clientY);
        }
    };

    const onLost = () => {
        finishDrag();
    };

    const onUp = () => {
        finishDrag();
    };

    hitLayerEl.style.cursor = 'grabbing';
    hitLayerEl.addEventListener('lostpointercapture', onLost);
    document.addEventListener(moveEvent, onMove, usePointerRawUpdate ? rawOpts : capOpts);
    document.addEventListener('pointerup', onUp, capOpts);
    document.addEventListener('pointercancel', onUp, capOpts);
}

function onHitLayerBackgroundPanPointerDown(e) {
    if (e.button !== 0) return;
    if (!hitLayerEl || e.target !== hitLayerEl) return;
    cancelBackgroundPanPointerPending();
    cancelPointerPending();
    clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

    // In View Mode, deselect nodes when clicking background
    if (codexMode === 'view') {
        selectCodexNode(null);
    }

    armCodexBackgroundPanPendingFromEvent(e);
}

function ensureEdgesLayer() {
    if (!root || !hitLayerEl) return null;
    const scope = codexWorldEl || root;
    let svg = scope.querySelector('.codex-edges-layer');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('codex-edges-layer');
        svg.setAttribute('aria-hidden', 'true');
        hitLayerEl.insertAdjacentElement('afterend', svg);
    }
    codexEdgesSvgEl = svg;
    return svg;
}

function ensureCodexToolbarSelectionPreviewRow(bar) {
    if (!bar) return;
    let rowPreview = bar.querySelector('.codex-toolbar__row--selection-preview');
    const netHint = bar.querySelector('.codex-toolbar__network-hint');
    if (!rowPreview) {
        rowPreview = document.createElement('div');
        rowPreview.className = 'codex-toolbar__row codex-toolbar__row--selection-preview';
        rowPreview.style.display = 'none';
        if (netHint) {
            bar.insertBefore(rowPreview, netHint);
        } else {
            bar.appendChild(rowPreview);
        }
    }
    const dualPre = rowPreview.querySelector('.codex-toolbar__endpoint-preview-dual');
    if (dualPre) {
        if (!dualPre.querySelector('.codex-toolbar__insert-break')) {
            const rev = dualPre.querySelector('.codex-toolbar__edge-reverse');
            if (rev) {
                const btnIns = document.createElement('button');
                btnIns.type = 'button';
                btnIns.className = 'codex-toolbar__insert-break';
                btnIns.textContent = '+';
                btnIns.setAttribute('aria-label', 'Insert break node between A and B');
                btnIns.title =
                    'Insert break (waypoint): A → break → B — replaces the current link if one exists, or creates links in selection order (first → second).';
                btnIns.disabled = true;
                btnIns.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    insertCodexBreakBetweenSelectedPair();
                });
                rev.insertAdjacentElement('afterend', btnIns);
            }
        }
        if (!dualPre.querySelector('.codex-toolbar__merge-junctions')) {
            const ins = dualPre.querySelector('.codex-toolbar__insert-break');
            if (ins) {
                const btnM = document.createElement('button');
                btnM.type = 'button';
                btnM.className = 'codex-toolbar__merge-junctions';
                btnM.textContent = 'Merge';
                btnM.title =
                    'Merge two break nodes into one at the primary selection position (Dev mode, two junctions).';
                btnM.disabled = true;
                btnM.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    mergeCodexSelectedJunctionPair();
                });
                ins.insertAdjacentElement('afterend', btnM);
            }
        }
        return;
    }

    while (rowPreview.firstChild) rowPreview.removeChild(rowPreview.firstChild);

    const single = document.createElement('div');
    single.className = 'codex-toolbar__endpoint-preview-single';
    const singleThumb = document.createElement('div');
    singleThumb.className = 'codex-toolbar__selection-preview-thumb';
    const imgSingle = document.createElement('img');
    imgSingle.className = 'codex-toolbar__selection-preview-img';
    imgSingle.draggable = false;
    imgSingle.alt = '';
    singleThumb.appendChild(imgSingle);
    single.appendChild(singleThumb);

    const dual = document.createElement('div');
    dual.className = 'codex-toolbar__endpoint-preview-dual';
    const wrapA = document.createElement('div');
    wrapA.className = 'codex-toolbar__selection-preview codex-toolbar__selection-preview--from';
    const lblA = document.createElement('span');
    lblA.className = 'codex-toolbar__endpoint-label';
    lblA.textContent = 'A';
    const thumbA = document.createElement('div');
    thumbA.className = 'codex-toolbar__selection-preview-thumb';
    const imgA = document.createElement('img');
    imgA.className = 'codex-toolbar__selection-preview-img';
    imgA.draggable = false;
    imgA.alt = '';
    thumbA.appendChild(imgA);
    wrapA.appendChild(lblA);
    wrapA.appendChild(thumbA);

    const btnRev = document.createElement('button');
    btnRev.type = 'button';
    btnRev.className = 'codex-toolbar__edge-reverse';
    btnRev.textContent = '⇄';
    btnRev.title = 'Reverse link direction (swap A and B; packets flow A → B)';
    btnRev.setAttribute('aria-label', 'Reverse link direction');
    btnRev.disabled = true;
    btnRev.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        reverseCodexEdgeForSelectedPair();
    });

    const btnInsertBreak = document.createElement('button');
    btnInsertBreak.type = 'button';
    btnInsertBreak.className = 'codex-toolbar__insert-break';
    btnInsertBreak.textContent = '+';
    btnInsertBreak.setAttribute('aria-label', 'Insert break node between A and B');
    btnInsertBreak.title =
        'Insert break (waypoint): A → break → B — replaces the current link if one exists, or creates links in selection order (first → second).';
    btnInsertBreak.disabled = true;
    btnInsertBreak.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        insertCodexBreakBetweenSelectedPair();
    });

    const btnMergeJunctions = document.createElement('button');
    btnMergeJunctions.type = 'button';
    btnMergeJunctions.className = 'codex-toolbar__merge-junctions';
    btnMergeJunctions.textContent = 'Merge';
    btnMergeJunctions.title =
        'Merge two break nodes into one at the primary selection position (Dev mode, two junctions).';
    btnMergeJunctions.disabled = true;
    btnMergeJunctions.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        mergeCodexSelectedJunctionPair();
    });

    const wrapB = document.createElement('div');
    wrapB.className = 'codex-toolbar__selection-preview codex-toolbar__selection-preview--to';
    const lblB = document.createElement('span');
    lblB.className = 'codex-toolbar__endpoint-label';
    lblB.textContent = 'B';
    const thumbB = document.createElement('div');
    thumbB.className = 'codex-toolbar__selection-preview-thumb';
    const imgB = document.createElement('img');
    imgB.className = 'codex-toolbar__selection-preview-img';
    imgB.draggable = false;
    imgB.alt = '';
    thumbB.appendChild(imgB);
    wrapB.appendChild(lblB);
    wrapB.appendChild(thumbB);

    dual.appendChild(wrapA);
    dual.appendChild(btnRev);
    dual.appendChild(btnInsertBreak);
    dual.appendChild(btnMergeJunctions);
    dual.appendChild(wrapB);
    rowPreview.appendChild(single);
    rowPreview.appendChild(dual);
}

function loadCodexDebugUiPref() {
    try {
        let raw = localStorage.getItem(CODEX_DEBUG_UI_PREF_KEY);
        if (raw == null) raw = localStorage.getItem(CODEX_DEBUG_UI_PREF_KEY_LEGACY);
        if (raw === '0') codexDebugUiVisible = false;
        else if (raw === '1') codexDebugUiVisible = true;
    } catch (_) {
        /* keep default */
    }
}

function loadCodexModePref() {
    try {
        const raw = localStorage.getItem(CODEX_MODE_PREF_KEY);
        if (raw === 'dev' || raw === 'view') {
            codexMode = raw;
        }
    } catch (_) {
        /* keep default (view) */
    }
}

function persistCodexDebugUiPref() {
    try {
        localStorage.setItem(CODEX_DEBUG_UI_PREF_KEY, codexDebugUiVisible ? '1' : '0');
    } catch (_) {
        /* ignore */
    }
}

function persistCodexModePref() {
    try {
        localStorage.setItem(CODEX_MODE_PREF_KEY, codexMode);
    } catch (_) {
        /* ignore */
    }
}

function syncCodexDebugUiClass() {
    if (!root) return;
    root.classList.toggle('codex--debug-ui-hidden', !codexDebugUiVisible);
}

function syncCodexModeClass() {
    if (!root) return;
    const oldMode = codexMode;
    root.classList.toggle('codex--view-mode', codexMode === 'view');
    root.classList.toggle('codex--dev-mode', codexMode === 'dev');

    if (codexMode !== 'view') {
        clearAllCodexEdgeHoverVisual();
    }

    console.log('[Codex Mode] Switching from ' + oldMode + ' to ' + codexMode);
    
    // Reset View Mode initial render flag when switching to View Mode
    // This allows the first natural redraw (when nodes are loaded) to execute
    if (codexMode === 'view') {
        codexViewModeInitialRenderDone = false;
        console.log('[Codex Mode] Reset View Mode initial render flag');
        // Trigger redraw to render edges in View Mode
        redrawCodexEdges();
    }
}

function ensureCodexToolbarDebugToggle(bar) {
    if (!bar) return;
    let row = bar.querySelector('.codex-toolbar__row--junction-pref');
    if (!row) {
        row = document.createElement('div');
        row.className = 'codex-toolbar__row codex-toolbar__row--junction-pref';
        const lbl = document.createElement('label');
        lbl.className = 'codex-toolbar__junction-pref-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'codex-toolbar__junction-toggle';
        cb.title =
            'Uncheck to hide waypoints, Break in the picker, cord angle labels, and node coordinates (layout unchanged)';
        cb.addEventListener('change', () => {
            codexDebugUiVisible = !!cb.checked;
            persistCodexDebugUiPref();
            syncCodexDebugUiClass();
            redrawCodexEdges();
        });
        lbl.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = 'Show Debugging';
        lbl.appendChild(span);
        row.appendChild(lbl);
        const scaleRow = bar.querySelector('.codex-toolbar__row--scale');
        if (scaleRow) bar.insertBefore(row, scaleRow);
        else bar.appendChild(row);
    }
    const cb = row.querySelector('.codex-toolbar__junction-toggle');
    if (cb) cb.checked = codexDebugUiVisible;
}

function ensureCodexToolbarModeToggle(bar) {
    if (!bar) return;
    let row = bar.querySelector('.codex-toolbar__row--mode-toggle');
    if (!row) {
        row = document.createElement('div');
        row.className = 'codex-toolbar__row codex-toolbar__row--mode-toggle';
        const lbl = document.createElement('label');
        lbl.className = 'codex-toolbar__mode-toggle-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'codex-toolbar__mode-toggle';
        cb.title = 'Check to enable Dev Mode (edit nodes, cords, layout). Uncheck for View Mode (read-only, pan/zoom only).';
        cb.addEventListener('change', () => {
            codexMode = cb.checked ? 'dev' : 'view';
            persistCodexModePref();
            syncCodexModeClass();
            updateCodexToolbar();
        });
        lbl.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = 'Dev Mode';
        lbl.appendChild(span);
        row.appendChild(lbl);
        const firstRow = bar.querySelector('.codex-toolbar__row');
        if (firstRow) bar.insertBefore(row, firstRow);
        else bar.appendChild(row);
    }
    const cb = row.querySelector('.codex-toolbar__mode-toggle');
    if (cb) cb.checked = codexMode === 'dev';
}

function codexVisualPanelQueryHost() {
    return codexVisualPanelEl && root && root.contains(codexVisualPanelEl)
        ? codexVisualPanelEl
        : root?.querySelector('.codex-visual-panel');
}

function readCodexVisualPrefsFromToolbar() {
    const host = codexVisualPanelQueryHost();
    if (!host) return;
    const next = { ...codexVisualPrefs };
    host.querySelectorAll('input[data-codex-vpref]').forEach((el) => {
        const key = el.dataset.codexVpref;
        if (!key || !(key in CODEX_VISUAL_DEFAULTS)) return;
        if (el.type === 'color') next[key] = el.value;
        else if (el.type === 'range') {
            const num = parseFloat(el.value);
            if (Number.isFinite(num)) next[key] = num;
        }
    });
    codexVisualPrefs = normalizeCodexVisualPrefs(next);
}

function syncCodexVisualToolbarFromPrefs() {
    const host = codexVisualPanelQueryHost();
    if (!host) return;
    host.querySelectorAll('input[data-codex-vpref]').forEach((el) => {
        const key = el.dataset.codexVpref;
        if (!key || !(key in codexVisualPrefs)) return;
        const v = codexVisualPrefs[key];
        if (el.type === 'color') el.value = v;
        else el.value = String(v);
        const wrap = el.parentElement;
        const valEl = wrap && wrap.querySelector('.codex-visual-panel__val');
        if (valEl) {
            valEl.textContent = typeof v === 'number'
                ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100))
                : String(v);
        }
    });
}

function ensureCodexVisualPrefsPanel() {
    if (!root) return;
    root.querySelectorAll('.codex-toolbar__visual-details').forEach((el) => el.remove());

    const onVisualInput = () => {
        readCodexVisualPrefsFromToolbar();
        persistCodexVisualPrefs();
        redrawCodexEdges();
    };

    function mkRow(labelText, controlWrap) {
        const row = document.createElement('div');
        row.className = 'codex-visual-panel__row';
        const lab = document.createElement('span');
        lab.className = 'codex-visual-panel__label';
        lab.textContent = labelText;
        row.appendChild(lab);
        row.appendChild(controlWrap);
        return row;
    }

    function mkRange(key, min, max, step) {
        const wrap = document.createElement('div');
        wrap.className = 'codex-visual-panel__inputwrap';
        const r = document.createElement('input');
        r.type = 'range';
        r.className = 'codex-visual-panel__range';
        r.min = String(min);
        r.max = String(max);
        r.step = String(step);
        r.dataset.codexVpref = key;
        r.addEventListener('input', onVisualInput);
        const val = document.createElement('span');
        val.className = 'codex-visual-panel__val';
        wrap.appendChild(r);
        wrap.appendChild(val);
        return mkRow(
            key === 'cordThickness' ? 'Thickness (px)'
                : key === 'cordBlur' ? 'Blur (σ)'
                    : key === 'cordMorph' ? 'Spread (dilate)'
                        : key === 'cordGlowLayers' ? 'Glow layers'
                            : key === 'packetThicknessMult' ? 'Thickness × cord'
                                : key === 'packetBlurMult' ? 'Blur × cord'
                                    : key === 'packetMorphMult' ? 'Spread × cord'
                                        : key === 'packetGlowLayers' ? 'Glow layers'
                                            : key === 'packetOpacity' ? 'Opacity'
                                                : key,
            wrap
        );
    }

    function mkColorRow(labelText, key) {
        const wrap = document.createElement('div');
        wrap.className = 'codex-visual-panel__inputwrap';
        const c = document.createElement('input');
        c.type = 'color';
        c.className = 'codex-visual-panel__color';
        c.dataset.codexVpref = key;
        c.addEventListener('input', onVisualInput);
        wrap.appendChild(c);
        return mkRow(labelText, wrap);
    }

    function section(title) {
        const h = document.createElement('div');
        h.className = 'codex-visual-panel__section';
        h.textContent = title;
        return h;
    }

    if (codexVisualPanelEl && root.contains(codexVisualPanelEl)) {
        syncCodexVisualToolbarFromPrefs();
        return;
    }

    const existing = root.querySelector('.codex-visual-panel');
    if (existing) {
        codexVisualPanelEl = existing;
        syncCodexVisualToolbarFromPrefs();
        return;
    }

    const panel = document.createElement('aside');
    panel.className = 'codex-visual-panel';
    panel.setAttribute('aria-label', 'Cord and packet appearance');

    const det = document.createElement('details');
    det.className = 'codex-visual-panel__details';
    det.open = true;
    const sum = document.createElement('summary');
    sum.className = 'codex-visual-panel__summary';
    sum.textContent = 'Cord & packet look (saved in this browser)';
    det.appendChild(sum);

    const body = document.createElement('div');
    body.className = 'codex-visual-panel__body';

    body.appendChild(section('Cords — normal links'));
    body.appendChild(mkColorRow('Color', 'cordColor'));
    body.appendChild(mkRange('cordThickness', 0.5, 12, 0.05));
    body.appendChild(mkRange('cordBlur', 0, 14, 0.25));
    body.appendChild(mkRange('cordMorph', 0, 4, 0.05));
    body.appendChild(mkRange('cordGlowLayers', 1, 6, 1));

    body.appendChild(section('Packets'));
    body.appendChild(mkColorRow('Idle color', 'packetColorIdle'));
    body.appendChild(mkColorRow('Active (drag) color', 'packetColorActive'));
    body.appendChild(mkRange('packetThicknessMult', 0.4, 3, 0.05));
    body.appendChild(mkRange('packetBlurMult', 0.25, 3, 0.05));
    body.appendChild(mkRange('packetMorphMult', 0.4, 3, 0.05));
    body.appendChild(mkRange('packetGlowLayers', 1, 6, 1));
    body.appendChild(mkRange('packetOpacity', 0.15, 1, 0.05));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codex-visual-panel__reset';
    btn.textContent = 'Reset look to defaults';
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        codexVisualPrefs = { ...CODEX_VISUAL_DEFAULTS };
        persistCodexVisualPrefs();
        syncCodexVisualToolbarFromPrefs();
        redrawCodexEdges();
    });
    body.appendChild(btn);

    det.appendChild(body);
    panel.appendChild(det);
    root.appendChild(panel);
    codexVisualPanelEl = panel;
    syncCodexVisualToolbarFromPrefs();
}

function ensureCodexToolbar() {
    if (!root) return;
    let bar = root.querySelector('.codex-toolbar');
    if (bar) {
        const shrinkLegacy = bar.querySelector('.codex-toolbar__shrink');
        if (shrinkLegacy) {
            const sr = shrinkLegacy.closest('.codex-toolbar__row');
            if (sr && !sr.classList.contains('codex-toolbar__row--scale')) {
                sr.classList.add('codex-toolbar__row--scale');
            }
        }
    }
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'codex-toolbar';

        const rowModes = document.createElement('div');
        rowModes.className = 'codex-toolbar__row';
        const btnDrag = document.createElement('button');
        btnDrag.type = 'button';
        btnDrag.className = 'codex-toolbar__mode-btn codex-toolbar__mode-drag';
        btnDrag.textContent = 'Drag mode';
        btnDrag.title = 'Move nodes by dragging. Caps Lock toggles network mode.';
        const btnNet = document.createElement('button');
        btnNet.type = 'button';
        btnNet.className = 'codex-toolbar__mode-btn codex-toolbar__mode-network';
        btnNet.textContent = 'Network mode';
        btnNet.title = 'Connect nodes: tap one, then another. Caps Lock toggles drag mode. Shift+click adds to selection in drag mode.';
        btnDrag.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            applyCodexToolbarInteractionMode('drag');
        });
        btnNet.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            applyCodexToolbarInteractionMode('network');
        });
        rowModes.appendChild(btnDrag);
        rowModes.appendChild(btnNet);

        const netHint = document.createElement('div');
        netHint.className = 'codex-toolbar__network-hint';
        netHint.style.display = 'none';

        const rowScale = document.createElement('div');
        rowScale.className = 'codex-toolbar__row codex-toolbar__row--scale';
        const shrink = document.createElement('button');
        shrink.type = 'button';
        shrink.className = 'codex-toolbar__scale-btn codex-toolbar__shrink';
        shrink.textContent = '−';
        shrink.title = 'Shrink selected node size (portrait hex). Header +/− zooms the whole board.';
        const grow = document.createElement('button');
        grow.type = 'button';
        grow.className = 'codex-toolbar__scale-btn codex-toolbar__grow';
        grow.textContent = '+';
        grow.title = 'Grow selected node size (portrait hex). Header +/− zooms the whole board.';
        shrink.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            nudgeSelectedNodeScale(1 / 1.12);
        });
        grow.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            nudgeSelectedNodeScale(1.12);
        });
        const scaleInput = document.createElement('input');
        bindCodexToolbarScaleInput(scaleInput);
        rowScale.appendChild(shrink);
        rowScale.appendChild(scaleInput);
        rowScale.appendChild(grow);

        const rowSave = document.createElement('div');
        rowSave.className = 'codex-toolbar__row codex-toolbar__row--footer';
        const hint = document.createElement('span');
        hint.className = 'codex-toolbar__hint';
        hint.textContent = 'Unsaved changes';
        hint.style.display = 'none';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'codex-toolbar__save';
        saveBtn.textContent = 'Save Codex';
        saveBtn.disabled = true;
        saveBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            saveCodexLayout();
        });
        rowSave.appendChild(hint);
        rowSave.appendChild(saveBtn);

        bar.appendChild(rowModes);
        bar.appendChild(netHint);
        bar.appendChild(rowScale);
        bar.appendChild(rowSave);
        root.appendChild(bar);
    }
    codexToolbarEl = bar;
    ensureCodexToolbarSelectAllRow(bar);
    ensureCodexToolbarDeleteSelectedButton(bar);
    ensureCodexToolbarSelectionPreviewRow(bar);
    ensureCodexToolbarScaleInput(bar);
    ensureCodexToolbarImportExportRow(bar);
    ensureCodexToolbarBioSyncButton(bar);
    ensureCodexVisualPrefsPanel();
    updateCodexToolbar();
}

function ensureCodexToolbarBioSyncButton(bar) {
    if (!bar) return;
    const row = bar.querySelector('.codex-toolbar__row--import-export');
    if (!row || row.querySelector('.codex-toolbar__bio-sync-preview')) return;
    const exportBtn = row.querySelector('.codex-toolbar__export-json');
    const bioBtn = document.createElement('button');
    bioBtn.type = 'button';
    bioBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__bio-sync-preview';
    bioBtn.textContent = 'Check vs archives';
    bioBtn.title =
        'Compare entity-to-entity Codex links with story-archive rows marked show in Codex. Save Codex to apply changes to JSON.';
    bioBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        void previewBioCodexArchiveLinkDiff();
    });
    if (exportBtn) {
        row.insertBefore(bioBtn, exportBtn);
    } else {
        row.appendChild(bioBtn);
    }
}

function ensureCodexToolbarImportExportRow(bar) {
    if (!bar || bar.querySelector('.codex-toolbar__row--import-export')) return;
    const row = document.createElement('div');
    row.className = 'codex-toolbar__row codex-toolbar__row--import-export';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__export-json';
    exportBtn.textContent = 'Export JSON';
    exportBtn.title = 'Download nodes and links as JSON (backup or share). Same format as data/codex-labels.json.';
    exportBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        exportCodexLayoutJsonDownload();
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.className = 'codex-toolbar__import-json-input';
    fileInput.setAttribute('aria-hidden', 'true');
    fileInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__import-json';
    importBtn.textContent = 'Import JSON';
    importBtn.title = 'Load nodes and links from a JSON file (replaces the current board).';
    importBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileInput.click();
    });

    const clearAllBtn = document.createElement('button');
    clearAllBtn.type = 'button';
    clearAllBtn.className = 'codex-toolbar__import-export-btn codex-toolbar__clear-all';
    clearAllBtn.textContent = 'Clear all';
    clearAllBtn.title =
        'Remove every node and link from the board. Save Codex afterwards to persist the empty board to data/codex-labels.json.';
    clearAllBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        clearAllCodexBoard();
    });

    // Add background color picker for selected node
    const colorLabel = document.createElement('label');
    colorLabel.className = 'codex-toolbar__bg-color-label';
    colorLabel.textContent = 'Node bg:';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'codex-toolbar__bg-color-input';
    colorInput.setAttribute('data-codex-bg-color-picker', 'true');
    colorInput.value = '#ffffff';
    colorInput.title = 'Background color for selected node';
    
    // Add text input for manual hex entry
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'codex-toolbar__bg-color-hex';
    hexInput.setAttribute('data-codex-bg-hex-input', 'true');
    hexInput.value = '#ffffff';
    hexInput.placeholder = '#ffffff';
    hexInput.maxLength = 7;
    hexInput.title = 'Paste hex color directly (e.g., #ff0000)';
    
    // Sync color picker to text input
    colorInput.addEventListener('input', (ev) => {
        const hexColor = ev.target.value;
        hexInput.value = hexColor;
        const selectedNode = codexPrimarySelectedNodeEl;
        if (selectedNode) {
            selectedNode.dataset.codexBgColor = hexColor;
            const bgEl = selectedNode.querySelector('.codex-node__bg');
            if (bgEl) {
                bgEl.style.background = hexToRgba(hexColor, 0.5);
            }
            // Sync to node object in codexAllNodes for save persistence
            const nodeId = selectedNode.dataset.codexNodeId;
            const nodeObj = codexAllNodes.find(n => n.id === nodeId);
            if (nodeObj) {
                nodeObj.bgColor = hexColor;
            }
            markCodexLayoutDirty();
            markNodeVisualUnsaved(selectedNode);
            updateCodexToolbar();
        }
    });
    
    // Sync text input to color picker
    hexInput.addEventListener('input', (ev) => {
        let hexColor = ev.target.value.trim();
        // Add # if missing
        if (hexColor && !hexColor.startsWith('#')) {
            hexColor = '#' + hexColor;
        }
        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
            colorInput.value = hexColor;
            const selectedNode = codexPrimarySelectedNodeEl;
            if (selectedNode) {
                selectedNode.dataset.codexBgColor = hexColor;
                const bgEl = selectedNode.querySelector('.codex-node__bg');
                if (bgEl) {
                    bgEl.style.background = hexToRgba(hexColor, 0.5);
                }
                // Sync to node object in codexAllNodes for save persistence
                const nodeId = selectedNode.dataset.codexNodeId;
                const nodeObj = codexAllNodes.find(n => n.id === nodeId);
                if (nodeObj) {
                    nodeObj.bgColor = hexColor;
                }
                markCodexLayoutDirty();
                markNodeVisualUnsaved(selectedNode);
                updateCodexToolbar();
            }
        }
    });

    fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            importCodexLayoutFromJsonText(text).catch((e) => {
                console.warn('Codex import failed', e);
                updateAppStatus('Codex import failed', 'error');
            });
        };
        reader.readAsText(f);
    });

    row.appendChild(exportBtn);
    row.appendChild(fileInput);
    row.appendChild(importBtn);
    row.appendChild(clearAllBtn);

    // Wrap color label + picker + hex input so the import/export row can wrap them
    // onto their own line under the four text buttons (CSS: flex-basis: 100%).
    const colorGroup = document.createElement('div');
    colorGroup.className = 'codex-toolbar__bg-color-group';
    colorGroup.appendChild(colorLabel);
    colorGroup.appendChild(colorInput);
    colorGroup.appendChild(hexInput);
    row.appendChild(colorGroup);

    const footer = bar.querySelector('.codex-toolbar__row--footer');
    if (footer) {
        bar.insertBefore(row, footer);
    } else {
        bar.appendChild(row);
    }
}

function ensureHitLayer() {
    if (!root) return null;
    const parent = codexWorldEl || root;
    let hit = parent.querySelector('.codex-hit-layer');
    if (!hit) {
        hit = document.createElement('div');
        hit.className = 'codex-hit-layer';
        hit.setAttribute('aria-hidden', 'true');
        parent.insertBefore(hit, parent.firstChild);
    }
    hitLayerEl = hit;
    return hitLayerEl;
}

/**
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} [anchorClientX] viewport — with anchorClientY, place picker under pointer (root-relative)
 * @param {number} [anchorClientY]
 */
function openPickerAtRootPoint(worldX, worldY, anchorClientX, anchorClientY) {
    removePicker();
    if (!root) return;

    pendingNodePos = { x: worldX, y: worldY };

    pickerEl = document.createElement('div');
    pickerEl.className = 'codex-picker';

    const maxW = 340;
    const estH = 56;
    const margin = 6;
    const usePointerAnchor =
        typeof anchorClientX === 'number'
        && typeof anchorClientY === 'number'
        && !Number.isNaN(anchorClientX)
        && !Number.isNaN(anchorClientY);

    const rr = root.getBoundingClientRect();
    const rw = root.clientWidth || rr.width || 0;
    const rh = root.clientHeight || rr.height || 0;

    if (usePointerAnchor) {
        /*
         * #codex-view-root lives under `body { transform: scale(--desktop-scale) }`. Viewport deltas must be
         * divided by that scale so `position:absolute` `left`/`top` match the pointer in layout space.
         */
        const layoutPerVp = getCodexBodyLayoutPerViewportPx();
        let pl = (anchorClientX - rr.left) / layoutPerVp;
        let pt = (anchorClientY - rr.top) / layoutPerVp;
        pl = Math.max(margin, Math.min(pl, Math.max(margin, rw - maxW - margin)));
        pt = Math.max(margin, Math.min(pt, Math.max(margin, rh - estH - margin)));
        pickerEl.style.position = 'absolute';
        pickerEl.style.left = `${pl}px`;
        pickerEl.style.top = `${pt}px`;
        pickerEl.style.zIndex = '120';
        root.appendChild(pickerEl);
    } else {
        let px = worldX;
        let py = worldY;
        if (codexWorldEl) {
            const z = Math.max(0.05, codexViewZoom);
            px = worldX * z + codexViewPanX;
            py = worldY * z + codexViewPanY;
        }
        px = Math.max(0, Math.min(px, Math.max(0, rw - maxW)));
        py = Math.max(0, Math.min(py, Math.max(0, rh - estH)));
        pickerEl.style.left = `${px}px`;
        pickerEl.style.top = `${py}px`;
        root.appendChild(pickerEl);
    }

    const row = document.createElement('div');
    row.className = 'codex-picker__row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'codex-picker-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Search heroes, factions, countries, and NPCs');
    input.placeholder = 'Hero, faction, country, or NPC…';

    const btnJunction = document.createElement('button');
    btnJunction.type = 'button';
    btnJunction.className = 'codex-picker__junction';
    btnJunction.textContent = 'Break';
    btnJunction.title = 'Place a junction waypoint (circle, no portrait) for corners and splits';
    btnJunction.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (pendingNodePos && root) {
            placeCodexNode(pendingNodePos.x, pendingNodePos.y, 'junction', null, null, { fromSaved: false });
        }
        removePicker();
    });

    row.appendChild(input);
    row.appendChild(btnJunction);
    pickerEl.appendChild(row);

    input.addEventListener('input', () => syncSuggestionList(input));
    input.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement === input) return;
            const ae = document.activeElement;
            if (listEl && ae && listEl.contains(ae)) return;
            removePicker();
        }, 180);
    });

    onDocPointerDown = (ev) => {
        if (!pickerEl) return;
        const t = ev.target;
        if (pickerEl.contains(t) || (listEl && listEl.contains(t))) return;
        removePicker();
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);

    onDocKeydown = (ev) => {
        if (ev.key === 'Escape') {
            removePicker();
        }
    };
    document.addEventListener('keydown', onDocKeydown, true);

    input.focus();
}

function normalizeFactions(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return [];
    if (typeof raw[0] === 'string') {
        return raw.map((dn) => ({ displayName: dn, filename: dn }));
    }
    return raw.filter((f) => f && (f.displayName != null || f.filename != null));
}

function getHeroFactionLists() {
    const em = getEventManager();
    const dm = getGlobeController()?.dataModel;
    const heroes = (em?.heroes?.length ? em.heroes : null) || dm?.heroes || [];
    let factions = (em?.factions?.length ? em.factions : null) || dm?.factions || [];
    const npcs = (em?.npcs?.length ? em.npcs : null) || dm?.npcs || [];
    return { heroes, factions: normalizeFactions(factions), npcs };
}

function clearCodexEventThumbnailFilterHover() {
    const codexRoot = root || document.getElementById('codex-view-root');
    if (!codexRoot) return;
    const els = codexRoot.querySelectorAll('.codex-node--filter-hover');
    if (!els.length) return;
    els.forEach((el) => el.classList.remove('codex-node--filter-hover'));
    redrawCodexEdges();
}

/**
 * Highlight Codex portrait nodes whose kind/id matches the event’s filters (heroes, factions, NPCs).
 * @param {object} event - Full event (root filters if variant omits them)
 * @param {object} [displayEvent] - Variant row when multi-event
 */
function applyCodexEventThumbnailFilterHover(event, displayEvent) {
    const codexRoot = root || document.getElementById('codex-view-root');
    if (!codexRoot || !event) return;
    clearCodexEventThumbnailFilterHover();
    const disp = displayEvent && typeof displayEvent === 'object' ? displayEvent : event;
    const S = getStoryFilterPlacesSync();
    const mergeList = (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
    const heroesRaw = S?.getStoryEventHeroTokens
        ? mergeList(S.getStoryEventHeroTokens(event), S.getStoryEventHeroTokens(disp))
        : mergeList(event.filters, disp.filters);
    const factionsRaw = S?.getStoryEventFactionTokens
        ? mergeList(S.getStoryEventFactionTokens(event), S.getStoryEventFactionTokens(disp))
        : mergeList(event.factions, disp.factions);
    const npcsRaw = S?.getStoryEventNpcTokens
        ? mergeList(S.getStoryEventNpcTokens(event), S.getStoryEventNpcTokens(disp))
        : mergeList(event.npcs, disp.npcs);
    const heroesLower = new Set(
        heroesRaw.map((h) => String(h || '').trim().toLowerCase()).filter(Boolean)
    );
    const npcsLower = new Set(
        npcsRaw.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
    );
    const factions = Array.isArray(factionsRaw) ? factionsRaw : [];
    const fh = getFactionMatchHelpers();

    codexRoot.querySelectorAll('.codex-node').forEach((el) => {
        if (!codexRoot.contains(el) || el.classList.contains('codex-node--junction')) return;
        const kind = el.dataset.codexKind;
        let match = false;
        if (kind === 'hero' && heroesLower.has(String(el.dataset.codexHero || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'npc' && npcsLower.has(String(el.dataset.codexNpc || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'faction' && factions.length) {
            const fn = el.dataset.codexFactionFile || '';
            const fd = el.dataset.codexFactionDisplay || '';
            for (let i = 0; i < factions.length; i++) {
                const ef = factions[i];
                if (fh && typeof fh.factionIdsMatch === 'function') {
                    if (fh.factionIdsMatch(fn, ef) || fh.factionIdsMatch(fd, ef)) {
                        match = true;
                        break;
                    }
                } else if (fn === ef || fd === ef) {
                    match = true;
                    break;
                }
            }
        }
        if (match) el.classList.add('codex-node--filter-hover');
    });
    redrawCodexEdges();
}

function removeListOnly() {
    if (listEl) {
        listEl.remove();
        listEl = null;
    }
}

function removePicker() {
    removeListOnly();
    if (pickerEl) {
        pickerEl.remove();
        pickerEl = null;
    }
    pendingNodePos = null;
    if (onDocPointerDown) {
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        onDocPointerDown = null;
    }
    if (onDocKeydown) {
        document.removeEventListener('keydown', onDocKeydown, true);
        onDocKeydown = null;
    }
}

function substringMatchScore(haystack, needle) {
    if (!needle) return 0;
    const h = String(haystack || '').toLowerCase();
    const n = needle.toLowerCase();
    if (!h.includes(n)) return Infinity;
    if (h.startsWith(n)) return 0;
    return 1 + h.indexOf(n);
}

function buildMatches(query) {
    const prefix = query.trim().toLowerCase();
    const { heroes, factions, npcs } = getHeroFactionLists();
    const countries = [];
    if (prefix) {
        for (let i = 0; i < CODEX_ALLOWED_COUNTRY_KEYS.length; i += 1) {
            const key = CODEX_ALLOWED_COUNTRY_KEYS[i];
            const lk = key.toLowerCase();
            if (lk.includes(prefix)) {
                countries.push({ key, label: key });
            }
        }
    }
    if (!prefix) {
        return { heroes: [], factions: [], countries: [], npcs: [] };
    }
    const hMatch = heroes
        .filter((h) => String(h || '').toLowerCase().includes(prefix))
        .sort(
            (a, b) =>
                substringMatchScore(a, prefix) - substringMatchScore(b, prefix)
                || String(a).length - String(b).length
        )
        .slice(0, MAX_SUGGEST);
    const fMatch = factions
        .filter((f) => {
            const dn = String(f.displayName || '').trim().toLowerCase();
            const fn = String(f.filename || '').toLowerCase();
            return dn.includes(prefix) || fn.includes(prefix);
        })
        .sort((a, b) => {
            const sa = Math.min(
                substringMatchScore(a.displayName, prefix),
                substringMatchScore(a.filename, prefix)
            );
            const sb = Math.min(
                substringMatchScore(b.displayName, prefix),
                substringMatchScore(b.filename, prefix)
            );
            if (sa !== sb) return sa - sb;
            return String(a.displayName || '').length - String(b.displayName || '').length;
        })
        .slice(0, MAX_SUGGEST);
    const npcList = Array.isArray(npcs) ? npcs : [];
    const nMatch = npcList
        .filter((n) => String(n || '').toLowerCase().includes(prefix))
        .sort(
            (a, b) =>
                substringMatchScore(a, prefix) - substringMatchScore(b, prefix)
                || String(a).length - String(b).length
        )
        .slice(0, MAX_SUGGEST);
    return { heroes: hMatch, factions: fMatch, countries, npcs: nMatch };
}

function appendSuggestionRow(list, kind, heroName, faction, onPick, countryMeta = null) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'filter-autocomplete-item';

    const img = document.createElement('img');
    img.className = 'filter-autocomplete-item-icon';
    img.alt = '';
    img.decoding = 'async';
    img.onerror = () => {
        img.style.visibility = 'hidden';
    };

    let labelText = '';
    let detailText = '';

    if (kind === 'hero') {
        labelText = heroName;
        detailText = 'Hero';
        img.src = `src/assets/images/Filters/Heroes/${encodeURIComponent(heroName)}.png`;
        img.className += ' filter-autocomplete-item-icon--hero';
    } else if (kind === 'npc') {
        labelText = heroName;
        detailText = 'NPC';
        img.src = `src/assets/images/Filters/NPCs/${encodeURIComponent(heroName)}.png`;
        img.className += ' filter-autocomplete-item-icon--npc';
    } else if (kind === 'country' && countryMeta) {
        labelText = countryMeta.label || countryMeta.key;
        detailText = 'Country';
        img.src = codexCountryFlagSrc(countryMeta.key);
        img.className += ' filter-autocomplete-item-icon--flag';
    } else {
        labelText = faction.displayName;
        detailText = 'Faction';
        img.src = `src/assets/images/Filters/Factions/${encodeURIComponent(faction.filename)}.png`;
        img.className += ' filter-autocomplete-item-icon--faction';
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-autocomplete-item-label';
    labelSpan.textContent = labelText;

    const detailSpan = document.createElement('span');
    detailSpan.className = 'filter-autocomplete-item-detail';
    detailSpan.textContent = detailText;

    row.appendChild(img);
    row.appendChild(labelSpan);
    row.appendChild(detailSpan);
    row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPick();
    });
    list.appendChild(row);
}

function syncSuggestionList(input) {
    removeListOnly();
    const { heroes, factions, countries, npcs } = buildMatches(input.value);
    if (heroes.length === 0 && factions.length === 0 && countries.length === 0 && npcs.length === 0) {
        return;
    }

    listEl = document.createElement('div');
    listEl.className = 'filter-autocomplete-list filter-autocomplete-list--codex-picker';

    const runPick = (kind, heroName, faction, extra = {}) => {
        if (pendingNodePos && root) {
            placeCodexNode(pendingNodePos.x, pendingNodePos.y, kind, heroName, faction, {
                fromSaved: false,
                ...extra
            });
        }
        removePicker();
    };

    heroes.forEach((h) => {
        appendSuggestionRow(listEl, 'hero', h, null, () => runPick('hero', h, null));
    });
    factions.forEach((f) => {
        appendSuggestionRow(listEl, 'faction', null, f, () => runPick('faction', null, f));
    });
    npcs.forEach((n) => {
        appendSuggestionRow(listEl, 'npc', n, null, () => runPick('npc', n, null));
    });
    countries.forEach((c) => {
        appendSuggestionRow(
            listEl,
            'country',
            null,
            null,
            () => runPick('country', null, null, { countryKey: c.key }),
            c
        );
    });

    if (pickerEl) {
        pickerEl.appendChild(listEl);
    } else {
        const rect = input.getBoundingClientRect();
        listEl.style.left = `${rect.left}px`;
        listEl.style.top = `${rect.bottom + 4}px`;
        listEl.style.width = `${Math.max(rect.width, 220)}px`;
        document.body.appendChild(listEl);
    }
}

function codexEscapeEdgeIdForSelector(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
    }
    return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * All directed edges in the maximal A→…→B chain containing `fromId`→`toId` through junctions only
 * (unique incoming/outgoing at each junction). Used so hover highlights the full routed cord.
 * @returns {Set<string>} keys from {@link edgeDirectedKey}
 */
function collectCodexDirectedChainEdgeKeys(fromId, toId) {
    const keys = new Set();
    if (!fromId || !toId || fromId === toId || !Array.isArray(codexEdges)) return keys;
    const maxSteps = Math.max(8, codexEdges.length + 2);
    const addK = (a, b) => {
        if (a && b && a !== b) keys.add(edgeDirectedKey(a, b));
    };
    addK(fromId, toId);
    let cur = fromId;
    let forbidFrom = toId;
    let steps = 0;
    while (steps < maxSteps && codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const inc = codexEdges.filter((e) => e && e.toId === cur && e.fromId !== forbidFrom);
        if (inc.length !== 1) break;
        const e = inc[0];
        addK(e.fromId, e.toId);
        forbidFrom = cur;
        cur = e.fromId;
    }
    cur = toId;
    let forbidTo = fromId;
    steps = 0;
    while (steps < maxSteps && codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const outs = codexEdges.filter((e) => e && e.fromId === cur && e.toId !== forbidTo);
        if (outs.length !== 1) break;
        const e = outs[0];
        addK(e.fromId, e.toId);
        forbidTo = cur;
        cur = e.toId;
    }
    return keys;
}

function codexEdgeHoverChainSetsEqual(a, b) {
    if (!a || !b || a.size !== b.size) return false;
    for (const k of a) {
        if (!b.has(k)) return false;
    }
    return true;
}

function setCodexEdgeHoverVisual(fromId, toId, active) {
    if (!root || !fromId || !toId) return;
    const svg = root.querySelector('.codex-edges-layer');
    if (!svg) return;
    const sel = `g.codex-edge-segment-group[data-codex-edge-from="${codexEscapeEdgeIdForSelector(fromId)}"][data-codex-edge-to="${codexEscapeEdgeIdForSelector(toId)}"]`;
    try {
        svg.querySelectorAll(sel).forEach((g) => {
            g.classList.toggle('codex-edge-segment-group--hover', active);
        });
    } catch (_) {
        /* ignore */
    }
}

function clearAllCodexEdgeHoverVisual() {
    codexEdgeHoverChainKeySet = null;
    if (!root) return;
    const svg = root.querySelector('.codex-edges-layer');
    if (!svg) return;
    svg.querySelectorAll('g.codex-edge-segment-group--hover').forEach((g) => {
        g.classList.remove('codex-edge-segment-group--hover');
    });
}

function onCodexEdgeSvgPointerOver(e) {
    if (codexMode !== 'view') return;
    const t = /** @type {Element} */ (e.target);
    if (!t?.classList?.contains('codex-edge-hit')) return;
    const f = t.dataset.codexEdgeFrom;
    const to = t.dataset.codexEdgeTo;
    if (!f || !to) return;
    const chain = collectCodexDirectedChainEdgeKeys(f, to);
    if (codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(codexEdgeHoverChainKeySet, chain)) {
        return;
    }
    clearAllCodexEdgeHoverVisual();
    codexEdgeHoverChainKeySet = chain;
    chain.forEach((key) => {
        const sep = key.indexOf('\x1e');
        if (sep < 0) return;
        const a = key.slice(0, sep);
        const b = key.slice(sep + 1);
        setCodexEdgeHoverVisual(a, b, true);
    });
}

function onCodexEdgeSvgPointerOut(e) {
    if (codexMode !== 'view') return;
    const t = /** @type {Element} */ (e.target);
    if (!t?.classList?.contains('codex-edge-hit')) return;
    const rel = e.relatedTarget;
    if (rel && codexEdgesSvgEl && codexEdgesSvgEl.contains(rel)) {
        const nextHit = typeof rel.closest === 'function' ? rel.closest('.codex-edge-hit') : null;
        if (nextHit) {
            const nf = nextHit.dataset.codexEdgeFrom || '';
            const nt = nextHit.dataset.codexEdgeTo || '';
            const nk = nf && nt ? edgeDirectedKey(nf, nt) : '';
            if (nk && codexEdgeHoverChainKeySet?.has(nk)) {
                return;
            }
        }
    }
    clearAllCodexEdgeHoverVisual();
}

function codexSvgPointerDownCapture(e) {
    if (!root || !codexEdgesSvgEl) return;
    cancelBackgroundPanPointerPending();
    const t = /** @type {SVGElement} */ (e.target);
    if (!t || !t.classList) return;
    if (t.closest && (t.closest('.codex-toolbar') || t.closest('.codex-visual-panel'))) return;

    if (e.button === 0 && t.classList.contains('codex-edge-hit')) {
        if (codexMode === 'view') {
            e.preventDefault();
            e.stopPropagation();
            openStoryArchiveFromCodexEdgeHit(
                t.dataset.codexEdgeFrom || '',
                t.dataset.codexEdgeTo || ''
            );
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        cancelPointerPending();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        armCodexBackgroundPanPendingFromEvent(e);
        return;
    }

    if (e.button === 0) {
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    }
}

function cancelPointerPending() {
    cancelBackgroundPanPointerPending();
    if (!pointerPending) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    pointerPending = null;
}

function onPointerMoveMaybeDrag(ev) {
    const p = pointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    const dx = ev.clientX - p.startCX;
    const dy = ev.clientY - p.startCY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    const prep = pointerPending;
    pointerPending = null;
    beginActualNodeDrag(prep, ev);
}

function onPointerUpMaybeSelect(ev) {
    const p = pointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    pointerPending = null;
    selectCodexNode(p.el, { mode: p.shiftKey ? 'toggle' : 'replace' });
    // Dev mode: do not open info panels on click — selection/drag/network tooling only.
    // View mode opens the panel from the dedicated pointerdown branch, not here.
}

function beginActualNodeDrag(prep, firstMoveEv) {
    const el = prep.el;
    const dragNodes = prep.dragGroup && prep.dragGroup.length ? prep.dragGroup : [el];
    el.setPointerCapture(prep.pointerId);

    const { layerLeft, layerTop, grabOffX, grabOffY } = prep;

    const bases = dragNodes.map((nodeEl) => ({
        el: nodeEl,
        baseLeft: parseFloat(nodeEl.style.left) || 0,
        baseTop: parseFloat(nodeEl.style.top) || 0
    }));
    const anchor = bases.find((b) => b.el === el) || bases[0];

    codexActiveDragNodeIds = new Set(dragNodes.map((n) => n.dataset.codexNodeId).filter(Boolean));

    dragNodes.forEach((nodeEl) => {
        nodeEl.style.willChange = 'transform';
        const isSimplified = nodeEl.classList.contains('codex-node--simplified');
        // Simplified nodes use center origin for rotation; others use top-left
        nodeEl.style.transformOrigin = isSimplified ? 'center center' : '0 0';
        // For simplified nodes, preserve rotation during drag
        const hexRot = isSimplified ? (parseFloat(nodeEl.dataset.codexHexRotation) || 0) : 0;
        const rotStr = hexRot ? ` rotate(${hexRot}deg)` : '';
        nodeEl.style.transform = `translate3d(0px, 0px, 0)${rotStr}`;
    });

    let lastTx = 0;
    let lastTy = 0;

    const rawOpts = { capture: true, passive: true };

    const applyClient = (clientX, clientY) => {
        let nx;
        let ny;
        if (codexWorldEl) {
            const pw = clientToWorldCodex(clientX, clientY);
            nx = pw.x - grabOffX;
            ny = pw.y - grabOffY;
        } else {
            const s = getCodexBodyLayoutPerViewportPx();
            nx = (clientX - layerLeft) / s - grabOffX;
            ny = (clientY - layerTop) / s - grabOffY;
        }
        let tx = nx - anchor.baseLeft;
        let ty = ny - anchor.baseTop;
        const c = clampCodexGroupDragDelta(tx, ty, dragNodes);
        tx = c.tx;
        ty = c.ty;
        lastTx = tx;
        lastTy = ty;
        dragNodes.forEach((nodeEl) => {
            // Include rotation for simplified nodes
            const isSimplified = nodeEl.classList.contains('codex-node--simplified');
            const hexRot = isSimplified ? (parseFloat(nodeEl.dataset.codexHexRotation) || 0) : 0;
            const rotStr = hexRot ? ` rotate(${hexRot}deg)` : '';
            nodeEl.style.transform = `translate3d(${tx}px, ${ty}px, 0)${rotStr}`;
        });
        scheduleRedrawCodexEdges();
    };

    applyClient(firstMoveEv.clientX, firstMoveEv.clientY);

    const onMove = (ev) => {
        if (!root) return;
        const coalesced = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : null;
        /* Only the latest sample matters for transform + cords; replaying all N events redrew the full SVG N times. */
        if (coalesced && coalesced.length > 0) {
            const last = coalesced[coalesced.length - 1];
            applyClient(last.clientX, last.clientY);
        } else {
            applyClient(ev.clientX, ev.clientY);
        }
    };

    const usePointerRawUpdate = typeof window !== 'undefined'
        && typeof PointerEvent !== 'undefined'
        && 'onpointerrawupdate' in window;
    const moveEvent = usePointerRawUpdate ? 'pointerrawupdate' : 'pointermove';

    let dragFinished = false;
    const finishDrag = () => {
        if (dragFinished) return;
        dragFinished = true;
        codexActiveDragNodeIds.clear();
        const moved = lastTx !== 0 || lastTy !== 0;
        bases.forEach(({ el: nodeEl, baseLeft: bl, baseTop: bt }) => {
            const newX = bl + lastTx;
            const newY = bt + lastTy;
            nodeEl.style.left = `${newX}px`;
            nodeEl.style.top = `${newY}px`;
            nodeEl.style.transform = '';
            nodeEl.style.transformOrigin = '';
            nodeEl.style.willChange = '';
            
            // Sync position to codexAllNodes for save persistence
            const nodeId = nodeEl.dataset.codexNodeId;
            if (nodeId) {
                const nodeObj = codexAllNodes.find(n => n.id === nodeId);
                if (nodeObj) {
                    nodeObj.x = newX;
                    nodeObj.y = newY;
                }
            }
        });
        // Trigger final edge redraw after drag completes
        if (moved) {
            scheduleRedrawCodexEdges();
        }
        document.removeEventListener(moveEvent, onMove, usePointerRawUpdate ? rawOpts : capOpts);
        document.removeEventListener('pointerup', onUp, capOpts);
        document.removeEventListener('pointercancel', onUp, capOpts);
        el.removeEventListener('lostpointercapture', onLost);
        if (moved) {
            const dragIds = new Set(dragNodes.map((n) => n.dataset.codexNodeId).filter(Boolean));
            applyOctilinearSnapOnDragRelease(dragIds);
            bases.forEach(({ el: nodeEl }) => {
                markNodeVisualUnsaved(nodeEl);
                markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
            });
            markCodexLayoutDirty();
        }
    };

    const onLost = () => {
        finishDrag();
    };

    const onUp = () => {
        try {
            el.releasePointerCapture(prep.pointerId);
        } catch (_) { /* ignore */ }
        finishDrag();
    };

    el.addEventListener('lostpointercapture', onLost);
    document.addEventListener(moveEvent, onMove, usePointerRawUpdate ? rawOpts : capOpts);
    document.addEventListener('pointerup', onUp, capOpts);
    document.addEventListener('pointercancel', onUp, capOpts);
}

function normalizeCodexHeroNameForMatch(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/** Loose match for UI quirks (e.g. Soldier: 76 vs Soldier 76). */
function codexHeroNamesLooselyEqual(a, b) {
    const na = normalizeCodexHeroNameForMatch(a);
    const nb = normalizeCodexHeroNameForMatch(b);
    if (na && na === nb) return true;
    const la = na.replace(/:/g, '').replace(/\s/g, '');
    const lb = nb.replace(/:/g, '').replace(/\s/g, '');
    return la.length > 0 && la === lb;
}

/**
 * @param {string} heroNameFromNode - `dataset.codexHero` from a hero codex node
 * @returns {number}
 */
function findHeroArchiveIndexByCodexName(heroNameFromNode) {
    const events = getEventsFromEventManager();
    if (!Array.isArray(events) || !events.length) return -1;
    for (let i = 0; i < events.length; i += 1) {
        const rowName = events[i] && events[i].name != null ? String(events[i].name) : '';
        if (codexHeroNamesLooselyEqual(rowName, heroNameFromNode)) return i;
    }
    return -1;
}

/**
 * Switch to Heroes archive (if needed), find a row whose `name` matches the codex hero label, open the event slide.
 * @param {string} heroNameFromNode
 * @returns {Promise<void>}
 */
async function openHeroArchiveEntryFromCodexHeroName(heroNameFromNode) {
    const em = getEventManager();
    if (!em || !String(heroNameFromNode || '').trim()) return;
    if (typeof em.openHeroArchiveEventByName === 'function') {
        await em.openHeroArchiveEventByName(heroNameFromNode);
        return;
    }
    /* Legacy fallback if EventManager method unavailable */
    const slide = getStandaloneEventSlide();
    if (!slide) return;
    try {
        if (slide.pushSlideHistoryIfOpen) {
            slide.pushSlideHistoryIfOpen();
        }
        const src = typeof em.dataService?.getArchiveSource === 'function' ? em.dataService.getArchiveSource() : 'story';
        if (src !== 'heroes') {
            if (typeof em.switchStoryArchiveSource === 'function') {
                await em.switchStoryArchiveSource('heroes');
            } else if (em.dataService?.setArchiveSource) {
                em.dataService.setArchiveSource('heroes');
                await em.loadEvents();
                if (typeof em.renderEvents === 'function') em.renderEvents();
            } else {
                return;
            }
        }
        const list = em.events || [];
        const idx = findHeroArchiveIndexByCodexName(heroNameFromNode);
        if (idx < 0) {
            updateAppStatus(`No Heroes archive entry matches “${String(heroNameFromNode).trim()}”`, 'warning');
            return;
        }
        slide.showEvent(idx, { eventList: list, keepSlideHistory: true });
        playSoundEffect('eventClick');
    } catch (err) {
        console.warn('CodexCanvasService: open hero archive from codex node failed', err);
    }
}

/** Hero / faction / npc / country nodes can open a Data Archive row; junctions cannot. */
function codexNodeElSupportsStoryArchiveLink(el) {
    if (!el?.dataset) return false;
    const k = el.dataset.codexKind || '';
    return k === 'hero' || k === 'npc' || k === 'faction' || k === 'country';
}

/** @returns {{ kind: 'hero'|'faction'|'npc', name: string }|null} */
function codexBioLinkSpecFromNodeEl(el) {
    if (!el?.dataset) return null;
    const k = el.dataset.codexKind || '';
    if (k === 'hero') {
        const name = String(el.dataset.codexHero || '').trim();
        return name ? { kind: 'hero', name } : null;
    }
    if (k === 'npc') {
        const name = String(el.dataset.codexNpc || '').trim();
        return name ? { kind: 'npc', name } : null;
    }
    if (k === 'faction') {
        const name = String(
            el.dataset.codexFactionDisplay || el.dataset.codexFactionFile || ''
        ).trim();
        return name ? { kind: 'faction', name } : null;
    }
    return null;
}

/**
 * View mode: primary click on an edge opens node A's archive — the directed **from** endpoint.
 * If `from` is not archive-linkable (e.g. junction), falls back to **to**.
 */
function openStoryArchiveFromCodexEdgeHit(fromId, toId) {
    if (codexMode !== 'view' || !fromId) return;
    const tryOpen = (subjectEl, otherEl) => {
        if (!subjectEl || !codexNodeElSupportsStoryArchiveLink(subjectEl)) return false;
        playSoundEffect('nodeSelect');
        const spec = codexBioLinkSpecFromNodeEl(otherEl);
        maybeOpenStoryArchiveFromCodexNodeEl(subjectEl, { codexConnectionHighlight: spec });
        return true;
    };
    if (tryOpen(codexNodeElements.get(fromId), codexNodeElements.get(toId))) return;
    if (toId && tryOpen(codexNodeElements.get(toId), codexNodeElements.get(fromId))) return;
}

/**
 * View mode: portrait / country nodes open the matching archive row (heroes, factions, npcs, locations).
 * @param {HTMLElement} nodeEl
 * @param {{ codexConnectionHighlight?: { kind: string, name: string }|null }} [opts]
 */
function maybeOpenStoryArchiveFromCodexNodeEl(nodeEl, opts) {
    if (codexMode !== 'view') return;
    if (!nodeEl) return;
    const em = getEventManager();
    if (!em) return;
    const o = opts || {};
    const highlight = o.codexConnectionHighlight || null;
    const scheduleHighlight = () => {
        if (!highlight || !String(highlight.name || '').trim()) return;
        const run = () => {
            applyLocationFlagBioHighlight(highlight);
        };
        requestAnimationFrame(() => requestAnimationFrame(run));
    };
    const kind = nodeEl.dataset.codexKind || '';

    if (kind === 'hero') {
        const heroName = String(nodeEl.dataset.codexHero || '').trim();
        if (!heroName) return;
        void (async () => {
            await openHeroArchiveEntryFromCodexHeroName(heroName);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'npc') {
        const npc = String(nodeEl.dataset.codexNpc || '').trim();
        if (!npc || typeof em.openNpcArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openNpcArchiveEventByName(npc);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'faction') {
        const token = String(
            nodeEl.dataset.codexFactionDisplay || nodeEl.dataset.codexFactionFile || ''
        ).trim();
        if (!token || typeof em.openFactionArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openFactionArchiveEventByName(token);
            scheduleHighlight();
        })();
        return;
    }
    if (kind === 'country') {
        const ck = String(nodeEl.dataset.codexCountryKey || '').trim();
        if (!ck || typeof em.openLocationArchiveEventByName !== 'function') return;
        void (async () => {
            await em.openLocationArchiveEventByName(ck);
            scheduleHighlight();
        })();
    }
}

function bindCodexNodeInteraction(el) {
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent deletion in view mode
        if (codexMode === 'view') return;

        const now = Date.now();
        pruneStaleCodexSelection();
        const inSelection = codexSelectedNodeEls.has(el);
        const multi = codexSelectedNodeEls.size > 1 && inSelection;

        if (multi) {
            const bulkAge = now - codexBulkNodeDeleteArmedAt;
            if (bulkAge < DOUBLE_RIGHT_MS && codexBulkNodeDeleteArmedAt > 0) {
                const toRemove = [...codexSelectedNodeEls].filter((n) => root && root.contains(n));
                const ids = toRemove.map((n) => n.dataset.codexNodeId).filter(Boolean);
                clearPendingCodexDeleteState();
                removeEdgesForDeletedNodesWithJunctionBridging(ids);
                // Remove from codexAllNodes for save persistence
                codexAllNodes = codexAllNodes.filter(n => !ids.includes(n.id));
                markCodexLayoutDirty();
                codexSelectedNodeEls.clear();
                codexPrimarySelectedNodeEl = null;
                for (const id of ids) unregisterCodexNodeRenderTracking(id);
                toRemove.forEach((n) => n.remove());
                applyCodexSelectionToDom();
                redrawCodexEdges();
                updateCodexToolbar();
                scheduleUpdateCodexVirtualScroll();
            } else {
                clearPendingCodexDeleteState();
                codexBulkNodeDeleteArmedAt = now;
                codexSelectedNodeEls.forEach((n) => {
                    if (root && root.contains(n)) n.classList.add('codex-node--pending-delete');
                });
                redrawCodexEdges();
            }
            return;
        }

        codexBulkNodeDeleteArmedAt = 0;
        const nid = el.dataset.codexNodeId;
        if (!nid) return;
        const prevTs = codexNodeDeleteLastRightTs.get(nid) || 0;
        if (prevTs > 0 && now - prevTs < DOUBLE_RIGHT_MS) {
            codexNodeDeleteLastRightTs.delete(nid);
            clearPendingCodexDeleteState();
            removeEdgesForDeletedNodesWithJunctionBridging([nid]);
            // Remove from codexAllNodes for save persistence
            codexAllNodes = codexAllNodes.filter(n => n.id !== nid);
            markCodexLayoutDirty();
            codexSelectedNodeEls.delete(el);
            if (codexPrimarySelectedNodeEl === el) {
                const rest = [...codexSelectedNodeEls];
                codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
            }
            applyCodexSelectionToDom();
            unregisterCodexNodeRenderTracking(nid);
            el.remove();
            redrawCodexEdges();
            updateCodexToolbar();
            scheduleUpdateCodexVirtualScroll();
        } else {
            clearPendingCodexDeleteState();
            el.classList.add('codex-node--pending-delete');
            codexNodeDeleteLastRightTs.set(nid, now);
            redrawCodexEdges();
        }
    }, true);

    el.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && codexMode === 'dev' && el.dataset.codexNodeId) {
            codexNodeDeleteLastRightTs.delete(el.dataset.codexNodeId);
        }
        if (e.button !== 0) return;
        e.stopPropagation();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

        // Prevent selection of filtered-out nodes
        if (el.classList.contains('codex-node--filtered-out')) {
            return;
        }
        
        // In View Mode, allow selection but not editing/moving
        if (codexMode === 'view') {
            // Play node select sound
            playSoundEffect('nodeSelect');
            // Select the node
            selectCodexNode(el);
            maybeOpenStoryArchiveFromCodexNodeEl(el);
            return;
        }
        
        if (codexInteractionMode === 'network') {
            e.preventDefault();
            handleNetworkNodeActivate(el);
            return;
        }
        cancelPointerPending();

        cancelBackgroundPanPointerPending();

        const baseLeft = parseFloat(el.style.left) || 0;
        const baseTop = parseFloat(el.style.top) || 0;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (!root) return;

        let maxX;
        let maxY;
        let grabOffX;
        let grabOffY;
        let layerLeft = 0;
        let layerTop = 0;

        if (codexWorldEl) {
            maxX = Math.max(0, CODEX_WORLD_W - w);
            maxY = Math.max(0, CODEX_WORLD_H - h);
            const pw = clientToWorldCodex(e.clientX, e.clientY);
            grabOffX = pw.x - baseLeft;
            grabOffY = pw.y - baseTop;
        } else {
            const layer = hitLayerEl || root;
            const lr = layer.getBoundingClientRect();
            const s = getCodexBodyLayoutPerViewportPx();
            layerLeft = lr.left;
            layerTop = lr.top;
            maxX = Math.max(0, root.clientWidth - w);
            maxY = Math.max(0, root.clientHeight - h);
            grabOffX = (e.clientX - lr.left) / s - baseLeft;
            grabOffY = (e.clientY - lr.top) / s - baseTop;
        }

        pointerPending = {
            el,
            dragGroup: selectDragGroupForNode(el),
            pointerId: e.pointerId,
            baseLeft,
            baseTop,
            layerLeft,
            layerTop,
            maxX,
            maxY,
            grabOffX,
            grabOffY,
            startCX: e.clientX,
            startCY: e.clientY,
            shiftKey: !!e.shiftKey
        };
        document.addEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
        document.addEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
        document.addEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    });
}

/**
 * @param {string} kind
 * @param {string|null} heroName
 * @param {{ filename: string, displayName?: string }|null} faction
 * @param {{ fromSaved?: boolean, id?: string, scale?: number, skipLazyLoad?: boolean }} [opts]
 */
function createCodexNodeElement(x, y, kind, heroName, faction, opts = {}) {
    const el = document.createElement('div');
    el.className = 'codex-node';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = String(++nodeZ);
    el.dataset.codexNodeId = opts.id || generateNodeId();

    el.dataset.codexKind = kind;
    
    // Apply background color from opts if provided
    if (opts.bgColor) {
        el.dataset.codexBgColor = opts.bgColor;
    }
    if (kind === 'junction') {
        el.classList.add('codex-node--junction');
        const dot = document.createElement('div');
        dot.className = 'codex-node__junction';
        dot.setAttribute('aria-hidden', 'true');
        el.appendChild(dot);
        applyNodeScale(el, resolveCodexNodeScale('junction', opts.scale));
        bindCodexNodeInteraction(el);
        return el;
    }
    if (kind === 'hero') {
        el.dataset.codexHero = heroName || '';
    } else if (kind === 'npc') {
        el.dataset.codexNpc = heroName || '';
    } else if (kind === 'country') {
        const ck = normalizeCodexCountryKey(opts.countryKey);
        el.dataset.codexCountryKey = ck || '';
    } else if (faction) {
        el.dataset.codexFactionFile = faction.filename || '';
        el.dataset.codexFactionDisplay = faction.displayName || faction.filename || '';
    }

    const nid = el.dataset.codexNodeId;
    const frameVariant = codexFrameVariantForId(nid);
    const hexRotationDeg = codexHexRotationDegreesForId(nid);
    el.dataset.codexFrameVariant = String(frameVariant);
    el.dataset.codexHexRotation = String(hexRotationDeg);

    // Get image source and alt text
    let imgSrc = '';
    let imgAlt = '';
    if (kind === 'hero') {
        imgSrc = `src/assets/images/Filters/Heroes/${encodeURIComponent(heroName)}.png`;
        imgAlt = heroName || 'Hero';
    } else if (kind === 'npc') {
        imgSrc = `src/assets/images/Filters/NPCs/${encodeURIComponent(heroName)}.png`;
        imgAlt = heroName || 'NPC';
    } else if (kind === 'country') {
        const ck = el.dataset.codexCountryKey || '';
        imgSrc = codexCountryFlagSrc(ck);
        imgAlt = ck || 'Country';
    } else {
        imgSrc = `src/assets/images/Filters/Factions/${encodeURIComponent(faction.filename)}.png`;
        imgAlt = faction.displayName || '';
    }

    const frameSrc = `${CODEX_FRAME_PATH}${frameVariant}.png`;

    if (CODEX_USE_SIMPLIFIED_DOM) {
        // Simplified DOM: 5 elements
        // el (root) -> imgWrapper (masked, rotates with hex) -> img (counter-rotates) + frame
        el.classList.add('codex-node--simplified');
        el.style.setProperty('--codex-hex-rotation', `${hexRotationDeg}deg`);

        // Wrapper that rotates with hex and gets masked
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'codex-node__img-wrapper';

        const img = document.createElement('img');
        img.className = 'codex-node__img';
        img.draggable = false;
        img.decoding = 'async';
        img.alt = imgAlt;
        img.onerror = () => { img.style.opacity = '0.35'; };
        if (opts.skipLazyLoad) { img.src = imgSrc; }
        else { img.dataset.src = imgSrc; observeCodexImage(img); }

        imgWrapper.appendChild(img);

        const frame = document.createElement('img');
        frame.className = 'codex-node__frame';
        frame.alt = '';
        frame.draggable = false;
        frame.decoding = 'async';
        frame.setAttribute('aria-hidden', 'true');
        if (opts.skipLazyLoad) { frame.src = frameSrc; }
        else { frame.dataset.src = frameSrc; observeCodexImage(frame); }

        el.appendChild(imgWrapper);
        
        // Add background inside img-wrapper to inherit mask
        const bg = document.createElement('div');
        bg.className = 'codex-node__bg';
        // Apply saved background color if exists, otherwise use default white
        const savedBgColor = el.dataset.codexBgColor || '#ffffff';
        bg.style.background = hexToRgba(savedBgColor, 0.5);
        imgWrapper.appendChild(bg);
        
        el.appendChild(frame);
    } else {
        // Legacy DOM: 8 elements with nested mask structure
        const inner = document.createElement('div');
        inner.className = 'codex-node__inner';

        const clip = document.createElement('div');
        clip.className = 'codex-node__clip';
        clip.setAttribute('aria-hidden', 'true');

        const imgSpin = document.createElement('div');
        imgSpin.className = 'codex-node__img-spin';
        imgSpin.setAttribute('aria-hidden', 'true');

        const img = document.createElement('img');
        img.className = 'codex-node__img';
        img.draggable = false;
        img.decoding = 'async';
        img.alt = imgAlt;
        img.onerror = () => { img.style.opacity = '0.35'; };
        if (opts.skipLazyLoad) { img.src = imgSrc; }
        else { img.dataset.src = imgSrc; observeCodexImage(img); }

        const portraitFit = document.createElement('div');
        portraitFit.className = 'codex-node__portrait-fit';
        portraitFit.setAttribute('aria-hidden', 'true');
        portraitFit.appendChild(img);
        imgSpin.appendChild(portraitFit);
        clip.appendChild(imgSpin);
        inner.appendChild(clip);

        const frame = document.createElement('img');
        frame.className = 'codex-node__frame';
        frame.alt = '';
        frame.draggable = false;
        frame.decoding = 'async';
        frame.setAttribute('aria-hidden', 'true');
        if (opts.skipLazyLoad) { frame.src = frameSrc; }
        else { frame.dataset.src = frameSrc; observeCodexImage(frame); }

        inner.style.setProperty('--codex-hex-rotation', `${hexRotationDeg}deg`);
        inner.style.setProperty('--codex-portrait-counter-rotation', `${-hexRotationDeg}deg`);
        
        // Add background inside clip to inherit mask
        const bg = document.createElement('div');
        bg.className = 'codex-node__bg';
        // Apply saved background color if exists, otherwise use default white
        const savedBgColor = el.dataset.codexBgColor || '#ffffff';
        bg.style.background = hexToRgba(savedBgColor, 0.5);
        clip.appendChild(bg);
        
        inner.appendChild(frame);
        el.appendChild(inner);
    }

    const portraitKind = kind === 'faction'
        ? 'faction'
        : kind === 'country'
            ? 'country'
            : kind === 'npc'
                ? 'npc'
                : 'hero';
    applyNodeScale(el, resolveCodexNodeScale(portraitKind, opts.scale));
    bindCodexNodeInteraction(el);
    return el;
}

/**
 * @param {{ fromSaved?: boolean, id?: string, scale?: number, countryKey?: string, skipRedraw?: boolean }} [opts]
 * Use `skipRedraw: true` when placing many nodes in one task; caller must call {@link redrawCodexEdges} once after.
 */
function placeCodexNode(x, y, kind, heroName, faction, opts = {}) {
    if (!root) return undefined;
    if (kind === 'npc' && !String(heroName || '').trim()) return undefined;
    if (kind === 'country' && !normalizeCodexCountryKey(opts.countryKey)) return undefined;
    const scale = resolveCodexNodeScale(kind, opts.scale);
    const { x: cx, y: cy } = clampCodexNodeTopLeftToWorld(x, y, scale, kind);
    const fromSaved = opts.fromSaved === true;
    if (!fromSaved) {
        const dup = findCodexDuplicatePortraitNodeId(kind, heroName, faction, opts.countryKey);
        if (dup) {
            updateAppStatus(
                'A Codex node already exists for this hero, faction, NPC, or country. Each entity can only appear once.',
                'warning'
            );
            return undefined;
        }
    }
    const el = createCodexNodeElement(cx, cy, kind, heroName, faction, { ...opts, scale });
    (codexWorldEl || root).appendChild(el);

    // Add to Map for O(1) lookups (performance optimization)
    const nodeId = el.dataset.codexNodeId;
    if (nodeId) {
        codexNodeElements.set(nodeId, el);
    }

    // Add to codexAllNodes for save persistence (only for new nodes, not loaded from save)
    if (!fromSaved) {
        const newNode = {
            id: nodeId,
            kind: kind,
            x: cx,
            y: cy,
            scale: scale
        };
        if (kind === 'hero' && heroName) {
            newNode.heroName = heroName;
        } else if (kind === 'faction' && faction) {
            newNode.factionFilename = faction.filename;
            newNode.factionDisplay = faction.displayName || faction.filename;
        } else if (kind === 'npc' && heroName) {
            newNode.npcName = heroName;
        } else if (kind === 'country' && opts.countryKey) {
            newNode.countryKey = opts.countryKey;
        }
        codexAllNodes.push(newNode);
        /* Dev virtual scroll: mark as rendered so updateCodexVirtualScroll does not call
         * placeLoadedCodexNodeRecord again (would append a second DOM node and orphan the first). */
        if (nodeId) codexRenderedNodeIds.add(nodeId);

        markNodeVisualUnsaved(el);
        markCodexLayoutDirty();
        selectCodexNode(el);
    }
    if (!opts.skipRedraw) redrawCodexEdges();
    return el;
}

/**
 * @param {HTMLElement} rootElement - #codex-view-root
 */
/** @returns {Promise<void>} Resolves when saved Codex layout has been applied (or empty load). */
export function initCodexCanvas(rootElement) {
    destroyCodexCanvas();
    root = rootElement;
    if (!root) return Promise.resolve();

    loadCodexDebugUiPref();
    loadCodexModePref();
    loadCodexVisualPrefs();
    syncCodexDebugUiClass();
    syncCodexModeClass();

    codexLayoutDirty = false;
    codexToolbarEl = null;
    codexVisualPanelEl = null;
    codexInteractionMode = 'drag';
    networkLinkSourceId = null;
    codexSelectedNodeEls = new Set();
    codexPrimarySelectedNodeEl = null;
    cordPendingDeletePairKey = null;
    codexBulkNodeDeleteArmedAt = 0;
    codexActiveDragNodeIds = new Set();
    codexEdges = [];
    pointerPending = null;

    ensureCodexWorld();
    ensureHitLayer();
    ensureEdgesLayer();
    ensureCodexBorderOverlay();
    ensureCodexModeToggle();

    registerCodexVirtualScrollRuntime({
        getRoot: () => root,
        getWorldEl: () => codexWorldEl,
        getAllNodes: () => codexAllNodes,
        getRenderedNodeIds: () => codexRenderedNodeIds,
        getNodeElementsMap: () => codexNodeElements,
        getMode: () => codexMode,
        getViewPanZoom: () => ({ panX: codexViewPanX, panY: codexViewPanY, zoom: codexViewZoom }),
        getSkipEdgeRedrawFlags: () => ({ skipAll: codexSkipAllEdgeRedraws, skipEdge: codexSkipEdgeRedraw }),
        setSkipEdgeRedrawFlags: (all, edge) => {
            codexSkipAllEdgeRedraws = all;
            codexSkipEdgeRedraw = edge;
        },
        getPerfDebug: () => CODEX_PERFORMANCE_DEBUG,
        placeLoadedCodexNodeRecord,
        redrawCodexEdges,
        scheduleRedrawCodexEdges
    });

    registerCodexBioPreviewRuntime({
        getRoot: () => root,
        getSerializedSnapshot: () => {
            if (!root) return { nodes: [], edges: [] };
            return serializeCodexLayoutSnapshot(codexAllNodes, codexEdges);
        }
    });

    if (codexEdgesSvgEl) {
        codexEdgesSvgEl.addEventListener('pointerdown', codexSvgPointerDownCapture, true);
        codexEdgesSvgEl.addEventListener('pointerover', onCodexEdgeSvgPointerOver, true);
        codexEdgesSvgEl.addEventListener('pointerout', onCodexEdgeSvgPointerOut, true);
    }

    registerCodexCordPacketRuntime({
        getRoot: () => root,
        getVisualPrefs: () => codexVisualPrefs,
        getPacketStrokeRange: codexEffectivePacketStrokeRange,
        codexNodeIsJunctionWaypoint,
        edgeCordShowsYellow,
        samplePacketTailNodeIds,
        tryBuildPacketWorldPoints,
        codexNodeElById,
        getNodeCenterWorldPx
    });

    registerCodexEdgeRedrawRuntime({
        getRoot: () => root,
        getWorldEl: () => codexWorldEl,
        getMode: () => codexMode,
        getViewModeInitialRenderDone: () => codexViewModeInitialRenderDone,
        setViewModeInitialRenderDone: (v) => {
            codexViewModeInitialRenderDone = v;
        },
        getSkipAllEdgeRedraws: () => codexSkipAllEdgeRedraws,
        getSkipEdgeRedraw: () => codexSkipEdgeRedraw,
        getPerfDebug: () => CODEX_PERFORMANCE_DEBUG,
        getEdges: () => codexEdges,
        getActiveDragNodeIds: () => codexActiveDragNodeIds,
        getViewZoom: () => codexViewZoom,
        getVisualPrefs: () => codexVisualPrefs,
        getDoubleRightMs: () => DOUBLE_RIGHT_MS,
        getCordDoubleRightLastTs: () => cordDoubleRightLastTs,
        setCordPendingDeletePairKey: (k) => {
            cordPendingDeletePairKey = k;
        },
        findEdge,
        removeCodexEdgeDirected,
        clearPendingCodexDeleteState,
        buildPolylineForEdge,
        getCodexVisibleWorldBoundsExpanded,
        codexEdgePolyIntersectsRect,
        codexUnionBoundsFromEdgePolys,
        appendCodexJunctionElbowParallelograms,
        appendEdgeGlowFilter,
        appendSoftPacketGlowFilter,
        appendCodexEdgeNodeMask,
        appendCordFilteredLineGroup,
        syncCodexNodeDomCullFromView,
        syncCodexNodeCoordLabels,
        syncCodexCordPacketState,
        codexStopCordAnimRafOnly,
        ensureCodexCordAnimationLoop,
        edgeCordAppearance,
        cordSegmentDegreesLabel,
        cordSegmentWithinOctilinearToleranceDegrees
    });

    if (hitLayerEl) {
        hitLayerEl.addEventListener('pointerdown', onHitLayerBackgroundPanPointerDown, true);
    }

    onCodexContextMenuCapture = (e) => {
        if (!hitLayerEl) return;
        if (e.target.closest('.codex-node')) return;
        if (e.target.closest('.codex-picker')) return;
        if (e.target.closest('.codex-toolbar') || e.target.closest('.codex-visual-panel')) return;
        if (e.target.closest('.filter-autocomplete-list')) return;

        const fromLayer = e.target === hitLayerEl || hitLayerEl.contains(e.target);
        const fromRootBare = e.target === root;
        if (!fromLayer && !fromRootBare) return;

        e.preventDefault();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

        // Prevent picker from opening in view mode
        if (codexMode === 'view') return;

        let px;
        let py;
        if (codexWorldEl) {
            const wpt = clientToWorldCodex(e.clientX, e.clientY);
            px = wpt.x;
            py = wpt.y;
        } else {
            const r = hitLayerEl.getBoundingClientRect();
            const s = getCodexBodyLayoutPerViewportPx();
            px = (e.clientX - r.left) / s;
            py = (e.clientY - r.top) / s;
        }

        openPickerAtRootPoint(px, py, e.clientX, e.clientY);
    };
    root.addEventListener('contextmenu', onCodexContextMenuCapture, true);

    attachCodexViewGestures();

    onCodexGlobalKeydown = (ev) => {
        if (!root) return;
        if (ev.code !== 'CapsLock' || ev.repeat) return;
        const t = ev.target;
        if (t instanceof Element) {
            if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (t.isContentEditable) return;
        }
        if (pickerEl) return;
        
        // Prevent mode toggle in view mode
        if (codexMode === 'view') return;
        
        try {
            ev.preventDefault();
        } catch (_) { /* ignore */ }
        if (codexInteractionMode === 'drag') {
            codexInteractionMode = 'network';
            networkLinkSourceId = null;
            selectCodexNode(null);
        } else {
            codexInteractionMode = 'drag';
            networkLinkSourceId = null;
        }
        updateCodexToolbar();
    };
    document.addEventListener('keydown', onCodexGlobalKeydown, true);

    onWindowResizeRedraw = () => {
        redrawCodexEdges();
    };
    window.addEventListener('resize', onWindowResizeRedraw);

    ensureCodexToolbar();
    return (async () => {
        await yieldCodexBrowserPaint();
        await loadCodexState();
    })();
}

export function destroyCodexCanvas() {
    disconnectCodexImageObserver();
    terminateCodexJsonParseWorker();
    unregisterCodexBioPreviewRuntime();
    unregisterCodexVirtualScrollRuntime();
    unregisterCodexCordPacketRuntime();
    unregisterCodexEdgeRedrawRuntime();
    codexNodeElements.clear(); // Clear the node elements Map
    if (onCodexGlobalKeydown) {
        document.removeEventListener('keydown', onCodexGlobalKeydown, true);
        onCodexGlobalKeydown = null;
    }
    detachCodexViewGestures();
    cancelPointerPending();
    cancelBackgroundPanPointerPending();
    codexActiveDragNodeIds.clear();
    cordDoubleRightLastTs.clear();
    codexNodeDeleteLastRightTs.clear();
    cordPendingDeletePairKey = null;
    codexBulkNodeDeleteArmedAt = 0;
    if (codexEdgesSvgEl) {
        codexEdgesSvgEl.removeEventListener('pointerdown', codexSvgPointerDownCapture, true);
        codexEdgesSvgEl.removeEventListener('pointerover', onCodexEdgeSvgPointerOver, true);
        codexEdgesSvgEl.removeEventListener('pointerout', onCodexEdgeSvgPointerOut, true);
    }
    codexEdgeHoverChainKeySet = null;
    codexEdgesSvgEl = null;
    removePicker();
    if (hitLayerEl) {
        hitLayerEl.removeEventListener('pointerdown', onHitLayerBackgroundPanPointerDown, true);
    }
    if (root && onCodexContextMenuCapture) {
        root.removeEventListener('contextmenu', onCodexContextMenuCapture, true);
    }
    if (onWindowResizeRedraw) {
        window.removeEventListener('resize', onWindowResizeRedraw);
        onWindowResizeRedraw = null;
    }
    clearCodexEventThumbnailFilterHover();
    root = null;
    hitLayerEl = null;
    codexWorldEl = null;
    codexViewPanX = 0;
    codexViewPanY = 0;
    codexViewZoom = CODEX_ZOOM_INITIAL;
    codexUnsavedEdgeKeys.clear();
    onCodexContextMenuCapture = null;
    codexToolbarEl = null;
    codexVisualPanelEl = null;
    codexLayoutDirty = false;
    codexSelectedNodeEls.clear();
    codexPrimarySelectedNodeEl = null;
    networkLinkSourceId = null;
    codexEdges = [];
    nodeZ = 20;
}

if (typeof window !== 'undefined') {
    window.CodexCanvasService = {
        initCodexCanvas,
        destroyCodexCanvas,
        saveCodexLayout,
        getCodexLayoutDirty: () => codexLayoutDirty,
        zoomIn: codexZoomInFromUi,
        zoomOut: codexZoomOutFromUi,
        resetView: codexResetView,
        selectAll: selectAllCodexNodes,
        applyCodexEventThumbnailFilterHover,
        clearCodexEventThumbnailFilterHover,
        exportCodexJson: exportCodexLayoutJsonDownload,
        importCodexJsonText: importCodexLayoutFromJsonText,
        syncCodexEdgesFromBioArchiveConnections,
        previewBioCodexArchiveLinkDiff
    };
}
