/** CodexLayoutLoad — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import {
    ensureCodexConnectionPayload,
    mergeLocalStorageConnectionsPreferLocal,
    setCodexConnectionsInSession,
} from '../../codex-connections/CodexConnectionAccess.js';
import { CODEX_ZOOM_INITIAL } from '../../codex-controls-ui/camera/viewport/CodexCanvasTuning.js';
import { parseCodexJsonInWorker } from './CodexJsonParseWorker.js';
import { fetchCanonicalCodexJson } from './CodexJsonRepository.js';
import { parseMigrateAndDedupeCodexSource } from '../migration/CodexPayloadMigration.js';
import { CODEX_SAVE_VERSION, CODEX_STORAGE_KEY } from '../persistence/CodexLayoutConstants.js';
import { getCodexLoadingOverlayLineSetter } from '../../codex-canvas/bridge/CodexAppBridge.js';
import { normalizeCodexCountryKey, resolveCodexNodeScale } from '../../codex-nodes/placement/CodexNodePortraitMetrics.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { clearCodexVirtualScroll, updateCodexVirtualScroll } from '../../codex-node-drawing/virtual-scroll/CodexVirtualScroll.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


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
        // Lazy portraits during bulk load — eager decode of 2000+ hexes blocks the overlay at the end.
        skipLazyLoad: false,
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

function reportCodexLoadStageProgress(spec) {
    if (typeof window === 'undefined') return;
    const reporter = window.__codexLoadStageProgress;
    if (typeof reporter === 'function') {
        reporter(spec);
    }
}

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

async function placeCodexNodeRecordsInChunks(nodes) {
    const overlayLine = getCodexLoadingOverlayLineSetter();
    if (overlayLine && nodes.length) {
        overlayLine(`Placing ${nodes.length} nodes…`);
    }
    await yieldCodexBrowserPaint();

    const CODEX_LOAD_NODE_CHUNK = 64;
    const nodeYield = { units: 0 };
    for (let start = 0; start < nodes.length; start += CODEX_LOAD_NODE_CHUNK) {
        const end = Math.min(start + CODEX_LOAD_NODE_CHUNK, nodes.length);
        for (let i = start; i < end; i++) {
            placeLoadedCodexNodeRecord(nodes[i]);
            s.codexRenderedNodeIds.add(nodes[i].id);
        }
        reportCodexLoadStageProgress({ stage: 'nodes', fraction: end / nodes.length });
        if (overlayLine) {
            overlayLine(`Placing nodes… ${end} / ${nodes.length}`);
        }
        if (end < nodes.length) {
            nodeYield.units += end - start;
            if (nodeYield.units >= 128) {
                nodeYield.units = 0;
                await yieldBetweenCodexLoadChunks();
            }
        }
    }
    reportCodexLoadStageProgress({ stage: 'nodes', fraction: 1 });
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
            requestIdleCallback(() => resolve(), { timeout: 48 });
        } else {
            requestAnimationFrame(resolve);
        }
    });
}

async function loadCodexState() {
    if (!s.root) return;

    let sourceObj = null;
    let loadedFromCanonical = false;

    reportCodexLoadStageProgress({ stage: 'fetch', fraction: 0.15 });
    const canonical = await fetchCanonicalCodexJson();
    reportCodexLoadStageProgress({ stage: 'fetch', fraction: 0.85 });
    if (canonical.ok) {
        sourceObj = mergeLocalStorageConnectionsPreferLocal(canonical.data);
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
        sourceObj = { v: CODEX_SAVE_VERSION, nodes: [], edges: [], connections: [] };
    }

    const mirrorCanonicalToLocalStorage = () => {
        if (!loadedFromCanonical) return;
        try {
            const { nodes: nPersist, edges: ePersist, connections: cPersist } = api.serializeCodexState();
            if (!nPersist.length) return;
            localStorage.setItem(
                CODEX_STORAGE_KEY,
                JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist, connections: cPersist || [] })
            );
        } catch (_) {
            /* ignore */
        }
    };

    const { nodes, edges, connections, migratedNow } = parseMigrateAndDedupeCodexSource(sourceObj);
    s.codexEdges = edges;
    setCodexConnectionsInSession(connections || []);
    s.codexUnsavedEdgeKeys.clear();
    s.codexViewZoom = CODEX_ZOOM_INITIAL;
    
    // Store all nodes for virtual scrolling
    s.codexAllNodes = nodes || [];
    // Clear previously rendered nodes
    clearCodexVirtualScroll();
    api.clearCodexTargetedSelection();
    
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

    // View mode needs every node in the DOM for edges; chunk placement so the loader can breathe.
    if (s.codexMode === 'view' && nodes.length > 0) {
        await placeCodexNodeRecordsInChunks(nodes);
    } else {
        updateCodexVirtualScroll();
    }

    // Keep edge redraw suppressed until post-open paint (codexCanvasHost).
    reportCodexLoadStageProgress({ stage: 'nodes', fraction: 1 });

    const overlayLine = getCodexLoadingOverlayLineSetter();
    if (overlayLine && nodes.length > 0) {
        const edgeCount = edges?.length ?? 0;
        overlayLine(edgeCount > 0 ? `Planning connections… 0 / ${edgeCount}` : 'Preparing Codex…');
    }
    reportCodexLoadStageProgress({ stage: 'connections', fraction: 0 });

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
        if (loadedFromCanonical) {
            api.markCodexLayoutDirty();
        }
        scheduleDeferredCodexWork(() => {
            try {
                const { nodes: nPersist, edges: ePersist, connections: cPersist } = api.serializeCodexState();
                localStorage.setItem(
                    CODEX_STORAGE_KEY,
                    JSON.stringify({ v: CODEX_SAVE_VERSION, nodes: nPersist, edges: ePersist, connections: cPersist || [] })
                );
            } catch (_) {
                /* ignore */
            }
        });
    }

    // Edge redraw runs after the loading overlay drops (codexCanvasHost post-open).
    if (!migratedNow) {
        s.codexLayoutDirty = false;
    }
    scheduleDeferredCodexWork(() => mirrorCanonicalToLocalStorage());
    void ensureCodexConnectionPayload(true).then((payload) => {
        if (payload?.connections?.length) {
            setCodexConnectionsInSession(payload.connections);
        }
    });
}

api.placeLoadedCodexNodeRecord = placeLoadedCodexNodeRecord;
api.placeCodexNodeRecordsInChunks = placeCodexNodeRecordsInChunks;
api.yieldCodexBrowserPaint = yieldCodexBrowserPaint;
api.yieldBetweenCodexLoadChunks = yieldBetweenCodexLoadChunks;
api.loadCodexState = loadCodexState;

