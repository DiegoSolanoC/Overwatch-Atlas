/** CodexLayoutImportExport — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { syncCodexEdgesFromBioArchiveConnections } from '../../codex-bio-archive-sync/reconcile/CodexBioArchiveEdgeSync.js';
import { CODEX_ZOOM_INITIAL } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { parseMigrateAndDedupeCodexSource } from '../migration/CodexPayloadMigration.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { downloadTextFileAsJson, stringifyCodexLayoutJson } from '../persistence/CodexLayoutSerialization.js';
import { updateAppStatus, userConfirms } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { stopCordAnimAndClearCordPacketState } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { clearCodexVirtualScroll, updateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


function stripCodexBoardForFullReplace() {
    if (!s.root) return;
    api.removePicker();
    s.networkLinkSourceId = null;
    api.cancelPointerPending();
    api.cancelBackgroundPanPointerPending();
    api.selectCodexNode(null);
    s.codexBulkNodeDeleteArmedAt = 0;
    const world = s.codexWorldEl || s.root;
    world.querySelectorAll('.codex-node').forEach((n) => n.remove());
    stopCordAnimAndClearCordPacketState();
}

async function importCodexLayoutFromJsonText(jsonText, opts = {}) {
    if (!s.root) return;
    if (!opts.skipConfirm) {
        const ok = userConfirms(
            'Replace the entire Codex with this file? All current nodes and links on the board will be removed.'
        );
        if (!ok) return;
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (_) {
        updateAppStatus('Codex import: file is not valid JSON.', 'error');
        return;
    }

    const { nodes, edges, migratedNow } = parseMigrateAndDedupeCodexSource(parsed);
    stripCodexBoardForFullReplace();
    s.codexEdges = edges;
    s.codexUnsavedEdgeKeys.clear();
    s.cordDoubleRightLastTs.clear();
    s.codexNodeDeleteLastRightTs.clear();
    api.clearPendingCodexDeleteState();
    /*
     * Set the in-memory model BEFORE placing DOM nodes — placeLoadedCodexNodeRecord calls
     * placeCodexNode with fromSaved:true, which does not push into s.codexAllNodes (only new
     * user-placed nodes do). Without this, save serializes 0 nodes + N edges and the board
     * disappears on next reload (centerCodexViewOnNodes also early-returns on empty model).
     */
    s.codexAllNodes = nodes || [];
    clearCodexVirtualScroll();
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    if (!nodes.length) {
        api.centerCodexViewOnWorldCenter();
    } else {
        s.codexViewPanX = 0;
        s.codexViewPanY = 0;
    }
    api.applyCodexWorldTransformStyle();

    if (!nodes.length) {
        redrawCodexEdges();
        api.markCodexLayoutDirty();
        try {
            const { nodes: nPersist, edges: ePersist } = api.serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
        /*
         * Verbatim import: do NOT run syncCodexEdgesFromBioArchiveConnections here.
         * The bio reconcile runs automatically after a successful Save Codex (saveCodexLayout
         * line ~2195), so the imported state lands first and reconciliation is applied
         * against the new, persisted layout.
         */
        api.updateCodexToolbar();
        updateAppStatus('Codex import: board cleared (empty layout). Save Codex to persist and reconcile with archives.', 'success');
        return;
    }

    await api.placeCodexNodeRecordsInChunks(nodes);
    /*
     * api.placeCodexNode(fromSaved) doesn't add to s.codexRenderedNodeIds — populate explicitly so
     * the next updateCodexVirtualScroll doesn't try to place duplicate DOM elements. Mirrors
     * the failsafe loop in loadCodexState.
     */
    for (const n of nodes) {
        if (n && n.id) s.codexRenderedNodeIds.add(n.id);
    }
    api.centerCodexViewOnNodes();
    api.applyCodexWorldTransformStyle();
    api.syncCodexNodeDomCullFromView();
    requestAnimationFrame(() => redrawCodexEdges());
    api.markCodexLayoutDirty();
    try {
        const { nodes: nPersist, edges: ePersist } = api.serializeCodexState();
        localStorage.setItem(
            CODEX_STORAGE_KEY,
            JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
        );
    } catch (_) {
        /* ignore */
    }
    if (migratedNow) {
        updateAppStatus(
            'Codex import: layout was upgraded from an older format — use Save Codex to persist (archives reconcile after save).',
            'info'
        );
    } else {
        updateAppStatus(
            `Codex import: ${nodes.length} nodes, ${s.codexEdges.length} links (verbatim). Use Save Codex to persist; archive reconciliation runs after save.`,
            'success'
        );
    }
    /*
     * Verbatim import: skip bio-sync here. The reconciler runs automatically after a
     * successful Save Codex (saveCodexLayout, see post-write hook), so the imported
     * state — including any direct entity-to-entity cords from another user's export
     * that aren't in the local archives — survives until the user explicitly saves.
     * After save, the status line reports any reconcile changes ("removed N orphan
     * link(s); added M from archives") and the user can Save again to commit them.
     */
    api.updateCodexToolbar();
}

function exportCodexLayoutJsonDownload() {
    if (!s.root) return;
    const snap = api.serializeCodexState();
    const text = stringifyCodexLayoutJson(CODEX_SAVE_VERSION, snap);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadTextFileAsJson(text, `codex-layout-${stamp}.json`);
    updateAppStatus(`Codex export: ${snap.nodes.length} nodes, ${snap.edges.length} links.`, 'success');
}

api.stripCodexBoardForFullReplace = stripCodexBoardForFullReplace;
api.importCodexLayoutFromJsonText = importCodexLayoutFromJsonText;
api.exportCodexLayoutJsonDownload = exportCodexLayoutJsonDownload;

