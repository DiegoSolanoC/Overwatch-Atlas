/** CodexEdgeStore — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_EDGES_NODE_ALPHA_MASK_ID } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { codexUnorderedPairKey, edgeDirectedKey } from '../topology/CodexGraphPrimitives.js';
import { hasCodexConnectionBetween as topologyHasUndirectedLink } from '../topology/CodexGraphTopology.js';
import { playSoundEffect } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { appendCodexJunctionElbowParallelograms as appendCodexJunctionElbowParallelogramsCore } from '../../codex-node-drawing/junction-decor/CodexJunctionElbowParallelograms.js';
import { deleteCodexCordPacketStateForKey } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges, scheduleRedrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { appendCodexEdgeNodeMask as appendCodexEdgeNodeMaskCore } from '../../codex-node-drawing/svg/CodexNodeFrameSvg.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


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

function edgeCordAppearance(edge) {
    if (edgeIsCordPendingDelete(edge)) return 'red';
    if (edgeCordShowsYellow(edge)) return 'yellow';
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

function samplePacketTailNodeIds(fromId, toId) {
    if (!api.codexNodeIsJunctionWaypoint(toId)) return [];
    const tail = [];
    let cur = toId;
    let prev = fromId;
    while (api.codexNodeIsJunctionWaypoint(cur)) {
        const outs = s.codexEdges.filter((e) => e.fromId === cur && e.toId !== prev);
        if (outs.length === 0) break;
        const pick = outs[Math.floor(Math.random() * outs.length)];
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
        getDebugUiVisible: () => s.codexDebugUiVisible,
        maskId: CODEX_EDGES_NODE_ALPHA_MASK_ID
    });
}

function codexEffectivePacketStrokeRange() {
    const base = s.codexVisualPrefs.cordThickness * s.codexVisualPrefs.packetThicknessMult;
    return { min: base * 0.97, max: base * 1.03 };
}

function appendCodexJunctionElbowParallelograms(parentG, ns, worldCullRect = null) {
    appendCodexJunctionElbowParallelogramsCore(parentG, ns, worldCullRect, {
        getRoot: () => s.root,
        getEdges: () => s.codexEdges,
        codexNodeElById: api.codexNodeElById,
        getNodeCenterWorldPx: api.getNodeCenterWorldPx,
        edgeCordAppearance: api.edgeCordAppearance,
        getCordColorHex: () => s.codexVisualPrefs.cordColor
    });
}

function collectCodexDirectedChainEdgeKeys(fromId, toId) {
    const keys = new Set();
    if (!fromId || !toId || fromId === toId || !Array.isArray(s.codexEdges)) return keys;
    const maxSteps = Math.max(8, s.codexEdges.length + 2);
    const addK = (a, b) => {
        if (a && b && a !== b) keys.add(edgeDirectedKey(a, b));
    };
    addK(fromId, toId);
    let cur = fromId;
    let forbidFrom = toId;
    let steps = 0;
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

function clearAllCodexEdgeHoverVisual() {
    s.codexEdgeHoverChainKeySet = null;
    if (!s.root) return;
    const svg = s.root.querySelector('.codex-edges-layer');
    if (!svg) return;
    svg.querySelectorAll('g.codex-edge-segment-group--hover').forEach((g) => {
        g.classList.remove('codex-edge-segment-group--hover');
    });
}

function onCodexEdgeSvgPointerOver(e) {
    if (s.codexMode !== 'view') return;
    const t = /** @type {Element} */ (e.target);
    if (!t?.classList?.contains('codex-edge-hit')) return;
    const f = t.dataset.codexEdgeFrom;
    const to = t.dataset.codexEdgeTo;
    if (!f || !to) return;
    const chain = collectCodexDirectedChainEdgeKeys(f, to);
    if (s.codexEdgeHoverChainKeySet && codexEdgeHoverChainSetsEqual(s.codexEdgeHoverChainKeySet, chain)) {
        return;
    }
    clearAllCodexEdgeHoverVisual();
    s.codexEdgeHoverChainKeySet = chain;
    chain.forEach((key) => {
        const sep = key.indexOf('\x1e');
        if (sep < 0) return;
        const a = key.slice(0, sep);
        const b = key.slice(sep + 1);
        setCodexEdgeHoverVisual(a, b, true);
    });
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
    if (s.codexMode !== 'view' || !fromId) return;
    const tryOpen = (subjectEl, otherEl) => {
        if (!subjectEl || !api.codexNodeElSupportsStoryArchiveLink(subjectEl)) return false;
        playSoundEffect('nodeSelect');
        const spec = api.codexBioLinkSpecFromNodeEl(otherEl);
        api.maybeOpenStoryArchiveFromCodexNodeEl(subjectEl, { codexConnectionHighlight: spec });
        return true;
    };
    if (tryOpen(s.codexNodeElements.get(fromId), s.codexNodeElements.get(toId))) return;
    if (toId && tryOpen(s.codexNodeElements.get(toId), s.codexNodeElements.get(fromId))) return;
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
api.edgeCordIsActivelyUpdating = edgeCordIsActivelyUpdating;
api.edgeCordShowsYellow = edgeCordShowsYellow;
api.clearPendingCodexDeleteState = clearPendingCodexDeleteState;
api.codexHasPendingDeleteVisuals = codexHasPendingDeleteVisuals;
api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded = clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded;
api.buildPolylineForEdge = buildPolylineForEdge;
api.samplePacketTailNodeIds = samplePacketTailNodeIds;
api.tryBuildPacketWorldPoints = tryBuildPacketWorldPoints;
api.appendCodexEdgeNodeMask = appendCodexEdgeNodeMask;
api.codexEffectivePacketStrokeRange = codexEffectivePacketStrokeRange;
api.appendCodexJunctionElbowParallelograms = appendCodexJunctionElbowParallelograms;
api.collectCodexDirectedChainEdgeKeys = collectCodexDirectedChainEdgeKeys;
api.codexEdgeHoverChainSetsEqual = codexEdgeHoverChainSetsEqual;
api.setCodexEdgeHoverVisual = setCodexEdgeHoverVisual;
api.clearAllCodexEdgeHoverVisual = clearAllCodexEdgeHoverVisual;
api.onCodexEdgeSvgPointerOver = onCodexEdgeSvgPointerOver;
api.onCodexEdgeSvgPointerOut = onCodexEdgeSvgPointerOut;
api.codexSvgPointerDownCapture = codexSvgPointerDownCapture;
api.codexEscapeEdgeIdForSelector = codexEscapeEdgeIdForSelector;
api.openStoryArchiveFromCodexEdgeHit = openStoryArchiveFromCodexEdgeHit;

