/** CodexLayoutSave — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { serializeCodexLayoutSnapshot } from '../persistence/CodexLayoutSerialization.js';
import { isCodexPersistToRepoAvailable, resolveCodexRepoApiUrl, updateAppStatus } from '../../codex-canvas/bridge/CodexAppBridge.js';
import {
    resetCodexFilterCordSyncSignature,
    syncCodexFilterCordDom,
} from '../../codex-nodes/filters/CodexFilterCordSync.js';
import { invalidateCodexConnectionPayloadCache } from '../../codex-connections/CodexConnectionAccess.js';


function isCodexFileApiAvailable() {
    return isCodexPersistToRepoAvailable();
}

function serializeCodexState() {
    if (!s.root) return { nodes: [], edges: [], connections: [] };
    const snap = serializeCodexLayoutSnapshot(s.codexAllNodes, s.codexEdges);
    return { ...snap, connections: s.codexConnections || [] };
}

/**
 * After save, clear yellow/red “dirty” cord colors without rebuilding the board.
 */
function refreshCodexAppearanceAfterSave() {
    resetCodexFilterCordSyncSignature();
    // Appearance only — no full redraw, no packet polyline rebuild.
    syncCodexFilterCordDom({ skipPackets: true, syncElbowsNow: true });
}

function saveCodexLayout() {
    if (!s.root) return;
    const { nodes, edges, connections } = serializeCodexState();
    const payload = { v: CODEX_SAVE_VERSION, nodes, edges, connections: connections || [] };
    try {
        localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('CodexCanvasService: localStorage save failed', e);
        return;
    }

    s.root.querySelectorAll('.codex-node--unsaved').forEach((el) => {
        el.classList.remove('codex-node--unsaved');
    });
    s.codexUnsavedEdgeKeys.clear();
    s.codexLayoutDirty = false;
    api.clearPendingCodexDeleteState();
    api.updateCodexToolbar();
    refreshCodexAppearanceAfterSave();

    if (isCodexFileApiAvailable()) {
        const codexPost = resolveCodexRepoApiUrl('api/codex');
        fetch(codexPost, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then(async () => {
                invalidateCodexConnectionPayloadCache();
                const msg = `✓ Codex saved (${nodes.length} nodes, ${edges.length} links, ${(connections || []).length} connection row(s))`;
                updateAppStatus(msg, 'success');
            })
            .catch((e) => {
                console.warn('CodexCanvasService: /api/codex write failed', e);
                updateAppStatus(
                    `Codex saved in browser; could not write data/codex-labels.json (${e?.message || 'API error'})`,
                    'warning'
                );
            });
    } else {
        invalidateCodexConnectionPayloadCache();
        updateAppStatus('Codex saved (this browser).', 'success');
    }
}

api.isCodexFileApiAvailable = isCodexFileApiAvailable;
api.serializeCodexState = serializeCodexState;
api.saveCodexLayout = saveCodexLayout;

export { saveCodexLayout };
