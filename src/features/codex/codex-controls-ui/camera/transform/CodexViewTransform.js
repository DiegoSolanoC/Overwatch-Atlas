/** CodexViewTransform — Codex canvas slice. */
import { api } from '../../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../../codex-canvas/core/canvasSession.js';
import { computeCodexPanForNodeBounds, computeCodexPanForWorldCenter } from './CodexViewFraming.js';
import { CODEX_ZOOM_FACTOR, CODEX_ZOOM_INITIAL, CODEX_ZOOM_MAX, CODEX_ZOOM_MIN } from '../viewport/CodexCanvasTuning.js';
import { clearCodexEdgeRedrawSchedule, redrawCodexEdges } from '../../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { syncCodexPacketAnimForViewZoom } from '../../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { scheduleUpdateCodexVirtualScroll, updateCodexVirtualScroll } from '../../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { hydrateCodexPortraitImagesInViewport } from '../../../codex-node-drawing/lazy-images/CodexImageLazyLoad.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../../codex-canvas/core/canvasConstants.js';


function applyCodexWorldTransformStyle() {
    if (!s.codexWorldEl) return;
    s.codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, s.codexViewZoom));
    s.codexWorldEl.style.transform = `translate(${s.codexViewPanX}px, ${s.codexViewPanY}px) scale(${s.codexViewZoom})`;
}

function applyCodexViewTransform() {
    applyCodexWorldTransformStyle();
    // Pause/resume packet RAF by zoom LOD without waiting for the debounced edge redraw.
    syncCodexPacketAnimForViewZoom();
    s.codexSkipAllEdgeRedraws = true;
    s.codexSkipEdgeRedraw = true;
    // Dev only: remount viewport during zoom. View mode keeps a full static board.
    if (s.codexMode !== 'view') {
        scheduleUpdateCodexVirtualScroll();
    }
    clearCodexEdgeRedrawSchedule();
    if (s.codexZoomDebounceTimer) {
        clearTimeout(s.codexZoomDebounceTimer);
    }
    s.codexZoomDebounceTimer = setTimeout(() => {
        if (s.codexMode !== 'view') {
            scheduleUpdateCodexVirtualScroll();
        }
        s.codexSkipAllEdgeRedraws = false;
        s.codexSkipEdgeRedraw = false;
        hydrateCodexPortraitImagesInViewport(s.root);
        redrawCodexEdges();
        s.codexZoomDebounceTimer = null;
    }, 200);
}

function applyCodexZoomWithAnchor(clientX, clientY, newZoom) {
    if (!s.root) return;
    const rr = s.root.getBoundingClientRect();
    const layoutScale = api.getCodexBodyLayoutPerViewportPx();
    const lx = (clientX - rr.left) / layoutScale;
    const ly = (clientY - rr.top) / layoutScale;
    const w = api.clientToWorldCodex(clientX, clientY);
    s.codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, newZoom));
    s.codexViewPanX = lx - w.x * s.codexViewZoom;
    s.codexViewPanY = ly - w.y * s.codexViewZoom;
    applyCodexViewTransform();
}

function codexZoomByFactorAt(factor, clientX, clientY) {
    if (!s.root) return;
    applyCodexZoomWithAnchor(clientX, clientY, s.codexViewZoom * factor);
}

function getCodexViewCenterClient() {
    if (!s.root) return { cx: 0, cy: 0 };
    const rr = s.root.getBoundingClientRect();
    return { cx: rr.left + rr.width / 2, cy: rr.top + rr.height / 2 };
}

function codexZoomInFromUi() {
    const { cx, cy } = getCodexViewCenterClient();
    codexZoomByFactorAt(CODEX_ZOOM_FACTOR, cx, cy);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-zoom-changed'));
    }
}

function codexZoomOutFromUi() {
    const { cx, cy } = getCodexViewCenterClient();
    codexZoomByFactorAt(1 / CODEX_ZOOM_FACTOR, cx, cy);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-zoom-changed'));
    }
}

/** 0 = min zoom, 1 = max zoom */
function getCodexZoomNormalized() {
    const span = Math.max(1e-6, CODEX_ZOOM_MAX - CODEX_ZOOM_MIN);
    return Math.max(0, Math.min(1, (s.codexViewZoom - CODEX_ZOOM_MIN) / span));
}

/** @param {number} t 0..1 */
function setCodexZoomNormalized(t) {
    const { cx, cy } = getCodexViewCenterClient();
    const clamped = Math.max(0, Math.min(1, Number(t) || 0));
    const next = CODEX_ZOOM_MIN + clamped * (CODEX_ZOOM_MAX - CODEX_ZOOM_MIN);
    applyCodexZoomWithAnchor(cx, cy, next);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-zoom-changed'));
    }
}

function codexResetView() {
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    if (s.root?.querySelector('.codex-node')) {
        centerCodexViewOnNodes();
    } else {
        centerCodexViewOnWorldCenter();
    }
    applyCodexViewTransform();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-zoom-changed'));
    }
}

function centerCodexViewOnWorldCenter() {
    if (!s.root || !s.codexWorldEl) return;
    const rw = s.root.clientWidth || 1;
    const rh = s.root.clientHeight || 1;
    const pan = computeCodexPanForWorldCenter(rw, rh, s.codexViewZoom);
    s.codexViewPanX = pan.panX;
    s.codexViewPanY = pan.panY;
}

function centerCodexViewOnNodes() {
    if (!s.root) return;
    const nodes = s.codexAllNodes;
    if (!nodes?.length) return;
    const rw = s.root.clientWidth || 1;
    const rh = s.root.clientHeight || 1;
    const pan = computeCodexPanForNodeBounds(nodes, rw, rh, s.codexViewZoom);
    if (!pan) return;
    s.codexViewPanX = pan.panX;
    s.codexViewPanY = pan.panY;
}

api.applyCodexWorldTransformStyle = applyCodexWorldTransformStyle;
api.applyCodexViewTransform = applyCodexViewTransform;
api.applyCodexZoomWithAnchor = applyCodexZoomWithAnchor;
api.codexZoomByFactorAt = codexZoomByFactorAt;
api.getCodexViewCenterClient = getCodexViewCenterClient;
api.codexZoomInFromUi = codexZoomInFromUi;
api.codexZoomOutFromUi = codexZoomOutFromUi;
api.getCodexZoomNormalized = getCodexZoomNormalized;
api.setCodexZoomNormalized = setCodexZoomNormalized;
api.codexResetView = codexResetView;
api.centerCodexViewOnWorldCenter = centerCodexViewOnWorldCenter;
api.centerCodexViewOnNodes = centerCodexViewOnNodes;

