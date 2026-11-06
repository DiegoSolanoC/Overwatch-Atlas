/** CodexNodeDomCull — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_EDGE_CULL_MARGIN_PX, CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX, CODEX_NODE_DOM_CULL_MIN_NODES } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { nodeFrameIntersectsRect } from '../../codex-node-drawing/svg/CodexNodeFrameSvg.js';


/**
 * Strip content-visibility cull classes (view mode keeps a static full DOM board).
 */
function clearCodexNodeCvOffscreenClasses() {
    if (!s.root) return;
    s.root.querySelectorAll('.codex-node--cv-offscreen').forEach((el) => {
        el.classList.remove('codex-node--cv-offscreen');
    });
}

function syncCodexNodeOffscreenContentVisibility(visibleRect, nodeList) {
    if (!s.root) return;
    // View mode: all nodes stay mounted and painted — content-visibility under a
    // CSS-transformed .codex-world blanks nodes mid-pan and hitch-settles on release.
    if (s.codexMode === 'view') {
        clearCodexNodeCvOffscreenClasses();
        return;
    }
    if (!visibleRect || s.codexActiveDragNodeIds.size > 0) {
        clearCodexNodeCvOffscreenClasses();
        return;
    }
    const list = nodeList || s.root.querySelectorAll('.codex-node');
    list.forEach((el) => {
        if (nodeFrameIntersectsRect(el, visibleRect)) el.classList.remove('codex-node--cv-offscreen');
        else el.classList.add('codex-node--cv-offscreen');
    });
}

function syncCodexNodeDomCullFromView(nodeList) {
    if (!s.root) return;
    if (s.codexMode === 'view') {
        clearCodexNodeCvOffscreenClasses();
        return;
    }
    /* Performance: skip during any drag/pan operations */
    if (s.codexActiveDragNodeIds.size > 0 || s.backgroundPanPointerId != null) return;
    const list = nodeList || s.root.querySelectorAll('.codex-node');
    const nodeCount = list.length;
    const use = nodeCount >= CODEX_NODE_DOM_CULL_MIN_NODES;
    const rect = use
        ? api.getCodexVisibleWorldBoundsExpanded(CODEX_EDGE_CULL_MARGIN_PX + CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX)
        : null;
    syncCodexNodeOffscreenContentVisibility(rect, list);
}

api.syncCodexNodeOffscreenContentVisibility = syncCodexNodeOffscreenContentVisibility;
api.syncCodexNodeDomCullFromView = syncCodexNodeDomCullFromView;
api.clearCodexNodeCvOffscreenClasses = clearCodexNodeCvOffscreenClasses;
