/** CodexJunctionOps — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { updateAppStatus } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { edgeDirectedKey, generateNodeId } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';
import { CODEX_JUNCTION_BASE_PX, resolveCodexNodeScale } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { scheduleUpdateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';


function junctionTopLeftBetweenNodeElements(elFrom, elTo) {
    const cA = api.getNodeCenterWorldPx(elFrom);
    const cB = api.getNodeCenterWorldPx(elTo);
    const mx = (cA.x + cB.x) / 2;
    const my = (cA.y + cB.y) / 2;
    const scale = resolveCodexNodeScale('junction', undefined);
    const dim = CODEX_JUNCTION_BASE_PX * scale;
    const x = mx - dim / 2;
    const y = my - dim / 2;
    return api.clampCodexNodeTopLeftToWorld(x, y, scale, 'junction');
}

function insertCodexBreakBetweenSelectedPair() {
    if (s.codexMode !== 'dev') return;
    const selected = api.getSelectedCodexNodesInRoot();
    if (selected.length !== 2) return;
    const elA = selected[0];
    const elB = selected[1];
    const ida = elA.dataset.codexNodeId;
    const idb = elB.dataset.codexNodeId;
    if (!ida || !idb || ida === idb) return;

    const existing = api.findEdge(ida, idb) || api.findEdge(idb, ida);
    let fromId;
    let toId;
    let elFrom;
    let elTo;
    if (existing) {
        fromId = existing.fromId;
        toId = existing.toId;
        elFrom = s.codexNodeElements.get(fromId);
        elTo = s.codexNodeElements.get(toId);
        if (!elFrom || !elTo) return;
        api.removeCodexEdgeDirected(fromId, toId);
    } else {
        fromId = ida;
        toId = idb;
        elFrom = elA;
        elTo = elB;
    }

    const { x: jx, y: jy } = junctionTopLeftBetweenNodeElements(elFrom, elTo);
    const jId = generateNodeId();
    api.placeCodexNode(jx, jy, 'junction', null, null, { fromSaved: false, id: jId, skipRedraw: true });

    const added1 = api.addDirectedCodexEdge(fromId, jId);
    const added2 = api.addDirectedCodexEdge(jId, toId);
    if (!added1 || !added2) {
        updateAppStatus('Could not add links through the new break node (duplicate or invalid).', 'warning');
    }

    const elJ = s.codexNodeElements.get(jId);
    if (elFrom && elJ) {
        api.markNodeVisualUnsaved(elFrom);
        api.markNodeVisualUnsaved(elJ);
    }
    if (elTo) api.markNodeVisualUnsaved(elTo);
    api.markCodexLayoutDirty();
    redrawCodexEdges();
    scheduleUpdateCodexVirtualScroll();
    api.selectCodexNodesPair(elFrom, elJ, elJ);
    updateAppStatus('Inserted break waypoint between the two nodes.', 'success');
}

function mergeCodexJunctionPairKeepPrimary(primaryId, secondaryId) {
    if (!primaryId || !secondaryId || primaryId === secondaryId || !Array.isArray(s.codexAllNodes) || !Array.isArray(s.codexEdges)) {
        return false;
    }
    const p = s.codexAllNodes.find((n) => n && n.id === primaryId);
    const secNode = s.codexAllNodes.find((n) => n && n.id === secondaryId);
    if (!p || !secNode || p.kind !== 'junction' || secNode.kind !== 'junction') return false;

    const next = [];
    const seen = new Set();
    const take = (f, t) => {
        if (!f || !t || f === t) return;
        const k = edgeDirectedKey(f, t);
        if (seen.has(k)) return;
        seen.add(k);
        next.push({ fromId: f, toId: t });
    };
    for (let i = 0; i < s.codexEdges.length; i += 1) {
        const e = s.codexEdges[i];
        if (!e || !e.fromId || !e.toId) continue;
        let f = e.fromId;
        let t = e.toId;
        if (f === secondaryId) f = primaryId;
        if (t === secondaryId) t = primaryId;
        take(f, t);
    }
    s.codexEdges = next;

    s.codexAllNodes = s.codexAllNodes.filter((n) => n && n.id !== secondaryId);
    const elS = s.codexNodeElements.get(secondaryId);
    if (elS) {
        s.codexSelectedNodeEls.delete(elS);
        if (s.codexPrimarySelectedNodeEl === elS) {
            s.codexPrimarySelectedNodeEl = s.codexNodeElements.get(primaryId) || null;
        }
        if (elS.parentNode) elS.remove();
    }
    api.unregisterCodexNodeRenderTracking(secondaryId);
    s.codexNodeElements.delete(secondaryId);

    const elP = s.codexNodeElements.get(primaryId);
    if (elP) {
        api.markNodeVisualUnsaved(elP);
        api.markCodexLayoutDirty();
        redrawCodexEdges();
        scheduleUpdateCodexVirtualScroll();
        api.selectCodexNode(elP);
        updateAppStatus('Merged two break nodes into one at the primary selection.', 'success');
        return true;
    }
    api.markCodexLayoutDirty();
    redrawCodexEdges();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus('Merged junctions; primary DOM was missing — check the board.', 'warning');
    return true;
}

function mergeCodexSelectedJunctionPair() {
    if (s.codexMode !== 'dev') return;
    const selected = api.getSelectedCodexNodesInRoot();
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

function pickJunctionReadyToSpliceAmongDeleteSet(deleteSet) {
    for (const id of deleteSet) {
        if (api.codexNodeKindById(id) !== 'junction') continue;
        const incoming = s.codexEdges.filter((e) => e.toId === id);
        const outgoing = s.codexEdges.filter((e) => e.fromId === id);
        if (!incoming.length && !outgoing.length) continue;
        const predsOk = incoming.length === 0 || incoming.every((e) => !deleteSet.has(e.fromId));
        if (predsOk) return id;
    }
    return null;
}

api.junctionTopLeftBetweenNodeElements = junctionTopLeftBetweenNodeElements;
api.insertCodexBreakBetweenSelectedPair = insertCodexBreakBetweenSelectedPair;
api.mergeCodexJunctionPairKeepPrimary = mergeCodexJunctionPairKeepPrimary;
api.mergeCodexSelectedJunctionPair = mergeCodexSelectedJunctionPair;
api.pickJunctionReadyToSpliceAmongDeleteSet = pickJunctionReadyToSpliceAmongDeleteSet;

