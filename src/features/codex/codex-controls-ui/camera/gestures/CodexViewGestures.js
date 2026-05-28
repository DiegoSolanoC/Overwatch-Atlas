/** CodexViewGestures — Codex canvas slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import { DRAG_THRESHOLD_PX } from '../viewport/CodexCanvasTuning.js';
import { clearCodexEdgeRedrawSchedule, redrawCodexEdges } from '../../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { scheduleUpdateCodexVirtualScroll } from '../../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../../codex-canvas/core/canvasConstants.js';


function codexWheelShouldDeferToScroll(e) {
    const t = e.target;
    if (t && typeof t.closest === 'function') {
        if (
            t.closest('.codex-picker')
            || t.closest('.codex-stage-controls')
            || t.closest('.filter-autocomplete-list')
        ) return true;
    }
    return false;
}

function detachCodexViewGestures() {
    const r = s.root;
    if (r && s.onCodexWheelHandler) {
        r.removeEventListener('wheel', s.onCodexWheelHandler);
    }
    s.onCodexWheelHandler = null;
    if (r && s.onCodexTouchStartHandler) {
        r.removeEventListener('touchstart', s.onCodexTouchStartHandler, true);
    }
    if (r && s.onCodexTouchMoveHandler) {
        r.removeEventListener('touchmove', s.onCodexTouchMoveHandler, true);
    }
    if (r && s.onCodexTouchEndHandler) {
        r.removeEventListener('touchend', s.onCodexTouchEndHandler, true);
        r.removeEventListener('touchcancel', s.onCodexTouchEndHandler, true);
    }
    s.onCodexTouchStartHandler = null;
    s.onCodexTouchMoveHandler = null;
    s.onCodexTouchEndHandler = null;
    s.codexPinchState = null;
}

function attachCodexViewGestures() {
    if (!s.root) return;
    detachCodexViewGestures();

    s.onCodexWheelHandler = (e) => {
        if (!s.root) return;
        if (codexWheelShouldDeferToScroll(e)) return;
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0012);
        api.applyCodexZoomWithAnchor(e.clientX, e.clientY, s.codexViewZoom * factor);
    };
    s.root.addEventListener('wheel', s.onCodexWheelHandler, { passive: false });

    s.onCodexTouchStartHandler = (e) => {
        if (e.touches.length === 2) {
            const a = e.touches[0];
            const b = e.touches[1];
            const d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            if (d0 > 10) {
                s.codexPinchState = { d0, z0: s.codexViewZoom };
            }
        }
    };
    s.onCodexTouchMoveHandler = (e) => {
        if (e.touches.length !== 2 || !s.codexPinchState) return;
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        const d1 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = d1 / s.codexPinchState.d0;
        if (ratio <= 0 || !Number.isFinite(ratio)) return;
        api.applyCodexZoomWithAnchor(midX, midY, s.codexPinchState.z0 * ratio);
    };
    s.onCodexTouchEndHandler = (e) => {
        if (e.touches.length < 2) s.codexPinchState = null;
    };

    s.root.addEventListener('touchstart', s.onCodexTouchStartHandler, { passive: true, capture: true });
    s.root.addEventListener('touchmove', s.onCodexTouchMoveHandler, { passive: false, capture: true });
    s.root.addEventListener('touchend', s.onCodexTouchEndHandler, { passive: true, capture: true });
    s.root.addEventListener('touchcancel', s.onCodexTouchEndHandler, { passive: true, capture: true });
}

function cancelBackgroundPanPointerPending() {
    if (!s.backgroundPanPointerPending) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    s.backgroundPanPointerPending = null;
}

function armCodexBackgroundPanPendingFromEvent(e) {
    if (e.button !== 0) return;
    s.backgroundPanPointerPending = {
        pointerId: e.pointerId,
        startCX: e.clientX,
        startCY: e.clientY,
        origPanX: s.codexViewPanX,
        origPanY: s.codexViewPanY
    };
    document.addEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.addEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.addEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
}

function onBackgroundPanMoveMaybe(ev) {
    const p = s.backgroundPanPointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    const dx = ev.clientX - p.startCX;
    const dy = ev.clientY - p.startCY;
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    const prep = s.backgroundPanPointerPending;
    s.backgroundPanPointerPending = null;
    beginActualBackgroundPan(prep, ev);
}

function onBackgroundPanUpMaybe(ev) {
    const p = s.backgroundPanPointerPending;
    if (!p || ev.pointerId !== p.pointerId) return;
    document.removeEventListener('pointermove', onBackgroundPanMoveMaybe, capOpts);
    document.removeEventListener('pointerup', onBackgroundPanUpMaybe, capOpts);
    document.removeEventListener('pointercancel', onBackgroundPanUpMaybe, capOpts);
    s.backgroundPanPointerPending = null;
    if (s.codexInteractionMode === 'network') {
        s.networkLinkSourceId = null;
        api.selectCodexNode(null);
        api.updateCodexToolbar();
    }
}

function beginActualBackgroundPan(prep, firstMoveEv) {
    if (!s.hitLayerEl) return;
    const { pointerId, startCX, startCY, origPanX, origPanY } = prep;
    s.backgroundPanPointerId = pointerId;
    try {
        s.hitLayerEl.setPointerCapture(pointerId);
    } catch (_) { /* ignore */ }

    /* Performance: enable GPU optimization for panning */
    if (s.codexWorldEl) s.codexWorldEl.classList.add('codex-world--panning');

    const layoutPerVp = api.getCodexBodyLayoutPerViewportPx();
    const applyClient = (clientX, clientY) => {
        s.codexViewPanX = origPanX + (clientX - startCX) / layoutPerVp;
        s.codexViewPanY = origPanY + (clientY - startCY) / layoutPerVp;
        /* Cords live under .codex-world; pan is CSS translate only — no full SVG rebuild per move. */
        api.applyCodexWorldTransformStyle();
        /* Skip expensive DOM culling during pan - only run after pan ends */
        // Set skip flags during pan to prevent edge redraws
        s.codexSkipAllEdgeRedraws = true;
        s.codexSkipEdgeRedraw = true;
        // Cancel any pending debounce timer
        if (s.codexZoomDebounceTimer) {
            clearTimeout(s.codexZoomDebounceTimer);
        }
        // Schedule debounced redraw after pan completes (skip in View Mode)
        if (s.codexMode !== 'view') {
            s.codexZoomDebounceTimer = setTimeout(() => {
                s.codexSkipAllEdgeRedraws = false;
                s.codexSkipEdgeRedraw = false;
                redrawCodexEdges();
                s.codexZoomDebounceTimer = null;
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
        s.hitLayerEl.removeEventListener('lostpointercapture', onLost);
        try {
            s.hitLayerEl.releasePointerCapture(pointerId);
        } catch (_) { /* ignore */ }
        if (s.hitLayerEl) s.hitLayerEl.style.cursor = '';
        /* Performance: cleanup GPU optimization, then sync visibility */
        if (s.codexWorldEl) s.codexWorldEl.classList.remove('codex-world--panning');
        s.backgroundPanPointerId = null;
        api.syncCodexNodeDomCullFromView();

        // Skip edge redraws during post-pan virtual scroll to prevent freeze
        s.codexSkipAllEdgeRedraws = true;
        s.codexSkipEdgeRedraw = true;
        scheduleUpdateCodexVirtualScroll();
        clearCodexEdgeRedrawSchedule();
        // Note: Debounce timer is already managed by applyClient during pan
    };

    const onMove = (ev) => {
        if (!s.root || ev.pointerId !== pointerId) return;
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

    s.hitLayerEl.style.cursor = 'grabbing';
    s.hitLayerEl.addEventListener('lostpointercapture', onLost);
    document.addEventListener(moveEvent, onMove, usePointerRawUpdate ? rawOpts : capOpts);
    document.addEventListener('pointerup', onUp, capOpts);
    document.addEventListener('pointercancel', onUp, capOpts);
}

function onHitLayerBackgroundPanPointerDown(e) {
    if (e.button !== 0) return;
    if (!s.hitLayerEl || e.target !== s.hitLayerEl) return;
    cancelBackgroundPanPointerPending();
    api.cancelPointerPending();
    api.clearPendingCodexDeleteStateAndRefreshEdgesIfNeeded();

    // In View Mode, deselect nodes when clicking background
    if (s.codexMode === 'view') {
        api.selectCodexNode(null);
    }

    armCodexBackgroundPanPendingFromEvent(e);
}

api.codexWheelShouldDeferToScroll = codexWheelShouldDeferToScroll;
api.detachCodexViewGestures = detachCodexViewGestures;
api.attachCodexViewGestures = attachCodexViewGestures;
api.cancelBackgroundPanPointerPending = cancelBackgroundPanPointerPending;
api.armCodexBackgroundPanPendingFromEvent = armCodexBackgroundPanPendingFromEvent;
api.onBackgroundPanMoveMaybe = onBackgroundPanMoveMaybe;
api.onBackgroundPanUpMaybe = onBackgroundPanUpMaybe;
api.beginActualBackgroundPan = beginActualBackgroundPan;
api.onHitLayerBackgroundPanPointerDown = onHitLayerBackgroundPanPointerDown;

