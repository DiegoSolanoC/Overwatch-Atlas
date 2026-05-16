/** CodexLayoutSave — Codex canvas slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { serializeCodexLayoutSnapshot } from '../persistence/CodexLayoutSerialization.js';
import { dispatchBioArchivesRefreshed, getEventTimelineDataService, isCodexPersistToRepoAvailable, resolveCodexRepoApiUrl, updateAppStatus } from '../../codex-integration/bridge/CodexAppBridge.js';
import { redrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-core/canvasConstants.js';
import { syncCodexEdgesFromBioArchiveConnections } from '../../codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';


function isCodexFileApiAvailable() {
    return isCodexPersistToRepoAvailable();
}

function serializeCodexState() {
    if (!s.root) return { nodes: [], edges: [] };
    return serializeCodexLayoutSnapshot(s.codexAllNodes, s.codexEdges);
}

function saveCodexLayout() {
    if (!s.root) return;
    const { nodes, edges } = serializeCodexState();
    const payload = { v: CODEX_SAVE_VERSION, nodes, edges };
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
    redrawCodexEdges();

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
            .then(async (data) => {
                let archList = Array.isArray(data?.bioArchiveFilesWritten)
                    ? data.bioArchiveFilesWritten.filter(Boolean)
                    : [];
                if (
                    !archList.length
                    && (Number(data?.bioConnectionsUpserted) > 0 || Number(data?.bioConnectionsRemoved) > 0)
                ) {
                    archList = ['heroes', 'factions', 'npcs'];
                }
                const ds = getEventTimelineDataService();
                if (archList.length && typeof ds?.refreshBioArchivesFromCodexDiskWrite === 'function') {
                    try {
                        const r = await ds.refreshBioArchivesFromCodexDiskWrite(archList);
                        const out = r?.updated && r.updated.length ? r.updated : archList;
                        dispatchBioArchivesRefreshed({ archives: out });
                    } catch (reErr) {
                        console.warn('CodexCanvasService: post-codex bio archive refresh failed', reErr);
                    }
                }
                try {
                    await syncCodexEdgesFromBioArchiveConnections();
                } catch (reconcileErr) {
                    console.warn('CodexCanvasService: post-save codex/archive edge reconcile failed', reconcileErr);
                }
                let msg = `✓ Codex saved (${data?.nodesCount ?? nodes.length} nodes, ${data?.edgesCount ?? edges.length} links)`;
                const nBio = Number(data?.bioConnectionsUpserted) || 0;
                const nRm = Number(data?.bioConnectionsRemoved) || 0;
                if (nBio > 0 || nRm > 0) {
                    const parts = [];
                    if (nBio > 0) parts.push(`${nBio} row(s) added/updated`);
                    if (nRm > 0) parts.push(`${nRm} stale “show in Codex” row(s) removed`);
                    msg += `. Archive JSON: ${parts.join('; ')}.`;
                }
                const warns = Array.isArray(data?.bioArchiveWarnings) ? data.bioArchiveWarnings : [];
                if (warns.length) {
                    msg += ` (${warns.slice(0, 2).join(' ')}${warns.length > 2 ? '…' : ''})`;
                }
                if (data?.bioArchiveError) {
                    msg += ` Bio archive sync error: ${data.bioArchiveError}`;
                }
                updateAppStatus(msg, data?.bioArchiveError ? 'warning' : 'success');
            })
            .catch((e) => {
                console.warn('CodexCanvasService: /api/codex write failed', e);
                updateAppStatus(
                    `Codex saved in browser; could not write data/codex-labels.json (${e?.message || 'API error'})`,
                    'warning'
                );
            });
    } else {
        updateAppStatus('Codex saved (this browser).', 'success');
    }
}

api.isCodexFileApiAvailable = isCodexFileApiAvailable;
api.serializeCodexState = serializeCodexState;
api.saveCodexLayout = saveCodexLayout;

export { saveCodexLayout };
