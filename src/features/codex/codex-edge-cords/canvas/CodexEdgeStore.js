/** CodexEdgeStore — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_EDGES_NODE_ALPHA_MASK_ID } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { codexUnorderedPairKey, edgeDirectedKey } from '../topology/CodexGraphPrimitives.js';
import { hasCodexConnectionBetween as topologyHasUndirectedLink } from '../topology/CodexGraphTopology.js';
import { playSoundEffect } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { appendCodexJunctionElbowParallelograms as appendCodexJunctionElbowParallelogramsCore } from '../../codex-node-drawing/junction-decor/CodexJunctionElbowParallelograms.js';
import { deleteCodexCordPacketStateForKey } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges, scheduleRedrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import {
    buildCodexUndirectedAdjacency,
    buildCodexNodeKindMapFromSession,
    shortestPathNodeIdsForTargetedRoutePreview
} from '../../codex-controls-ui/stage/CodexTargetedSelection.js';
import { appendCodexEdgeNodeMask as appendCodexEdgeNodeMaskCore } from '../../codex-node-drawing/svg/CodexNodeFrameSvg.js';
import { codexNodeCenterFromLayoutRecord } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';
import {
    isCodexEdgeTimelineActiveForDockPage,
    isCodexEdgeTimelineRangeInactive,
    isDirectedCodexEdgeOnActiveBioConnectionPath,
} from '../../codex-bio-archive-sync/timeline/codexBioConnectionDockTimeline.js';
import {
    codexEdgeMatchesActiveFilters,
    codexFiltersActive,
    getCodexFilterDerivedState,
    resolveCodexNodeIdsForActiveFilters,
} from '../../codex-nodes/filters/CodexNodeFilterMatch.js';
import { isCodexLinkFiltersEnabled } from '../../codex-controls-ui/stage/CodexDockToggles.js';
import { codexEdgeIsHiddenOnBoard } from '../../codex-connections/codexHiddenConnectionCords.js';


function findEdge(fromId, toId) {
    return s.codexEdges.find((ed) => ed.fromId === fromId && ed.toId === toId) || null;
}

function hasCodexConnectionBetween(fromId, toId) {
    return topologyHasUndirectedLink(fromId, toId, s.codexEdges);
}

function markCodexEdgeUnsaved(fromId, toId) {
    s.codexUnsavedEdgeKeys.add(edgeDirectedKey(fromId, toId));
}

function markIncidentCodexEdgesUnsaved(nodeId) {
    if (!nodeId) return;
    s.codexEdges.forEach((e) => {
        if (e.fromId === nodeId || e.toId === nodeId) {
            markCodexEdgeUnsaved(e.fromId, e.toId);
        }
    });
}

function removeCodexEdgeDirected(fromId, toId) {
    const next = s.codexEdges.filter((e) => !(e.fromId === fromId && e.toId === toId));
    if (next.length === s.codexEdges.length) return;
    s.codexEdges = next;
    s.codexUnsavedEdgeKeys.delete(edgeDirectedKey(fromId, toId));
    const pk = codexUnorderedPairKey(fromId, toId);
    s.cordDoubleRightLastTs.delete(pk);
    if (s.cordPendingDeletePairKey === pk) s.cordPendingDeletePairKey = null;
    api.markCodexLayoutDirty();
    redrawCodexEdges();
}

function reverseCodexDirectedEdge(edge) {
    if (!edge || !edge.fromId || !edge.toId) return;
    const oldFrom = edge.fromId;
    const oldTo = edge.toId;
    const oldKey = edgeDirectedKey(oldFrom, oldTo);
    s.codexUnsavedEdgeKeys.delete(oldKey);
    deleteCodexCordPacketStateForKey(oldKey);
    edge.fromId = oldTo;
    edge.toId = oldFrom;
    markCodexEdgeUnsaved(edge.fromId, edge.toId);

    api.markCodexLayoutDirty();
    redrawCodexEdges();
}

function reverseCodexEdgeForSelectedPair() {
    const selected = api.getSelectedCodexNodesInRoot();
    if (selected.length !== 2) return;
    const ida = selected[0].dataset.codexNodeId;
    const idb = selected[1].dataset.codexNodeId;
    const e = findEdge(ida, idb) || findEdge(idb, ida);
    if (!e) return;
    reverseCodexDirectedEdge(e);
}

function addDirectedCodexEdge(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return false;
    if (findEdge(fromId, toId)) return false;
    if (hasCodexConnectionBetween(fromId, toId)) return false;
    s.codexEdges.push({ fromId, toId });
    markCodexEdgeUnsaved(fromId, toId);
    return true;
}

function removeEdgesTouchingNodeId(nodeId) {
    s.codexEdges.forEach((e) => {
        if (e.fromId === nodeId || e.toId === nodeId) {
            s.codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    });
    const next = s.codexEdges.filter((e) => e.fromId !== nodeId && e.toId !== nodeId);
    if (next.length !== s.codexEdges.length) {
        s.codexEdges = next;
        redrawCodexEdges();
    }
}

function removeEdgesTouchingNodeIds(nodeIds) {
    const idSet = new Set((nodeIds || []).filter(Boolean));
    if (!idSet.size) return;
    s.codexEdges.forEach((e) => {
        if (idSet.has(e.fromId) || idSet.has(e.toId)) {
            s.codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    });
    const next = s.codexEdges.filter((e) => !idSet.has(e.fromId) && !idSet.has(e.toId));
    if (next.length !== s.codexEdges.length) {
        s.codexEdges = next;
        redrawCodexEdges();
    }
}

function removeJunctionAndBridgeEdges(junctionId, removedIds) {
    if (!junctionId) return;
    const skip = new Set(removedIds instanceof Set ? removedIds : [removedIds]);
    skip.delete(junctionId);
    const incoming = s.codexEdges.filter((e) => e.toId === junctionId);
    const outgoing = s.codexEdges.filter((e) => e.fromId === junctionId);
    for (const e of [...incoming, ...outgoing]) {
        s.codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        s.cordDoubleRightLastTs.delete(codexUnorderedPairKey(e.fromId, e.toId));
        const pk = codexUnorderedPairKey(e.fromId, e.toId);
        if (s.cordPendingDeletePairKey === pk) s.cordPendingDeletePairKey = null;
    }
    s.codexEdges = s.codexEdges.filter((e) => e.fromId !== junctionId && e.toId !== junctionId);
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

function removeEdgesForDeletedNodesWithJunctionBridging(ids) {
    const idSet = new Set((ids || []).filter(Boolean));
    if (!idSet.size) return;
    const safety = idSet.size + s.codexEdges.length + 8;
    let guard = 0;
    while (guard++ < safety) {
        const j = api.pickJunctionReadyToSpliceAmongDeleteSet(idSet);
        if (!j) break;
        removeJunctionAndBridgeEdges(j, idSet);
    }
    removeEdgesTouchingNodeIds([...idSet]);
}

function edgeIsCordPendingDelete(edge) {
    return s.cordPendingDeletePairKey === codexUnorderedPairKey(edge.fromId, edge.toId);
}

function edgeCordBioTimelineActive(edge) {
    return isCodexEdgeTimelineActiveForDockPage(edge, s.codexAllNodes, s.codexEdges);
}

function edgeCordIsTimelineRangeInactive(edge) {
    return isCodexEdgeTimelineRangeInactive(edge, s.codexAllNodes, s.codexEdges);
}

function ensureCodexFilterDerivedSets() {
    if (!codexFiltersActive()) return;
    const state = getCodexFilterDerivedState(
        s.codexAllNodes,
        s.codexEdges,
        isCodexLinkFiltersEnabled(),
    );
    s.codexFilterReachableNodeIds = state.reachableNodeIds;
    s.codexFilterLinkedEdgePairKeys = state.linkedEdgePairKeys;
    s.codexFilterActiveEdgePairKeys = state.activeEdgePairKeys;
    s.codexFilterConnectionEndpointNodeIds = state.connectionEndpointNodeIds;
}

function edgeCordIsFilterLinkedActive(edge) {
    if (!codexFiltersActive() || !isCodexLinkFiltersEnabled()) return false;
    ensureCodexFilterDerivedSets();
    const keys = s.codexFilterLinkedEdgePairKeys;
    if (!keys || keys.size === 0) return false;
    return keys.has(codexUnorderedPairKey(edge.fromId, edge.toId));
}

function edgeCordIsHiddenOnBoard(edge) {
    return codexEdgeIsHiddenOnBoard(edge, s.codexAllNodes, s.codexEdges, s.codexConnections);
}

function edgeCordIsFilterDormant(edge) {
    if (!codexFiltersActive()) return false;
    ensureCodexFilterDerivedSets();
    return !codexEdgeMatchesActiveFilters(edge, s.codexFilterActiveEdgePairKeys);
}

function edgeCordPacketPathSimpleOnly() {
    if (!codexFiltersActive() || !isCodexLinkFiltersEnabled()) return false;
    ensureCodexFilterDerivedSets();
    return !!(s.codexFilterLinkedEdgePairKeys && s.codexFilterLinkedEdgePairKeys.size > 0);
}

function edgeCordPacketsEnabled(edge) {
    if (edgeCordIsHiddenOnBoard(edge)) return false;
    if (edgeIsCordPendingDelete(edge)) return false;
    if (edgeCordIsTimelineRangeInactive(edge)) return false;
    if (codexFiltersActive()) {
        if (isCodexLinkFiltersEnabled()) {
            ensureCodexFilterDerivedSets();
            const keys = s.codexFilterLinkedEdgePairKeys;
            if (keys && keys.size > 0) {
                return keys.has(codexUnorderedPairKey(edge.fromId, edge.toId));
            }
        }
        return !edgeCordIsFilterDormant(edge);
    }
    return isDirectedCodexEdgeOnActiveBioConnectionPath(
        edge,
        s.codexAllNodes,
        s.codexEdges,
    );
}

function edgeCordAppearance(edge) {
    if (edgeCordIsHiddenOnBoard(edge)) return 'hidden';
    if (edgeIsCordPendingDelete(edge)) return 'red';
    if (edgeCordShowsYellow(edge)) return 'yellow';
    if (edgeCordIsFilterDormant(edge)) return 'grey';
    if (edgeCordIsFilterLinkedActive(edge)) return 'green';
    if (edgeCordIsTimelineRangeInactive(edge)) return 'violet-dim';
    if (codexFiltersActive()) return 'violet';
    if (!edgeCordBioTimelineActive(edge)) return 'grey';
    return 'violet';
}

/** Junction elbows sit between two segments — grey when either leg is timeline- or filter-dormant. */
function edgeCordAppearanceForJunctionElbow(edgeIn, edgeOut) {
    if (edgeCordIsHiddenOnBoard(edgeIn) || edgeCordIsHiddenOnBoard(edgeOut)) return 'hidden';
    if (edgeIsCordPendingDelete(edgeIn) || edgeIsCordPendingDelete(edgeOut)) return 'red';
    if (edgeCordShowsYellow(edgeIn) || edgeCordShowsYellow(edgeOut)) return 'yellow';
    const inActive = !edgeCordIsFilterDormant(edgeIn);
    const outActive = !edgeCordIsFilterDormant(edgeOut);
    if (!inActive && !outActive) return 'grey';
    if (edgeCordIsFilterLinkedActive(edgeIn) || edgeCordIsFilterLinkedActive(edgeOut)) {
        return 'green';
    }
    if (
        edgeCordIsTimelineRangeInactive(edgeIn)
        || edgeCordIsTimelineRangeInactive(edgeOut)
        || !edgeCordBioTimelineActive(edgeIn)
        || !edgeCordBioTimelineActive(edgeOut)
    ) {
        return 'grey';
    }
    if (codexFiltersActive()) return 'violet';
    return 'violet';
}

function edgeCordIsActivelyUpdating(edge) {
    if (s.codexActiveDragNodeIds.size > 0) {
        if (s.codexActiveDragNodeIds.has(edge.fromId) || s.codexActiveDragNodeIds.has(edge.toId)) {
            return true;
        }
    }
    return false;
}

function edgeCordShowsYellow(edge) {
    return (
        s.codexUnsavedEdgeKeys.has(edgeDirectedKey(edge.fromId, edge.toId))
        || edgeCordIsActivelyUpdating(edge)
    );
}

function clearPendingCodexDeleteState() {
    s.cordPendingDeletePairKey = null;
    s.codexBulkNodeDeleteArmedAt = 0;
    s.cordDoubleRightLastTs.clear();
    if (s.root) {
        s.root.querySelectorAll('.codex-node--pending-delete').forEach((el) => {
            el.classList.remove('codex-node--pending-delete');
        });
    }
}

function codexHasPendingDeleteVisuals() {
    if (s.cordPendingDeletePairKey != null) return true;
    if (s.root && s.root.querySelector('.codex-node--pending-delete')) return true;
    return false;
}

function clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded() {
    const had = codexHasPendingDeleteVisuals();
    clearPendingCodexDeleteState();
    if (had) scheduleRedrawCodexEdges();
}

function buildPolylineForEdge(edge) {
    if (!s.root) return null;
    // Use Map for O(1) lookups instead of querySelector (performance optimization)
    const a = s.codexNodeElements.get(edge.fromId);
    const b = s.codexNodeElements.get(edge.toId);
    if (!a || !b) return null;
    const ca = api.getNodeCenterWorldPx(a);
    const cb = api.getNodeCenterWorldPx(b);
    return [{ x: ca.x, y: ca.y }, { x: cb.x, y: cb.y }];
}

/**
 * Fast plan-time polyline from saved layout (avoids offsetWidth layout reads during load).
 * @param {{ fromId: string, toId: string }} edge
 * @param {Map<string, { id: string, kind?: string, x: number, y: number, scale?: number }>} nodeById
 */
function buildPolylineForEdgeFromSavedLayout(edge, nodeById) {
    const a = nodeById.get(edge.fromId);
    const b = nodeById.get(edge.toId);
    if (!a || !b) return null;
    const ca = codexNodeCenterFromLayoutRecord(a);
    const cb = codexNodeCenterFromLayoutRecord(b);
    if (!ca || !cb) return null;
    return [{ x: ca.x, y: ca.y }, { x: cb.x, y: cb.y }];
}

/** @param {string} fromId @param {string} toId */
function codexDirectedEdgeAllowedForPacketWalk(fromId, toId) {
    const edge = findEdge(fromId, toId);
    if (!edge) return false;
    if (edgeCordIsTimelineRangeInactive(edge)) return false;

    if (codexFiltersActive()) {
        ensureCodexFilterDerivedSets();
        return codexEdgeMatchesActiveFilters(edge, s.codexFilterActiveEdgePairKeys);
    }

    if (!isDirectedCodexEdgeOnActiveBioConnectionPath(edge, s.codexAllNodes, s.codexEdges)) {
        return false;
    }

    if (!s.codexTargetedSelectionActive) return true;
    const visible = s.codexTargetedSelectionVisibleIds;
    const edgeKeys = s.codexTargetedSelectionVisibleEdgeKeys;
    if (!visible?.size) return false;
    if (!visible.has(fromId) || !visible.has(toId)) return false;
    if (edgeKeys?.size) {
        return edgeKeys.has(codexUnorderedPairKey(fromId, toId));
    }
    return true;
}

function samplePacketTailNodeIds(fromId, toId) {
    if (!api.codexNodeIsJunctionWaypoint(toId)) return [];
    const tail = [];
    let cur = toId;
    let prev = fromId;
    while (api.codexNodeIsJunctionWaypoint(cur)) {
        const outs = s.codexEdges.filter(
            (e) => e.fromId === cur
                && e.toId !== prev
                && codexDirectedEdgeAllowedForPacketWalk(e.fromId, e.toId)
                && (
                    codexFiltersActive()
                    || isDirectedCodexEdgeOnActiveBioConnectionPath(
                        e,
                        s.codexAllNodes,
                        s.codexEdges,
                    )
                ),
        );
        if (outs.length === 0) break;
        const pick = outs.length === 1
            ? outs[0]
            : outs[Math.floor(Math.random() * outs.length)];
        tail.push(pick.toId);
        prev = cur;
        cur = pick.toId;
    }
    return tail;
}

function tryBuildPacketWorldPoints(fromId, toId, tailNodeIds) {
    const ids = [fromId, toId, ...tailNodeIds];
    const pts = [];
    for (let i = 0; i < ids.length; i++) {
        const el = api.codexNodeElById(ids[i]);
        if (!el) return null;
        pts.push(api.getNodeCenterWorldPx(el));
    }
    for (let i = 0; i < ids.length - 1; i++) {
        if (!findEdge(ids[i], ids[i + 1])) return null;
    }
    return pts;
}

function appendCodexEdgeNodeMask(defs, ns, vw, vh, maskWorldRect = null) {
    appendCodexEdgeNodeMaskCore(defs, ns, vw, vh, maskWorldRect, {
        getRoot: () => s.root,
        maskId: CODEX_EDGES_NODE_ALPHA_MASK_ID
    });
}

/** @type {number} */
let edgeNodeMaskSyncRaf = 0;

function syncCodexEdgeNodeMaskDom() {
    const root = s.root;
    if (!root) return false;
    const svg = root.querySelector('.codex-edges-layer');
    const defs = svg?.querySelector('defs');
    if (!svg || !defs) return false;

    const oldMask = defs.querySelector(`#${CODEX_EDGES_NODE_ALPHA_MASK_ID}`);
    if (oldMask) oldMask.remove();

    const ns = 'http://www.w3.org/2000/svg';
    const worldEl = s.codexWorldEl;
    const vw = worldEl ? CODEX_WORLD_W : Math.max(1, root.clientWidth);
    const vh = worldEl ? CODEX_WORLD_H : Math.max(1, root.clientHeight);
    appendCodexEdgeNodeMask(defs, ns, vw, vh, null);
    return true;
}

function scheduleCodexEdgeNodeMaskSync() {
    if (!s.root) return;
    if (edgeNodeMaskSyncRaf) cancelAnimationFrame(edgeNodeMaskSyncRaf);
    edgeNodeMaskSyncRaf = requestAnimationFrame(() => {
        edgeNodeMaskSyncRaf = 0;
        syncCodexEdgeNodeMaskDom();
    });
}

function codexEffectivePacketStrokeRange() {
    const base = s.codexVisualPrefs.cordThickness * s.codexVisualPrefs.packetThicknessMult;
    return { min: base * 0.97, max: base * 1.03 };
}

function appendCodexJunctionElbowParallelograms(parentG, ns, worldCullRect = null, edgesOverride = null) {
    appendCodexJunctionElbowParallelogramsCore(parentG, ns, worldCullRect, {
        getRoot: () => s.root,
        getEdges: () => edgesOverride || s.codexEdges,
        codexNodeElById: api.codexNodeElById,
        getNodeCenterWorldPx: api.getNodeCenterWorldPx,
        edgeCordAppearance: (eIn, eOut) => edgeCordAppearanceForJunctionElbow(eIn, eOut),
        getCordColorHex: () => s.codexVisualPrefs.cordColor
    });
}

function codexChainWalkMaxSteps() {
    return Math.max(8, (Array.isArray(s.codexEdges) ? s.codexEdges.length : 0) + 2);
}

/**
 * Follow junctions upstream from `startId` (away from `awayId`) to the bio anchor on that side.
 * @param {string} startId
 * @param {string} awayId
 * @returns {string}
 */
function resolveCodexChainUpstreamBioEndpoint(startId, awayId) {
    if (!startId) return startId;
    let cur = startId;
    let forbid = awayId;
    let steps = 0;
    const maxSteps = codexChainWalkMaxSteps();
    while (steps < maxSteps && api.codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const inc = s.codexEdges.filter((e) => e && e.toId === cur && e.fromId !== forbid);
        if (inc.length !== 1) break;
        forbid = cur;
        cur = inc[0].fromId;
    }
    return cur;
}

/**
 * Follow junctions downstream from `startId` (away from `awayId`) to the bio anchor on that side.
 * @param {string} startId
 * @param {string} awayId
 * @returns {string}
 */
function resolveCodexChainDownstreamBioEndpoint(startId, awayId) {
    if (!startId) return startId;
    let cur = startId;
    let forbid = awayId;
    let steps = 0;
    const maxSteps = codexChainWalkMaxSteps();
    while (steps < maxSteps && api.codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const outs = s.codexEdges.filter((e) => e && e.fromId === cur && e.toId !== forbid);
        if (outs.length !== 1) break;
        forbid = cur;
        cur = outs[0].toId;
    }
    return cur;
}

/**
 * Bio nodes at each end of a cord chain through simple break waypoints (same walk as hover).
 * @param {string} fromId
 * @param {string} toId
 * @returns {{ subjectId: string, otherId: string }}
 */
function resolveCodexChainBioEndpoints(fromId, toId) {
    return {
        subjectId: resolveCodexChainUpstreamBioEndpoint(fromId, toId),
        otherId: resolveCodexChainDownstreamBioEndpoint(toId, fromId),
    };
}

function collectCodexDirectedChainEdgeKeys(fromId, toId) {
    const keys = new Set();
    if (!fromId || !toId || fromId === toId || !Array.isArray(s.codexEdges)) return keys;
    const addK = (a, b) => {
        if (a && b && a !== b) keys.add(edgeDirectedKey(a, b));
    };
    addK(fromId, toId);
    let cur = fromId;
    let forbidFrom = toId;
    let steps = 0;
    const maxSteps = codexChainWalkMaxSteps();
    while (steps < maxSteps && api.codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const inc = s.codexEdges.filter((e) => e && e.toId === cur && e.fromId !== forbidFrom);
        if (inc.length !== 1) break;
        const e = inc[0];
        addK(e.fromId, e.toId);
        forbidFrom = cur;
        cur = e.fromId;
    }
    cur = toId;
    let forbidTo = fromId;
    steps = 0;
    while (steps < maxSteps && api.codexNodeKindById(cur) === 'junction') {
        steps += 1;
        const outs = s.codexEdges.filter((e) => e && e.fromId === cur && e.toId !== forbidTo);
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
    if (!s.root || !fromId || !toId) return;
    const svg = s.root.querySelector('.codex-edges-layer');
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

/** @param {Set<string>|null} chain */
function syncCodexElbowHoverVisual(chain) {
    if (!s.root) return;
    const contentRoot = s.root.querySelector('.codex-edges-layer .codex-edges-masked');
    if (!contentRoot) return;

    contentRoot.querySelectorAll('g[data-codex-elbow-junction]').forEach((g) => {
        g.classList.remove('codex-edge-elbow-group--hover');
    });

    if (!chain?.size) return;

    contentRoot.querySelectorAll('g[data-codex-elbow-junction]').forEach((g) => {
        const inFrom = g.getAttribute('data-codex-elbow-in-from');
        const jId = g.getAttribute('data-codex-elbow-junction');
        const outTo = g.getAttribute('data-codex-elbow-out-to');
        if (!inFrom || !jId || !outTo) return;
        if (chain.has(edgeDirectedKey(inFrom, jId)) && chain.has(edgeDirectedKey(jId, outTo))) {
            g.classList.add('codex-edge-elbow-group--hover');
        }
    });
}

function clearAllCodexEdgeHoverVisual() {
    s.codexEdgeHoverChainKeySet = null;
    if (!s.root) return;
    const svg = s.root.querySelector('.codex-edges-layer');
    if (!svg) return;
    svg.querySelectorAll('g.codex-edge-segment-group--hover').forEach((g) => {
        g.classList.remove('codex-edge-segment-group--hover');
    });
    syncCodexElbowHoverVisual(null);
}

/**
 * Directed cord keys along a node path (each hop uses junction chain expansion).
 * @param {string[]} pathNodeIds
 * @returns {Set<string>}
 */
function collectCodexPathRouteDirectedEdgeKeys(pathNodeIds) {
    const keys = new Set();
    if (!Array.isArray(pathNodeIds) || pathNodeIds.length < 2) return keys;
    for (let i = 0; i < pathNodeIds.length - 1; i += 1) {
        const a = pathNodeIds[i];
        const b = pathNodeIds[i + 1];
        const forward = findEdge(a, b);
        const back = forward ? null : findEdge(b, a);
        const ed = forward || back;
        if (!ed) continue;
        const chain = collectCodexDirectedChainEdgeKeys(ed.fromId, ed.toId);
        chain.forEach((k) => keys.add(k));
    }
    return keys;
}

/** @param {Set<string>} chain */
function applyCodexEdgeHoverChainKeySet(chain) {
    clearAllCodexEdgeHoverVisual();
    s.codexEdgeHoverChainKeySet = chain;
    chain.forEach((key) => {
        const sep = key.indexOf('\x1e');
        if (sep < 0) return;
        const a = key.slice(0, sep);
        const b = key.slice(sep + 1);
        const edge = findEdge(a, b) || findEdge(b, a);
        if (edge && edgeCordIsFilterDormant(edge)) return;
        setCodexEdgeHoverVisual(a, b, true);
    });
    syncCodexElbowHoverVisual(chain);
}

/** @returns {string} */
function getSingleTargetedSelectionSeedId() {
    if (!s.codexTargetedSelectionActive || s.codexTargetedSelectionSeedIds.size !== 1) return '';
    return [...s.codexTargetedSelectionSeedIds][0] || '';
}

/**
 * Shortest route cords between two nodes (same highlight as cord hover).
 * @param {string} fromId
 * @param {string} toId
 */
function highlightCodexRouteBetweenNodes(fromId, toId) {
    if (!fromId || !toId) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    if (fromId === toId) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    const adj = buildCodexUndirectedAdjacency(s.codexEdges || []);
    const kindById = buildCodexNodeKindMapFromSession();
    const restrict = s.codexTargetedSelectionActive
        ? s.codexTargetedSelectionVisibleIds
        : undefined;
    const path = shortestPathNodeIdsForTargetedRoutePreview(
        adj,
        kindById,
        fromId,
        toId,
        restrict,
    );
    if (!path?.length) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    const chain = collectCodexPathRouteDirectedEdgeKeys(path);
    if (s.codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(s.codexEdgeHoverChainKeySet, chain)) {
        return;
    }
    applyCodexEdgeHoverChainKeySet(chain);
}

/** @returns {Map<string, Set<string>>} */
function buildCodexFilterRouteAdjacency() {
    ensureCodexFilterDerivedSets();
    const edges = s.codexEdges || [];
    const activeKeys = s.codexFilterActiveEdgePairKeys;
    const filtered = edges.filter((e) => codexEdgeMatchesActiveFilters(e, activeKeys));
    return buildCodexUndirectedAdjacency(filtered);
}

/**
 * @param {string} hoveredId
 * @returns {Set<string>}
 */
function buildCodexFilterRouteRestrictNodeIds(hoveredId) {
    ensureCodexFilterDerivedSets();
    /** @type {Set<string>} */
    const restrict = new Set(s.codexFilterReachableNodeIds || []);
    if (hoveredId) restrict.add(hoveredId);
    return restrict;
}

/** @param {string} nodeId */
function highlightCodexFilterIncidentEdges(nodeId) {
    if (!nodeId) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    /** @type {Set<string>} */
    const keys = new Set();
    for (const e of s.codexEdges || []) {
        if (e.fromId !== nodeId && e.toId !== nodeId) continue;
        if (edgeCordIsFilterDormant(e)) continue;
        const chain = collectCodexDirectedChainEdgeKeys(e.fromId, e.toId);
        chain.forEach((k) => keys.add(k));
    }
    if (s.codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(s.codexEdgeHoverChainKeySet, keys)) {
        return;
    }
    applyCodexEdgeHoverChainKeySet(keys);
}

/**
 * Shortest active-filter route from a filter seed to the hovered portrait.
 * @param {string} hoveredId
 */
function highlightCodexFilterRouteToNode(hoveredId) {
    if (!hoveredId) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    const seeds = resolveCodexNodeIdsForActiveFilters(s.codexAllNodes);
    if (!seeds.length) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    const adj = buildCodexFilterRouteAdjacency();
    const kindById = buildCodexNodeKindMapFromSession();
    const restrict = buildCodexFilterRouteRestrictNodeIds(hoveredId);

    /** @type {string[]|null} */
    let bestPath = null;
    for (let i = 0; i < seeds.length; i += 1) {
        const seedId = seeds[i];
        if (seedId === hoveredId) continue;
        const path = shortestPathNodeIdsForTargetedRoutePreview(
            adj,
            kindById,
            seedId,
            hoveredId,
            restrict,
        );
        if (!path?.length) continue;
        if (!bestPath || path.length < bestPath.length) bestPath = path;
    }

    if (!bestPath?.length) {
        clearAllCodexEdgeHoverVisual();
        return;
    }
    const chain = collectCodexPathRouteDirectedEdgeKeys(bestPath);
    if (s.codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(s.codexEdgeHoverChainKeySet, chain)) {
        return;
    }
    applyCodexEdgeHoverChainKeySet(chain);
}

/** @param {HTMLElement} nodeEl */
function onCodexNodeTargetedRoutePointerEnter(nodeEl) {
    if (!s.codexTargetedSelectionActive || s.codexTargetedSelectionSeedIds.size !== 1) return;
    if (!nodeEl || nodeEl.classList.contains('codex-node--target-hidden')) return;
    const hoveredId = nodeEl.dataset.codexNodeId || '';
    const seedId = getSingleTargetedSelectionSeedId();
    if (!hoveredId || !seedId) return;
    highlightCodexRouteBetweenNodes(seedId, hoveredId);
}

/** @param {HTMLElement} nodeEl */
function onCodexNodeFilterRoutePointerEnter(nodeEl) {
    if (!codexFiltersActive()) return;
    if (s.codexTargetedSelectionActive && s.codexTargetedSelectionSeedIds.size === 1) return;
    if (!nodeEl || nodeEl.classList.contains('codex-node--filtered-out')) return;

    const hoveredId = String(nodeEl.dataset.codexNodeId || '');
    if (!hoveredId) return;

    if (nodeEl.classList.contains('codex-node--filter-connected')) {
        highlightCodexFilterRouteToNode(hoveredId);
        return;
    }
    if (nodeEl.classList.contains('codex-node--filter-match')) {
        highlightCodexFilterIncidentEdges(hoveredId);
    }
}

/**
 * @param {PointerEvent} e
 * @param {HTMLElement} nodeEl
 */
function onCodexNodeTargetedRoutePointerLeave(e, nodeEl) {
    if (!s.codexTargetedSelectionActive || s.codexTargetedSelectionSeedIds.size !== 1) return;
    const rel = /** @type {Node|null} */ (e.relatedTarget);
    if (rel instanceof Element && s.root?.contains(rel)) {
        if (rel.closest('.codex-node')) return;
        if (rel.closest('.codex-edge-hit')) return;
    }
    if (nodeEl && rel && nodeEl.contains(rel)) return;
    clearAllCodexEdgeHoverVisual();
}

/**
 * @param {PointerEvent} e
 * @param {HTMLElement} nodeEl
 */
function onCodexNodeFilterRoutePointerLeave(e, nodeEl) {
    if (!codexFiltersActive()) return;
    if (s.codexTargetedSelectionActive && s.codexTargetedSelectionSeedIds.size === 1) return;
    const rel = /** @type {Node|null} */ (e.relatedTarget);
    if (rel instanceof Element && s.root?.contains(rel)) {
        if (rel.closest('.codex-node:not(.codex-node--filtered-out)')) return;
        if (rel.closest('.codex-edge-hit')) return;
    }
    if (nodeEl && rel && nodeEl.contains(rel)) return;
    clearAllCodexEdgeHoverVisual();
}

function codexEdgeHitIsFilterDormant(hitEl) {
    const f = hitEl?.dataset?.codexEdgeFrom || '';
    const to = hitEl?.dataset?.codexEdgeTo || '';
    if (!f || !to) return false;
    const edge = findEdge(f, to) || findEdge(to, f);
    if (!edge) return false;
    return edgeCordIsFilterDormant(edge);
}

function onCodexEdgeSvgPointerOver(e) {
    if (s.codexMode !== 'view') return;
    const t = /** @type {Element} */ (e.target);
    if (!t?.classList?.contains('codex-edge-hit')) return;
    if (codexEdgeHitIsFilterDormant(t)) return;
    const f = t.dataset.codexEdgeFrom;
    const to = t.dataset.codexEdgeTo;
    if (!f || !to) return;
    const chain = collectCodexDirectedChainEdgeKeys(f, to);
    if (s.codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(s.codexEdgeHoverChainKeySet, chain)) {
        return;
    }
    applyCodexEdgeHoverChainKeySet(chain);
}

function onCodexEdgeSvgPointerOut(e) {
    if (s.codexMode !== 'view') return;
    const t = /** @type {Element} */ (e.target);
    if (!t?.classList?.contains('codex-edge-hit')) return;
    const rel = e.relatedTarget;
    if (rel && s.codexEdgesSvgEl && s.codexEdgesSvgEl.contains(rel)) {
        const nextHit = typeof rel.closest === 'function' ? rel.closest('.codex-edge-hit') : null;
        if (nextHit) {
            const nf = nextHit.dataset.codexEdgeFrom || '';
            const nt = nextHit.dataset.codexEdgeTo || '';
            const nk = nf && nt ? edgeDirectedKey(nf, nt) : '';
            if (nk && s.codexEdgeHoverChainKeySet?.has(nk)) {
                return;
            }
        }
    }
    clearAllCodexEdgeHoverVisual();
}

function codexSvgPointerDownCapture(e) {
    if (!s.root || !s.codexEdgesSvgEl) return;
    api.cancelBackgroundPanPointerPending();
    const t = /** @type {SVGElement} */ (e.target);
    if (!t || !t.classList) return;
    if (t.closest && (t.closest('.codex-toolbar') || t.closest('.codex-visual-panel'))) return;

    if (e.button === 0 && t.classList.contains('codex-edge-hit')) {
        if (codexEdgeHitIsFilterDormant(t)) return;
        if (s.codexMode === 'view') {
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
        api.cancelPointerPending();
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        api.armCodexBackgroundPanPendingFromEvent(e);
        return;
    }

    if (e.button === 0) {
        clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    }
}

function codexEscapeEdgeIdForSelector(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(String(id));
    }
    return String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function openStoryArchiveFromCodexEdgeHit(fromId, toId) {
    if (s.codexMode !== 'view' || !fromId || !toId) return;
    const edge = findEdge(fromId, toId) || findEdge(toId, fromId);
    if (edge && edgeCordIsFilterDormant(edge)) return;
    const { subjectId, otherId } = resolveCodexChainBioEndpoints(fromId, toId);
    const tryOpen = (subjectEl, otherEl) => {
        if (!subjectEl || !api.codexNodeElSupportsStoryArchiveLink(subjectEl)) return false;
        playSoundEffect('nodeSelect');
        const spec = api.codexBioLinkSpecFromNodeEl(otherEl);
        api.maybeOpenStoryArchiveFromCodexNodeEl(subjectEl, { codexConnectionHighlight: spec });
        return true;
    };
    if (tryOpen(s.codexNodeElements.get(subjectId), s.codexNodeElements.get(otherId))) return;
    if (tryOpen(s.codexNodeElements.get(otherId), s.codexNodeElements.get(subjectId))) return;
}

api.findEdge = findEdge;
api.hasCodexConnectionBetween = hasCodexConnectionBetween;
api.markCodexEdgeUnsaved = markCodexEdgeUnsaved;
api.markIncidentCodexEdgesUnsaved = markIncidentCodexEdgesUnsaved;
api.removeCodexEdgeDirected = removeCodexEdgeDirected;
api.reverseCodexDirectedEdge = reverseCodexDirectedEdge;
api.reverseCodexEdgeForSelectedPair = reverseCodexEdgeForSelectedPair;
api.addDirectedCodexEdge = addDirectedCodexEdge;
api.removeEdgesTouchingNodeId = removeEdgesTouchingNodeId;
api.removeEdgesTouchingNodeIds = removeEdgesTouchingNodeIds;
api.removeJunctionAndBridgeEdges = removeJunctionAndBridgeEdges;
api.removeEdgesForDeletedNodesWithJunctionBridging = removeEdgesForDeletedNodesWithJunctionBridging;
api.edgeIsCordPendingDelete = edgeIsCordPendingDelete;
api.edgeCordAppearance = edgeCordAppearance;
api.edgeCordAppearanceForJunctionElbow = edgeCordAppearanceForJunctionElbow;
api.edgeCordIsFilterDormant = edgeCordIsFilterDormant;
api.edgeCordPacketsEnabled = edgeCordPacketsEnabled;
api.edgeCordPacketPathSimpleOnly = edgeCordPacketPathSimpleOnly;
api.edgeCordBioTimelineActive = edgeCordBioTimelineActive;
api.edgeCordIsActivelyUpdating = edgeCordIsActivelyUpdating;
api.edgeCordShowsYellow = edgeCordShowsYellow;
api.clearPendingCodexDeleteState = clearPendingCodexDeleteState;
api.codexHasPendingDeleteVisuals = codexHasPendingDeleteVisuals;
api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded = clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded;
api.buildPolylineForEdge = buildPolylineForEdge;
api.buildPolylineForEdgeFromSavedLayout = buildPolylineForEdgeFromSavedLayout;
api.samplePacketTailNodeIds = samplePacketTailNodeIds;
api.tryBuildPacketWorldPoints = tryBuildPacketWorldPoints;
api.appendCodexEdgeNodeMask = appendCodexEdgeNodeMask;
api.scheduleCodexEdgeNodeMaskSync = scheduleCodexEdgeNodeMaskSync;
api.syncCodexEdgeNodeMaskDom = syncCodexEdgeNodeMaskDom;
api.codexEffectivePacketStrokeRange = codexEffectivePacketStrokeRange;
api.appendCodexJunctionElbowParallelograms = appendCodexJunctionElbowParallelograms;
api.collectCodexDirectedChainEdgeKeys = collectCodexDirectedChainEdgeKeys;
api.resolveCodexChainBioEndpoints = resolveCodexChainBioEndpoints;
api.codexEdgeHoverChainSetsEqual = codexEdgeHoverChainSetsEqual;
api.setCodexEdgeHoverVisual = setCodexEdgeHoverVisual;
api.clearAllCodexEdgeHoverVisual = clearAllCodexEdgeHoverVisual;
api.applyCodexEdgeHoverChainKeySet = applyCodexEdgeHoverChainKeySet;
api.highlightCodexRouteBetweenNodes = highlightCodexRouteBetweenNodes;
api.onCodexNodeTargetedRoutePointerEnter = onCodexNodeTargetedRoutePointerEnter;
api.onCodexNodeTargetedRoutePointerLeave = onCodexNodeTargetedRoutePointerLeave;
api.onCodexNodeFilterRoutePointerEnter = onCodexNodeFilterRoutePointerEnter;
api.onCodexNodeFilterRoutePointerLeave = onCodexNodeFilterRoutePointerLeave;
api.onCodexEdgeSvgPointerOver = onCodexEdgeSvgPointerOver;
api.onCodexEdgeSvgPointerOut = onCodexEdgeSvgPointerOut;
api.codexSvgPointerDownCapture = codexSvgPointerDownCapture;
api.codexEscapeEdgeIdForSelector = codexEscapeEdgeIdForSelector;
api.openStoryArchiveFromCodexEdgeHit = openStoryArchiveFromCodexEdgeHit;

