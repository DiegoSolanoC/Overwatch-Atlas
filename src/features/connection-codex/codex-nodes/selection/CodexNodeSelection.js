/** CodexNodeSelection — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_WORLD_H, CODEX_WORLD_W } from '../../codex-data/persistence/CodexLayoutConstants.js';
import { hasCodexConnectionBetween } from '../../codex-edge-cords/topology/CodexGraphTopology.js';
import { updateAppStatus, userConfirms } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { scheduleUpdateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


function markCodexLayoutDirty() {
    s.codexLayoutDirty = true;
    api.updateCodexToolbar();
}

function markNodeVisualUnsaved(el) {
    if (el && el.classList) el.classList.add('codex-node--unsaved');
}

function selectCodexNode(el, opts = {}) {
    if (!s.root) return;
    if (el == null) {
        s.codexSelectedNodeEls.clear();
        s.codexPrimarySelectedNodeEl = null;
        stripCodexSelectionFromDom();
        stripCodexBDescendantGlowFromDom();
        api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        // Skip edge redraw on selection unless pending-delete visuals were cleared
        api.updateCodexToolbar();
        // Reset toolbar color picker and hex input to default when no node selected
        const colorPicker = s.root.querySelector('[data-codex-bg-color-picker]');
        const hexInput = s.root.querySelector('[data-codex-bg-hex-input]');
        if (colorPicker) {
            colorPicker.value = '#ffffff';
        }
        if (hexInput) {
            hexInput.value = '#ffffff';
        }
        return;
    }
    if (!s.root.contains(el)) return;

    // Update toolbar color picker and hex input to show selected node's background color
    const colorPicker = s.root.querySelector('[data-codex-bg-color-picker]');
    const hexInput = s.root.querySelector('[data-codex-bg-hex-input]');
    const savedBgColor = el.dataset.codexBgColor || '#ffffff';
    if (colorPicker) {
        colorPicker.value = savedBgColor;
    }
    if (hexInput) {
        hexInput.value = savedBgColor;
    }

    if (opts.network) {
        s.codexSelectedNodeEls.clear();
        s.codexSelectedNodeEls.add(el);
        s.codexPrimarySelectedNodeEl = el;
        applyCodexSelectionToDom();
        api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
        api.updateCodexToolbar();
        return;
    }

    const mode = opts.mode || 'replace';
    if (mode === 'toggle') {
        if (s.codexSelectedNodeEls.has(el)) {
            s.codexSelectedNodeEls.delete(el);
            if (s.codexPrimarySelectedNodeEl === el) {
                const rest = [...s.codexSelectedNodeEls];
                s.codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
            }
        } else {
            s.codexSelectedNodeEls.add(el);
            s.codexPrimarySelectedNodeEl = el;
        }
    } else {
        s.codexSelectedNodeEls.clear();
        s.codexSelectedNodeEls.add(el);
        s.codexPrimarySelectedNodeEl = el;
    }
    applyCodexSelectionToDom();
    api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    // Skip edge redraw on selection unless pending-delete visuals were cleared
    api.updateCodexToolbar();
}

function selectCodexNodesPair(elA, elB, primaryEl) {
    if (!s.root) return;
    s.codexSelectedNodeEls.clear();
    if (elA && s.root.contains(elA)) s.codexSelectedNodeEls.add(elA);
    if (elB && s.root.contains(elB)) s.codexSelectedNodeEls.add(elB);
    if (primaryEl && s.root.contains(primaryEl)) {
        s.codexPrimarySelectedNodeEl = primaryEl;
    } else if (elB && s.root.contains(elB)) {
        s.codexPrimarySelectedNodeEl = elB;
    } else if (elA && s.root.contains(elA)) {
        s.codexPrimarySelectedNodeEl = elA;
    } else {
        s.codexPrimarySelectedNodeEl = null;
    }
    applyCodexSelectionToDom();
    api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    api.updateCodexToolbar();
}

function selectAllCodexNodes() {
    if (!s.root) return;
    pruneStaleCodexSelection();
    const els = [...s.root.querySelectorAll('.codex-node')];
    if (!els.length) return;
    s.networkLinkSourceId = null;
    s.codexSelectedNodeEls.clear();
    els.forEach((el) => s.codexSelectedNodeEls.add(el));
    s.codexPrimarySelectedNodeEl = els[els.length - 1];
    applyCodexSelectionToDom();
    api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();
    api.updateCodexToolbar();
}

function pruneStaleCodexSelection() {
    for (const el of [...s.codexSelectedNodeEls]) {
        if (!s.root || !s.root.contains(el)) s.codexSelectedNodeEls.delete(el);
    }
    if (s.codexPrimarySelectedNodeEl && (!s.root || !s.root.contains(s.codexPrimarySelectedNodeEl))) {
        s.codexPrimarySelectedNodeEl = null;
    }
    if (s.codexPrimarySelectedNodeEl && !s.codexSelectedNodeEls.has(s.codexPrimarySelectedNodeEl)) {
        const rest = [...s.codexSelectedNodeEls];
        s.codexPrimarySelectedNodeEl = rest.length ? rest[rest.length - 1] : null;
    }
}

function getSelectedCodexNodesInRoot() {
    pruneStaleCodexSelection();
    if (!s.root) return [];
    return [...s.codexSelectedNodeEls].filter((el) => s.root.contains(el));
}

function stripCodexSelectionFromDom() {
    if (!s.root) return;
    s.root.querySelectorAll('.codex-node--selected').forEach((el) => {
        el.classList.remove('codex-node--selected');
    });
}

function stripCodexBDescendantGlowFromDom() {
    if (!s.root) return;
    s.root.querySelectorAll('.codex-node--b-of-selected-a').forEach((el) => {
        el.classList.remove('codex-node--b-of-selected-a');
    });
}

function getCodexStrictOutgoingDescendantIds(fromId) {
    const result = new Set();
    const visited = new Set();
    const queue = [fromId];
    visited.add(fromId);
    while (queue.length) {
        const id = queue.shift();
        for (let i = 0; i < s.codexEdges.length; i++) {
            const e = s.codexEdges[i];
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
    if (!s.root || s.codexInteractionMode !== 'drag' || s.codexSelectedNodeEls.size !== 1) return;
    const aEl = s.codexPrimarySelectedNodeEl;
    if (!aEl || !s.root.contains(aEl) || !s.codexSelectedNodeEls.has(aEl)) return;
    const aId = aEl.dataset.codexNodeId;
    if (!aId) return;
    getCodexStrictOutgoingDescendantIds(aId).forEach((bid) => {
        const bel = codexNodeElById(bid);
        if (bel && s.root.contains(bel)) bel.classList.add('codex-node--b-of-selected-a');
    });
}

function applyCodexSelectionToDom() {
    stripCodexSelectionFromDom();
    s.codexSelectedNodeEls.forEach((el) => {
        if (s.root && s.root.contains(el)) el.classList.add('codex-node--selected');
    });
    refreshCodexBDescendantGlowForSelection();
}

function selectDragGroupForNode(el) {
    if (s.codexInteractionMode !== 'drag') return [el];
    pruneStaleCodexSelection();
    if (s.codexSelectedNodeEls.size > 1 && s.codexSelectedNodeEls.has(el)) {
        return [...s.codexSelectedNodeEls].filter((n) => s.root && s.root.contains(n));
    }
    return [el];
}

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
        if (s.codexWorldEl) {
            maxX = Math.max(0, CODEX_WORLD_W - w);
            maxY = Math.max(0, CODEX_WORLD_H - h);
        } else {
            maxX = Math.max(0, s.root.clientWidth - w);
            maxY = Math.max(0, s.root.clientHeight - h);
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

function clearAllCodexBoard() {
    if (s.codexMode !== 'dev' || !s.root) return;
    const totalNodes = s.codexAllNodes.length;
    const totalEdges = s.codexEdges.length;
    if (totalNodes === 0 && totalEdges === 0) {
        updateAppStatus('Codex is already empty.', 'info');
        return;
    }
    const ok = userConfirms(
        `Clear the entire Codex board? This removes ${totalNodes} node${totalNodes === 1 ? '' : 's'} and ${totalEdges} link${totalEdges === 1 ? '' : 's'}. Use Save Codex to persist the change.`
    );
    if (!ok) return;

    api.stripCodexBoardForFullReplace();
    s.codexAllNodes = [];
    s.codexEdges = [];
    s.codexUnsavedEdgeKeys.clear();
    s.cordDoubleRightLastTs.clear();
    s.codexNodeDeleteLastRightTs.clear();
    api.clearPendingCodexDeleteState();
    s.codexRenderedNodeIds.clear();
    s.codexNodeElements.clear();
    s.codexSelectedNodeEls = new Set();
    s.codexPrimarySelectedNodeEl = null;
    s.codexBulkNodeDeleteArmedAt = 0;

    markCodexLayoutDirty();
    redrawCodexEdges();
    applyCodexSelectionToDom();
    api.updateCodexToolbar();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus(
        `Cleared Codex (${totalNodes} node${totalNodes === 1 ? '' : 's'}, ${totalEdges} link${totalEdges === 1 ? '' : 's'}). Save Codex to persist.`,
        'success'
    );
}

function deleteCodexToolbarSelectedNodes() {
    if (s.codexMode !== 'dev' || !s.root) return;
    const toRemove = getSelectedCodexNodesInRoot().filter((n) => s.root.contains(n));
    const ids = toRemove.map((n) => n.dataset.codexNodeId).filter(Boolean);
    if (!ids.length) return;
    api.clearPendingCodexDeleteState();
    api.removeEdgesForDeletedNodesWithJunctionBridging(ids);
    s.codexAllNodes = s.codexAllNodes.filter((n) => !ids.includes(n.id));
    markCodexLayoutDirty();
    s.codexSelectedNodeEls.clear();
    s.codexPrimarySelectedNodeEl = null;
    for (const id of ids) unregisterCodexNodeRenderTracking(id);
    toRemove.forEach((n) => n.remove());
    applyCodexSelectionToDom();
    redrawCodexEdges();
    api.updateCodexToolbar();
    scheduleUpdateCodexVirtualScroll();
    updateAppStatus(ids.length === 1 ? 'Deleted 1 node.' : `Deleted ${ids.length} nodes.`, 'success');
}

function unregisterCodexNodeRenderTracking(nodeId) {
    if (!nodeId) return;
    s.codexRenderedNodeIds.delete(nodeId);
    s.codexNodeElements.delete(nodeId);
    s.codexNodeDeleteLastRightTs.delete(nodeId);
}

function codexNodeElById(nodeId) {
    if (!nodeId) return null;
    // Use Map for O(1) lookup instead of querySelector (performance optimization)
    return s.codexNodeElements.get(nodeId) || null;
}

function codexNodeIsJunctionWaypoint(nodeId) {
    const el = codexNodeElById(nodeId);
    return !!(el && el.classList.contains('codex-node--junction'));
}

function codexNodeKindById(id) {
    const n = s.codexAllNodes.find((x) => x.id === id);
    return n && n.kind ? n.kind : null;
}

function handleNetworkNodeActivate(el) {
    const id = el.dataset.codexNodeId;
    if (!id) return;

    if (!s.networkLinkSourceId) {
        s.networkLinkSourceId = id;
        selectCodexNode(el, { network: true });
        api.updateCodexToolbar();
        return;
    }
    if (s.networkLinkSourceId === id) {
        s.networkLinkSourceId = null;
        selectCodexNode(el, { network: true });
        api.updateCodexToolbar();
        return;
    }
    const fromId = s.networkLinkSourceId;
    const toId = id;
    s.networkLinkSourceId = null;

    let created = false;
    if (!api.hasCodexConnectionBetween(fromId, toId)) {
        s.codexEdges.push({ fromId, toId });
        api.markCodexEdgeUnsaved(fromId, toId);
        markCodexLayoutDirty();
        redrawCodexEdges();
        created = true;
    } else {
        updateAppStatus('Those Codex nodes are already linked.', 'warning');
    }

    const elFrom = codexNodeElById(fromId);
    const elTo = codexNodeElById(toId);
    if (created) {
        s.codexInteractionMode = 'drag';
        if (elFrom && elTo) {
            markNodeVisualUnsaved(elTo);
        }
    }
    selectCodexNodesPair(elFrom, elTo, elTo);
}

api.markCodexLayoutDirty = markCodexLayoutDirty;
api.markNodeVisualUnsaved = markNodeVisualUnsaved;
api.selectCodexNode = selectCodexNode;
api.selectCodexNodesPair = selectCodexNodesPair;
api.selectAllCodexNodes = selectAllCodexNodes;
api.pruneStaleCodexSelection = pruneStaleCodexSelection;
api.getSelectedCodexNodesInRoot = getSelectedCodexNodesInRoot;
api.stripCodexSelectionFromDom = stripCodexSelectionFromDom;
api.stripCodexBDescendantGlowFromDom = stripCodexBDescendantGlowFromDom;
api.getCodexStrictOutgoingDescendantIds = getCodexStrictOutgoingDescendantIds;
api.refreshCodexBDescendantGlowForSelection = refreshCodexBDescendantGlowForSelection;
api.applyCodexSelectionToDom = applyCodexSelectionToDom;
api.selectDragGroupForNode = selectDragGroupForNode;
api.clampCodexGroupDragDelta = clampCodexGroupDragDelta;
api.clearAllCodexBoard = clearAllCodexBoard;
api.deleteCodexToolbarSelectedNodes = deleteCodexToolbarSelectedNodes;
api.unregisterCodexNodeRenderTracking = unregisterCodexNodeRenderTracking;
api.codexNodeElById = codexNodeElById;
api.codexNodeIsJunctionWaypoint = codexNodeIsJunctionWaypoint;
api.codexNodeKindById = codexNodeKindById;
api.handleNetworkNodeActivate = handleNetworkNodeActivate;

