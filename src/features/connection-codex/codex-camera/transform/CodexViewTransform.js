/** CodexViewTransform — Codex canvas slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import { computeCodexPanForNodeBounds, computeCodexPanForWorldCenter } from './CodexViewFraming.js';
import { CODEX_ZOOM_FACTOR, CODEX_ZOOM_INITIAL, CODEX_ZOOM_MAX, CODEX_ZOOM_MIN } from '../viewport/CodexCanvasTuning.js';
import { clearCodexEdgeRedrawSchedule, redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
import { scheduleUpdateCodexVirtualScroll, updateCodexVirtualScroll } from '../../codex-render/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-core/canvasConstants.js';


function applyCodexWorldTransformStyle() {
    if (!s.codexWorldEl) return;
    s.codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, s.codexViewZoom));
    s.codexWorldEl.style.transform = `translate(${s.codexViewPanX}px, ${s.codexViewPanY}px) scale(${s.codexViewZoom})`;
}

function applyCodexViewTransform() {
    applyCodexWorldTransformStyle();
    // Skip edge redraws during virtual scroll to prevent freeze (same as pan)
    s.codexSkipAllEdgeRedraws = true;
    s.codexSkipEdgeRedraw = true; // Also skip the internal redraw from updateCodexVirtualScroll
    scheduleUpdateCodexVirtualScroll();
    clearCodexEdgeRedrawSchedule();
    // Debounce the final redraw to prevent multiple rapid calls during zoom
    if (s.codexZoomDebounceTimer) {
        clearTimeout(s.codexZoomDebounceTimer);
    }
    s.codexZoomDebounceTimer = setTimeout(() => {
        s.codexSkipAllEdgeRedraws = false;
        s.codexSkipEdgeRedraw = false; // Reset before calling redrawCodexEdges
        redrawCodexEdges(); // Call directly to bypass RAF throttling
        s.codexZoomDebounceTimer = null;
    }, 200);
}

function applyCodexZoomWithAnchor(clientX, clientY, newZoom) {
    if (!s.root) return;
    const rr = s.root.getBoundingClientRect();
    const layoutScale = api.getCodexBodyLayoutPerViewportPx();
    const oldZoom = s.codexViewZoom;
    const lx = (clientX - rr.left) / layoutScale;
    const ly = (clientY - rr.top) / layoutScale;
    const w = api.clientToWorldCodex(clientX, clientY);
    s.codexViewZoom = Math.max(CODEX_ZOOM_MIN, Math.min(CODEX_ZOOM_MAX, newZoom));
    s.codexViewPanX = lx - w.x * s.codexViewZoom;
    s.codexViewPanY = ly - w.y * s.codexViewZoom;
    applyCodexViewTransform();
    // Update virtual scroll if zoom changed significantly (>10%)
    if (Math.abs(s.codexViewZoom - oldZoom) / oldZoom > 0.1) {
        scheduleUpdateCodexVirtualScroll();
    }
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
}

function codexZoomOutFromUi() {
    const { cx, cy } = getCodexViewCenterClient();
    codexZoomByFactorAt(1 / CODEX_ZOOM_FACTOR, cx, cy);
}

function codexResetView() {
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    if (s.root?.querySelector('.codex-node')) {
        centerCodexViewOnNodes();
    } else {
        centerCodexViewOnWorldCenter();
    }
    applyCodexViewTransform();
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
api.codexResetView = codexResetView;
api.centerCodexViewOnWorldCenter = centerCodexViewOnWorldCenter;
api.centerCodexViewOnNodes = centerCodexViewOnNodes;

