/** CodexLayoutImportExport — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { setCodexConnectionsInSession, ensureCodexConnectionPayload } from '../../codex-connections/CodexConnectionAccess.js';
import { CODEX_ZOOM_INITIAL } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { parseMigrateAndDedupeCodexSource } from '../migration/CodexPayloadMigration.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { downloadTextFileAsJson, stringifyCodexLayoutJson } from '../persistence/CodexLayoutSerialization.js';
import { updateAppStatus, userConfirms, getCodexLoadingOverlayLineSetter } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { stopCordAnimAndClearCordPacketState } from '../../codex-node-drawing/packets/CodexCordPacketAnimation.js';
import { redrawCodexEdges, redrawCodexEdgesDuringLoad } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { clearCodexVirtualScroll, updateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { parseCodexJsonInWorker } from '../load/CodexJsonParseWorker.js';

const STRIP_NODE_CHUNK = 80;

function scheduleDeferredCodexWork(fn) {
    const run = () => {
        try {
            fn();
        } catch (_) {
            /* ignore */
        }
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 2500 });
    } else {
        setTimeout(run, 0);
    }
}

function mirrorImportedLayoutToLocalStorage() {
    try {
        const { nodes: nPersist, edges: ePersist, connections: cPersist } = api.serializeCodexState();
        localStorage.setItem(
            CODEX_STORAGE_KEY,
            JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist, connections: cPersist || [] })
        );
    } catch (_) {
        /* ignore */
    }
}

async function yieldImportPaint() {
    if (typeof api.yieldCodexBrowserPaint === 'function') {
        await api.yieldCodexBrowserPaint();
        return;
    }
    await new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => setTimeout(resolve, 0));
        });
    });
}

/**
 * Tear down the live board without one giant sync DOM wipe (that was part of the import stall).
 */
async function stripCodexBoardForFullReplaceChunked() {
    if (!s.root) return;
    api.removePicker();
    s.networkLinkSourceId = null;
    api.cancelPointerPending();
    api.cancelBackgroundPanPointerPending();
    api.selectCodexNode(null);
    s.codexBulkNodeDeleteArmedAt = 0;
    stopCordAnimAndClearCordPacketState();

    const world = s.codexWorldEl || s.root;
    const nodes = Array.from(world.querySelectorAll('.codex-node'));
    for (let i = 0; i < nodes.length; i += STRIP_NODE_CHUNK) {
        const end = Math.min(i + STRIP_NODE_CHUNK, nodes.length);
        for (let j = i; j < end; j += 1) {
            nodes[j].remove();
        }
        if (end < nodes.length) {
            if (typeof api.yieldBetweenCodexLoadChunks === 'function') {
                await api.yieldBetweenCodexLoadChunks();
            } else {
                await new Promise((r) => requestAnimationFrame(r));
            }
        }
    }
}

/** Sync variant kept for callers that expect an immediate wipe. */
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

/**
 * Replace the live Codex board from imported JSON.
 * Mirrors `loadCodexState` + post-open paint, with extra yields around strip/migrate
 * so the page stays interactive during a full replace.
 */
async function importCodexLayoutFromJsonText(jsonText, opts = {}) {
    if (!s.root) return;
    if (!opts.skipConfirm) {
        const ok = userConfirms(
            'Replace the entire Codex with this file? All current nodes and links on the board will be removed.'
        );
        if (!ok) return;
    }

    const overlayLine = getCodexLoadingOverlayLineSetter();
    const setLine = (text) => {
        if (overlayLine) overlayLine(text);
        updateAppStatus(text, 'info');
    };

    setLine('Codex import: parsing file…');
    await yieldImportPaint();
    const parseResult = await parseCodexJsonInWorker(jsonText);
    if (!parseResult.ok) {
        updateAppStatus('Codex import: file is not valid JSON.', 'error');
        return;
    }

    setLine('Codex import: preparing layout…');
    await yieldImportPaint();
    // Migration/dedupe can be sync-heavy; yield before/after so the status line can paint.
    const { nodes, edges, connections, migratedNow } = parseMigrateAndDedupeCodexSource(parseResult.data);
    await yieldImportPaint();

    setLine('Codex import: clearing board…');
    await stripCodexBoardForFullReplaceChunked();
    await yieldImportPaint();

    s.codexEdges = edges;
    setCodexConnectionsInSession(connections || []);
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
    api.clearCodexTargetedSelection?.();
    s.codexViewModeInitialRenderDone = false;
    s.codexViewZoom = CODEX_ZOOM_INITIAL;

    if (!nodes.length) {
        api.centerCodexViewOnWorldCenter();
        api.applyCodexWorldTransformStyle();
        redrawCodexEdges();
        api.markCodexLayoutDirty();
        scheduleDeferredCodexWork(mirrorImportedLayoutToLocalStorage);
        void ensureCodexConnectionPayload(true);
        api.updateCodexToolbar();
        updateAppStatus('Codex import: board cleared (empty layout). Save Codex to persist and reconcile with archives.', 'success');
        return;
    }

    api.centerCodexViewOnNodes();
    api.applyCodexWorldTransformStyle();

    s.codexSkipAllEdgeRedraws = true;
    s.codexSkipEdgeRedraw = true;

    setLine(`Codex import: placing ${nodes.length} nodes…`);
    await yieldImportPaint();
    if (s.codexMode === 'view' && nodes.length > 0) {
        await api.placeCodexNodeRecordsInChunks(nodes);
    } else {
        updateCodexVirtualScroll();
        if (s.codexRenderedNodeIds.size === 0 && nodes.length > 0) {
            await api.placeCodexNodeRecordsInChunks(nodes);
        }
    }

    api.syncCodexNodeDomCullFromView?.();
    api.markCodexLayoutDirty();

    s.codexSkipAllEdgeRedraws = false;
    s.codexSkipEdgeRedraw = false;
    s.codexViewModeInitialRenderDone = false;

    const edgeCount = s.codexEdges?.length ?? 0;
    setLine(edgeCount > 0 ? `Codex import: planning connections… 0 / ${edgeCount}` : 'Codex import: preparing…');
    await yieldImportPaint();
    await redrawCodexEdgesDuringLoad({
        force: true,
        onStatusLine: (line) => setLine(`Codex import: ${line}`),
    });

    scheduleDeferredCodexWork(mirrorImportedLayoutToLocalStorage);
    void ensureCodexConnectionPayload(true);
    api.updateCodexToolbar();

    if (migratedNow) {
        updateAppStatus(
            'Codex import: layout was upgraded from an older format — use Save Codex to persist.',
            'info'
        );
    } else {
        updateAppStatus(
            `Codex import: ${nodes.length} nodes, ${s.codexEdges.length} links, ${(connections || []).length} connection row(s). Use Save Codex to persist.`,
            'success'
        );
    }
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
