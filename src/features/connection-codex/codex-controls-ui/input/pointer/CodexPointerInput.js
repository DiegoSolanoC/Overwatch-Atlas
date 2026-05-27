/** CodexPointerInput — Codex canvas slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import { DRAG_THRESHOLD_PX } from '../../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { scheduleRedrawCodexEdges } from '../../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../../codex-canvas/core/canvasConstants.js';


function cancelPointerPending() {
    api.cancelBackgroundPanPointerPending();
    if (!s.pointerPending) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    s.pointerPending = null;
}

function onPointerMoveMaybeDrag(ev) {
    const p = s.pointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    const dx = ev.clientX - p.startCX;
    const dy = ev.clientY - p.startCY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    const prep = s.pointerPending;
    s.pointerPending = null;
    beginActualNodeDrag(prep, ev);
}

function onPointerUpMaybeSelect(ev) {
    const p = s.pointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    document.removeEventListener('pointermove', onPointerMoveMaybeDrag, capOpts);
    document.removeEventListener('pointerup', onPointerUpMaybeSelect, capOpts);
    document.removeEventListener('pointercancel', onPointerUpMaybeSelect, capOpts);
    s.pointerPending = null;
    api.selectCodexNode(p.el, { mode: p.shiftKey ? 'toggle' : 'replace' });
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

    s.codexActiveDragNodeIds = new Set(dragNodes.map((n) => n.dataset.codexNodeId).filter(Boolean));

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
        if (s.codexWorldEl) {
            const pw = api.clientToWorldCodex(clientX, clientY);
            nx = pw.x - grabOffX;
            ny = pw.y - grabOffY;
        } else {
            const layoutScale = api.getCodexBodyLayoutPerViewportPx();
            nx = (clientX - layerLeft) / s - grabOffX;
            ny = (clientY - layerTop) / s - grabOffY;
        }
        let tx = nx - anchor.baseLeft;
        let ty = ny - anchor.baseTop;
        const c = api.clampCodexGroupDragDelta(tx, ty, dragNodes);
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
        if (!s.root) return;
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
        s.codexActiveDragNodeIds.clear();
        const moved = lastTx !== 0 || lastTy !== 0;
        bases.forEach(({ el: nodeEl, baseLeft: bl, baseTop: bt }) => {
            const newX = bl + lastTx;
            const newY = bt + lastTy;
            nodeEl.style.left = `${newX}px`;
            nodeEl.style.top = `${newY}px`;
            nodeEl.style.transform = '';
            nodeEl.style.transformOrigin = '';
            nodeEl.style.willChange = '';
            
            // Sync position to s.codexAllNodes for save persistence
            const nodeId = nodeEl.dataset.codexNodeId;
            if (nodeId) {
                const nodeObj = s.codexAllNodes.find(n => n.id === nodeId);
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
            api.applyOctilinearSnapOnDragRelease(dragIds);
            bases.forEach(({ el: nodeEl }) => {
                api.markNodeVisualUnsaved(nodeEl);
                api.markIncidentCodexEdgesUnsaved(nodeEl.dataset.codexNodeId);
            });
            api.markCodexLayoutDirty();
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

api.cancelPointerPending = cancelPointerPending;
api.onPointerMoveMaybeDrag = onPointerMoveMaybeDrag;
api.onPointerUpMaybeSelect = onPointerUpMaybeSelect;
api.beginActualNodeDrag = beginActualNodeDrag;

