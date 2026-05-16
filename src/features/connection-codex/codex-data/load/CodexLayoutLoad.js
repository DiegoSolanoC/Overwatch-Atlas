/** CodexLayoutLoad — Codex canvas slice. */
import { api } from '../../codex-core/codexCanvasApi.js';
import { s } from '../../codex-core/canvasSession.js';
import { syncCodexEdgesFromBioArchiveConnections } from '../../codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';
import { CODEX_ZOOM_INITIAL } from '../../codex-camera/viewport/CodexCanvasTuning.js';
import { parseCodexJsonInWorker } from './CodexJsonParseWorker.js';
import { fetchCanonicalCodexJson } from './CodexJsonRepository.js';
import { parseMigrateAndDedupeCodexSource } from '../migration/CodexPayloadMigration.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { getCodexLoadingOverlayLineSetter } from '../../codex-integration/bridge/CodexAppBridge.js';
import { normalizeCodexCountryKey, resolveCodexNodeScale } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { redrawCodexEdges, scheduleRedrawCodexEdges } from '../../codex-render/redraw/CodexEdgeRedraw.js';
import { clearCodexVirtualScroll, updateCodexVirtualScroll } from '../../codex-render/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-core/canvasConstants.js';


function placeLoadedCodexNodeRecord(L) {
    if (!L || typeof L !== 'object') return;
    const placeKind =
        L.kind === 'junction'
            ? 'junction'
            : L.kind === 'faction'
                ? 'faction'
                : L.kind === 'country'
                    ? 'country'
                    : L.kind === 'npc'
                        ? 'npc'
                        : 'hero';
    const opts = {
        fromSaved: true,
        skipRedraw: true,
        skipLazyLoad: true, // Load images immediately for virtual scroll
        id: L.id,
        scale: resolveCodexNodeScale(placeKind, L.scale),
        bgColor: L.bgColor || null
    };
    if (L.kind === 'hero' && L.heroName) {
        api.placeCodexNode(L.x, L.y, 'hero', L.heroName, null, opts);
    } else if (L.kind === 'npc' && L.npcName) {
        api.placeCodexNode(L.x, L.y, 'npc', L.npcName, null, opts);
    } else if (L.kind === 'faction' && L.factionFilename) {
        api.placeCodexNode(L.x, L.y, 'faction', null, {
            filename: L.factionFilename,
            displayName: L.factionDisplay || L.factionFilename
        }, opts);
    } else if (L.kind === 'country' && normalizeCodexCountryKey(L.countryKey)) {
        api.placeCodexNode(L.x, L.y, 'country', null, null, {
            ...opts,
            countryKey: normalizeCodexCountryKey(L.countryKey)
        });
    } else if (L.kind === 'junction') {
        api.placeCodexNode(L.x, L.y, 'junction', null, null, opts);
    }
}

async function placeCodexNodeRecordsInChunks(nodes) {
    const overlayLine = getCodexLoadingOverlayLineSetter();
    if (overlayLine && nodes.length) {
        overlayLine(`Placing ${nodes.length} nodes…`);
    }
    await yieldCodexBrowserPaint();

    const CODEX_LOAD_NODE_CHUNK = 22;
    for (let start = 0; start < nodes.length; start += CODEX_LOAD_NODE_CHUNK) {
        const end = Math.min(start + CODEX_LOAD_NODE_CHUNK, nodes.length);
        for (let i = start; i < end; i++) {
            placeLoadedCodexNodeRecord(nodes[i]);
        }
        if (overlayLine && nodes.length > CODEX_LOAD_NODE_CHUNK) {
            overlayLine(`Placing nodes… ${end} / ${nodes.length}`);
        }
        if (end < nodes.length) {
            await yieldBetweenCodexLoadChunks();
        }
    }
}

function yieldCodexBrowserPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 0);
            });
        });
    });
}

function yieldBetweenCodexLoadChunks() {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve(), { timeout: 120 });
        } else {
            requestAnimationFrame(resolve);
        }
    });
}

async function loadCodexState() {
    if (!s.root) return;

    let sourceObj = null;
    let loadedFromCanonical = false;

    const canonical = await fetchCanonicalCodexJson();
    if (canonical.ok) {
        sourceObj = canonical.data;
        loadedFromCanonical = true;
    } else {
        // Use Web Worker to parse JSON without blocking main thread
        try {
            const raw = localStorage.getItem(CODEX_STORAGE_KEY);
            if (raw) {
                const result = await parseCodexJsonInWorker(raw);
                if (result.ok) {
                    sourceObj = result.data;
                }
            }
        } catch (_) {
            sourceObj = null;
        }
    }

    if (!sourceObj) {
        sourceObj = { v: CODEX_SAVE_VERSION, nodes: [], edges: [] };
    }

    const mirrorCanonicalToLocalStorage = () => {
        if (!loadedFromCanonical) return;
        try {
            const { nodes: nPersist, edges: ePersist } = api.serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
    };

    const { nodes, edges, migratedNow } = parseMigrateAndDedupeCodexSource(sourceObj);
    s.codexEdges = edges;
    s.codexUnsavedEdgeKeys.clear();
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    
    // Store all nodes for virtual scrolling
    s.codexAllNodes = nodes || [];
    // Clear previously rendered nodes
    clearCodexVirtualScroll();
    
    // Reset View Mode initial render flag when loading new layout
    s.codexViewModeInitialRenderDone = false;
    
    if (!nodes.length) {
        api.centerCodexViewOnWorldCenter();
        api.applyCodexWorldTransformStyle();
        redrawCodexEdges();
        s.codexLayoutDirty = false;
        api.updateCodexToolbar();
        mirrorCanonicalToLocalStorage();
        return;
    }

    // Center view on all nodes FIRST (using data, not DOM elements)
    api.centerCodexViewOnNodes();
    api.applyCodexWorldTransformStyle();

    // Skip ALL edge redraws during initial load for performance (O(n²) otherwise)
    s.codexSkipAllEdgeRedraws = true;
    s.codexSkipEdgeRedraw = true;

    // Then render visible nodes via virtual scroll
    updateCodexVirtualScroll();

    // Re-enable edge redraws and do one final redraw
    s.codexSkipAllEdgeRedraws = false;
    s.codexSkipEdgeRedraw = false;
    
    // In View Mode, force a redraw after nodes are loaded
    if (s.codexMode === 'view') {
        s.codexViewModeInitialRenderDone = false;
        redrawCodexEdges();
    } else {
        scheduleRedrawCodexEdges();
    }

    // Failsafe: if no nodes rendered after initial load, render all nodes
    if (s.codexRenderedNodeIds.size === 0 && nodes.length > 0) {
        s.codexSkipAllEdgeRedraws = true;
        s.codexSkipEdgeRedraw = true;
        for (const node of nodes) {
            placeLoadedCodexNodeRecord(node);
            s.codexRenderedNodeIds.add(node.id);
        }
        // Don't reset flags or schedule redraw here - let the main redraw handle it
    }

    if (migratedNow) {
        try {
            const { nodes: nPersist, edges: ePersist } = api.serializeCodexState();
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist })
            );
        } catch (_) {
            /* ignore */
        }
        if (loadedFromCanonical) {
            api.markCodexLayoutDirty();
        }
    }

    // Redraw already scheduled by scheduleRedrawCodexEdges() above
    if (!migratedNow) {
        s.codexLayoutDirty = false;
    }
    api.updateCodexToolbar();
    mirrorCanonicalToLocalStorage();
    void syncCodexEdgesFromBioArchiveConnections();
}

api.placeLoadedCodexNodeRecord = placeLoadedCodexNodeRecord;
api.placeCodexNodeRecordsInChunks = placeCodexNodeRecordsInChunks;
api.yieldCodexBrowserPaint = yieldCodexBrowserPaint;
api.yieldBetweenCodexLoadChunks = yieldBetweenCodexLoadChunks;
api.loadCodexState = loadCodexState;

