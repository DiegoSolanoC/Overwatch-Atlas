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
import { hydrateCodexPortraitImagesInViewport, observeCodexImage } from '../../codex-node-drawing/lazy-images/CodexImageLazyLoad.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';

/** Soft cap per turn; time budget usually yields sooner. */
const CODEX_LOAD_NODE_CHUNK = 120;
/** Max ms of sync DOM work before yielding to the browser. */
const CODEX_LOAD_NODE_BUDGET_MS = 12;

function placeLoadedCodexNodeRecord(L, extraOpts = {}) {
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
        skipEnterFade: true,
        // Observe portraits by default so virtual-scroll remounts hydrate on pan/zoom.
        skipImageObserve: false,
        id: L.id,
        scale: resolveCodexNodeScale(placeKind, L.scale),
        bgColor: L.bgColor || null,
        ...extraOpts,
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

function observePendingCodexNodeImages(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('img.codex-node__img[data-src], img.codex-node__frame[data-src]').forEach((img) => {
        if (img instanceof HTMLImageElement) observeCodexImage(img);
    });
}

/**
 * Place nodes in short time-budgeted turns (DocumentFragment per turn).
 * @param {object[]} nodes
 * @param {{ report?: boolean, overlayEvery?: number, budgetMs?: number }} [opts]
 */
async function placeCodexNodeRecordsFast(nodes, opts = {}) {
    if (!nodes.length) return;
    const overlayLine = getCodexLoadingOverlayLineSetter();
    const world = s.codexWorldEl || s.root;
    if (!world) return;

    const report = opts.report !== false;
    const overlayEvery = Math.max(1, opts.overlayEvery || 440);
    const budgetMs = Math.max(3, opts.budgetMs || CODEX_LOAD_NODE_BUDGET_MS);
    let i = 0;
    const total = nodes.length;

    while (i < total) {
        const turnStart = performance.now();
        const frag = document.createDocumentFragment();
        let turnCount = 0;
        while (i < total && turnCount < CODEX_LOAD_NODE_CHUNK) {
            const node = nodes[i++];
            if (!node?.id || s.codexRenderedNodeIds.has(node.id)) continue;
            placeLoadedCodexNodeRecord(node, { mountParent: frag, skipImageObserve: true });
            s.codexRenderedNodeIds.add(node.id);
            turnCount += 1;
            if (performance.now() - turnStart >= budgetMs) break;
        }
        if (frag.childNodes.length) world.appendChild(frag);

        if (report) {
            reportCodexLoadStageProgress({
                stage: 'nodes',
                fraction: Math.min(1, i / total),
            });
        }
        if (overlayLine && (i >= total || i % overlayEvery < CODEX_LOAD_NODE_CHUNK)) {
            overlayLine(`Placing nodes… ${i} / ${total}`);
        }
        if (i < total) {
            await yieldBetweenCodexLoadChunks();
        }
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

/**
 * Mount the full node board with time-budgeted DocumentFragment batches.
 * View mode keeps every shell in the DOM so pan stays CSS-transform-only (smooth).
 */
async function placeCodexNodeRecordsInChunks(nodes) {
    const overlayLine = getCodexLoadingOverlayLineSetter();
    if (overlayLine && nodes.length) {
        overlayLine(`Placing ${nodes.length} nodes…`);
    }
    await yieldCodexBrowserPaint();

    s.codexViewBoardMountComplete = false;
    ++s.codexNodeBackfillGeneration;

    api.ensureCodexNodeInteractionDelegation?.();
    await placeCodexNodeRecordsFast(nodes, {
        report: true,
        overlayEvery: 400,
        budgetMs: 14,
    });
    observePendingCodexNodeImages(s.codexWorldEl || s.root);
    hydrateCodexPortraitImagesInViewport(s.root);

    s.codexViewBoardMountComplete = true;
    s.codexViewModeInitialRenderDone = true;
    reportCodexLoadStageProgress({ stage: 'nodes', fraction: 1 });
}

function yieldCodexBrowserPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

function yieldBetweenCodexLoadChunks() {
    // Single rAF — idleCallback was waiting for quiet time and stretched open to minutes
    // when the main thread was busy (font warnings, overlay text, etc.).
    return new Promise((resolve) => {
        requestAnimationFrame(resolve);
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
    
    // Store all nodes for virtual scrolling + edge layout fallback
    s.codexAllNodes = nodes || [];
    s.codexNodeLayoutById = new Map();
    for (let i = 0; i < s.codexAllNodes.length; i++) {
        const n = s.codexAllNodes[i];
        if (n?.id) s.codexNodeLayoutById.set(n.id, n);
    }
    clearCodexVirtualScroll();
    api.clearCodexTargetedSelection();

    s.codexViewModeInitialRenderDone = false;
    s.codexViewBoardMountComplete = false;

    if (!nodes.length) {
        s.codexViewBoardMountComplete = true;
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

    // View: full board (smooth CSS pan). Dev: viewport virtual scroll.
    if (s.codexMode === 'view' && nodes.length > 0) {
        await placeCodexNodeRecordsInChunks(nodes);
    } else {
        updateCodexVirtualScroll();
        s.codexViewBoardMountComplete = true;
        reportCodexLoadStageProgress({ stage: 'nodes', fraction: 1 });
    }

    {
        const overlayLine = getCodexLoadingOverlayLineSetter();
        if (overlayLine && nodes.length > 0) {
            const edgeCount = edges?.length ?? 0;
            overlayLine(edgeCount > 0 ? `Drawing connections…` : 'Preparing Codex…');
        }
    }
    reportCodexLoadStageProgress({ stage: 'connections', fraction: 0 });

    // Failsafe if nothing mounted
    if (s.codexRenderedNodeIds.size === 0 && nodes.length > 0) {
        await placeCodexNodeRecordsInChunks(nodes);
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

