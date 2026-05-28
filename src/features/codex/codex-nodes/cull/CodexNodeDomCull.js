/** CodexNodeDomCull — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_EDGE_CULL_MARGIN_PX, CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX, CODEX_NODE_DOM_CULL_MIN_NODES } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { nodeFrameIntersectsRect } from '../../codex-node-drawing/svg/CodexNodeFrameSvg.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


function syncCodexNodeOffscreenContentVisibility(visibleRect, nodeList) {
    if (!s.root) return;
    if (!visibleRect || s.codexActiveDragNodeIds.size > 0) {
        s.root.querySelectorAll('.codex-node--cv-offscreen').forEach((el) => {
            el.classList.remove('codex-node--cv-offscreen');
        });
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

