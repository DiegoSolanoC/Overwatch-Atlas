/**
 * Add explicit imports to Codex canvas slice modules (replaces ineffective shared-imports side effect).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEAT = path.join(__dirname, '../src/features/connection-codex');

/** symbol -> path relative to connection-codex root */
const SYMBOL_SOURCES = {
    CODEX_SAVE_VERSION: 'codex-data/persistence/CodexLayoutConstants.js',
    CODEX_STORAGE_KEY: 'codex-data/persistence/CodexLayoutConstants.js',
    CODEX_WORLD_H: 'codex-data/persistence/CodexLayoutConstants.js',
    CODEX_WORLD_W: 'codex-data/persistence/CodexLayoutConstants.js',
    codexEdgePolyIntersectsRect: 'codex-camera/viewport/CodexViewportWorldBounds.js',
    codexPointInWorldRect: 'codex-camera/viewport/CodexViewportWorldBounds.js',
    codexUnionBoundsFromEdgePolys: 'codex-camera/viewport/CodexViewportWorldBounds.js',
    computeCodexVisibleWorldBoundsExpanded: 'codex-camera/viewport/CodexViewportWorldBounds.js',
    downloadTextFileAsJson: 'codex-data/persistence/CodexLayoutSerialization.js',
    serializeCodexLayoutSnapshot: 'codex-data/persistence/CodexLayoutSerialization.js',
    stringifyCodexLayoutJson: 'codex-data/persistence/CodexLayoutSerialization.js',
    computeCodexPanForNodeBounds: 'codex-camera/transform/CodexViewFraming.js',
    computeCodexPanForWorldCenter: 'codex-camera/transform/CodexViewFraming.js',
    cordAngleDistToNearestOctilinearDegFromRad: 'codex-edges/geometry/CodexCordOctilinearGeometry.js',
    cordSegmentDegreesLabel: 'codex-edges/geometry/CodexCordOctilinearGeometry.js',
    cordSegmentWithinOctilinearToleranceDegrees: 'codex-edges/geometry/CodexCordOctilinearGeometry.js',
    codexUnorderedPairKey: 'codex-edges/topology/CodexGraphPrimitives.js',
    edgeDirectedKey: 'codex-edges/topology/CodexGraphPrimitives.js',
    generateNodeId: 'codex-edges/topology/CodexGraphPrimitives.js',
    heroNamesLooselyEqualCodex: 'codex-edges/topology/CodexGraphPrimitives.js',
    codexBioEntityPairHasJunctionAlternatePath: 'codex-edges/topology/CodexGraphTopology.js',
    codexEdgeIsBioEntityChord: 'codex-edges/topology/CodexGraphTopology.js',
    hasCodexConnectionBetween: 'codex-edges/topology/CodexGraphTopology.js',
    findCodexNodeIdForBioEntity: 'codex-edges/topology/CodexBioEntityMatching.js',
    parseMigrateAndDedupeCodexSource: 'codex-data/migration/CodexPayloadMigration.js',
    fetchCanonicalCodexJson: 'codex-data/load/CodexJsonRepository.js',
    applyLocationFlagBioHighlight: 'codex-integration/bridge/CodexAppBridge.js',
    dispatchBioArchivesRefreshed: 'codex-integration/bridge/CodexAppBridge.js',
    exposeApplyCodexFilterState: 'codex-integration/bridge/CodexAppBridge.js',
    flashUiButton: 'codex-integration/bridge/CodexAppBridge.js',
    getCodexLoadingOverlayLineSetter: 'codex-integration/bridge/CodexAppBridge.js',
    getEventManager: 'codex-integration/bridge/CodexAppBridge.js',
    getEventsFromEventManager: 'codex-integration/bridge/CodexAppBridge.js',
    getFactionMatchHelpers: 'codex-integration/bridge/CodexAppBridge.js',
    getGlobeController: 'codex-integration/bridge/CodexAppBridge.js',
    getStandaloneActiveFiltersSet: 'codex-integration/bridge/CodexAppBridge.js',
    getStandaloneEventSlide: 'codex-integration/bridge/CodexAppBridge.js',
    getStoryFilterPlacesSync: 'codex-integration/bridge/CodexAppBridge.js',
    getEventTimelineDataService: 'codex-integration/bridge/CodexAppBridge.js',
    isCodexPersistToRepoAvailable: 'codex-integration/bridge/CodexAppBridge.js',
    playSoundEffect: 'codex-integration/bridge/CodexAppBridge.js',
    resolveCodexRepoApiUrl: 'codex-integration/bridge/CodexAppBridge.js',
    updateAppStatus: 'codex-integration/bridge/CodexAppBridge.js',
    userConfirms: 'codex-integration/bridge/CodexAppBridge.js',
    parseCodexJsonInWorker: 'codex-data/load/CodexJsonParseWorker.js',
    terminateCodexJsonParseWorker: 'codex-data/load/CodexJsonParseWorker.js',
    escapeHtml: 'codex-render/svg/CodexPresentationUtils.js',
    hexToRgba: 'codex-render/svg/CodexPresentationUtils.js',
    appendCordFilteredLineGroup: 'codex-render/svg/CodexCordSvgElements.js',
    appendEdgeGlowFilter: 'codex-render/svg/CodexCordSvgElements.js',
    appendSoftPacketGlowFilter: 'codex-render/svg/CodexCordSvgElements.js',
    appendCodexEdgeNodeMask: 'codex-render/svg/CodexNodeFrameSvg.js',
    nodeFrameIntersectsRect: 'codex-render/svg/CodexNodeFrameSvg.js',
    parseTranslatePxFromTransform: 'codex-render/svg/CodexNodeFrameSvg.js',
    observeCodexImage: 'codex-render/lazy-images/CodexImageLazyLoad.js',
    disconnectCodexImageObserver: 'codex-render/lazy-images/CodexImageLazyLoad.js',
    codexFrameVariantForId: 'codex-nodes/placement/CodexNodeVisualHash.js',
    codexHexRotationDegreesForId: 'codex-nodes/placement/CodexNodeVisualHash.js',
    CODEX_ALLOWED_COUNTRY_KEYS: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_DEFAULT_SCALE_COUNTRY: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_DEFAULT_SCALE_FACTION: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_DEFAULT_SCALE_HERO: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_DEFAULT_SCALE_JUNCTION: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_FRAME_PATH: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_IMG_BASE_PX: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_JUNCTION_BASE_PX: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_NODE_ALPHA_PATH: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_SCALE_MAX: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_SCALE_MIN: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    codexCountryFlagSrc: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    normalizeCodexCountryKey: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    resolveCodexNodeScale: 'codex-nodes/placement/CodexNodePortraitMetrics.js',
    CODEX_EDGE_CULL_MARGIN_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_EDGE_DEGREE_FONT_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_EDGE_HIT_PICK_STROKE_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_EDGE_STROKE_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_EDGES_NODE_ALPHA_MASK_ID: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_MASK_PAD_WORLD_FROM_EDGES: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_NODE_DOM_CULL_MARGIN_EXTRA_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_NODE_DOM_CULL_MIN_NODES: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_OCT_RAD: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_OCT_RELEASE_SNAP_EPS: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_OCT_SOFT_SNAP_TOL_DEG: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_VIEWPORT_CULL_MIN_EDGES: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_VIEWPORT_CULL_MIN_NODES: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_VISUAL_DEFAULTS: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_VISUAL_PREFS_KEY: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_ZOOM_FACTOR: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_ZOOM_INITIAL: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_ZOOM_MAX: 'codex-camera/viewport/CodexCanvasTuning.js',
    CODEX_ZOOM_MIN: 'codex-camera/viewport/CodexCanvasTuning.js',
    DRAG_THRESHOLD_PX: 'codex-camera/viewport/CodexCanvasTuning.js',
    normalizeCodexVisualPrefs: 'codex-camera/viewport/CodexCanvasTuning.js',
    computeCodexVirtualViewportBounds: 'codex-camera/viewport/CodexCanvasTuning.js',
    isCodexNodeInVirtualViewport: 'codex-camera/viewport/CodexCanvasTuning.js',
    clearCodexEdgeRedrawSchedule: 'codex-render/redraw/CodexEdgeRedraw.js',
    redrawCodexEdges: 'codex-render/redraw/CodexEdgeRedraw.js',
    scheduleRedrawCodexEdges: 'codex-render/redraw/CodexEdgeRedraw.js',
    codexStopCordAnimRafOnly: 'codex-render/packets/CodexCordPacketAnimation.js',
    deleteCodexCordPacketStateForKey: 'codex-render/packets/CodexCordPacketAnimation.js',
    ensureCodexCordAnimationLoop: 'codex-render/packets/CodexCordPacketAnimation.js',
    stopCordAnimAndClearCordPacketState: 'codex-render/packets/CodexCordPacketAnimation.js',
    syncCodexCordPacketState: 'codex-render/packets/CodexCordPacketAnimation.js',
    appendCodexJunctionElbowParallelograms: 'codex-render/junction-decor/CodexJunctionElbowParallelograms.js',
    previewBioCodexArchiveLinkDiff: 'codex-bio-sync/preview/CodexCanvasBioSyncPreview.js',
    clearCodexVirtualScroll: 'codex-render/virtual-scroll/CodexVirtualScroll.js',
    scheduleUpdateCodexVirtualScroll: 'codex-render/virtual-scroll/CodexVirtualScroll.js',
    updateCodexVirtualScroll: 'codex-render/virtual-scroll/CodexVirtualScroll.js',
    capOpts: 'codex-core/canvasConstants.js',
    DOUBLE_RIGHT_MS: 'codex-core/canvasConstants.js',
    CODEX_JUNCTION_PREVIEW_DATA_URI: 'codex-core/canvasConstants.js',
    MAX_SUGGEST: 'codex-core/canvasConstants.js',
    CODEX_DEBUG_UI_PREF_KEY: 'codex-core/canvasConstants.js',
    CODEX_DEBUG_UI_PREF_KEY_LEGACY: 'codex-core/canvasConstants.js',
    CODEX_MODE_PREF_KEY: 'codex-core/canvasConstants.js',
    syncCodexEdgesFromBioArchiveConnections: 'codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js'
};

const SLICE_GLOBS = [
    'codex-edges/canvas/CodexEdgeStore.js',
    'codex-edges/junction/CodexJunctionOps.js',
    'codex-camera/coords/CodexWorldCoords.js',
    'codex-camera/transform/CodexViewTransform.js',
    'codex-camera/gestures/CodexViewGestures.js',
    'codex-data/save/CodexLayoutSave.js',
    'codex-data/load/CodexLayoutLoad.js',
    'codex-data/import-export/CodexLayoutImportExport.js',
    'codex-nodes/selection/CodexNodeSelection.js',
    'codex-nodes/placement/CodexNodePlacement.js',
    'codex-nodes/cull/CodexNodeDomCull.js',
    'codex-nodes/picker/CodexNodePicker.js',
    'codex-mode/shell/CodexCanvasShell.js',
    'codex-input/pointer/CodexPointerInput.js'
];

const RESERVED = new Set([
    'api', 's', 'window', 'document', 'console', 'Math', 'Number', 'String', 'Boolean', 'Object', 'Array',
    'Set', 'Map', 'Promise', 'JSON', 'localStorage', 'getComputedStyle', 'parseFloat', 'parseInt', 'isFinite',
    'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'Event', 'MouseEvent',
    'KeyboardEvent', 'PointerEvent', 'SVGElement', 'Node', 'Date', 'Error', 'RegExp', 'Intl', 'fetch', 'URL',
    'Blob', 'FileReader', 'performance', 'navigator', 'location', 'history', 'alert', 'confirm', 'undefined', 'null',
    'true', 'false', 'async', 'await', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break',
    'continue', 'const', 'let', 'var', 'typeof', 'instanceof', 'new', 'delete', 'try', 'catch', 'throw', 'import', 'export',
    'from', 'default', 'class', 'extends', 'super', 'this', 'void', 'in', 'of', 'yield', 'static', 'get', 'set'
]);

function relImportPath(fromFile, targetFeatPath) {
    const fromDir = path.dirname(fromFile);
    const absTarget = path.join(FEAT, targetFeatPath);
    let rel = path.relative(fromDir, absTarget).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
}

function parseExistingImports(content) {
    const imported = new Set();
    const re = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g;
    let m;
    while ((m = re.exec(content))) {
        for (const part of m[1].split(',')) {
            const sym = part.trim().split(/\s+as\s+/)[0].trim();
            if (sym) imported.add(sym);
        }
    }
    return imported;
}

function collectLocalNames(content) {
    const locals = new Set();
    const reFn = /function\s+(\w+)/g;
    const reConst = /\b(?:const|let|var)\s+(\w+)/g;
    let m;
    while ((m = reFn.exec(content))) locals.add(m[1]);
    while ((m = reConst.exec(content))) locals.add(m[1]);
    return locals;
}

function findUsedSymbols(content, localNames) {
    const used = new Set();
    for (const sym of Object.keys(SYMBOL_SOURCES)) {
        if (localNames.has(sym) || RESERVED.has(sym)) continue;
        const re = new RegExp(`\\b${sym}\\b`);
        if (re.test(content)) used.add(sym);
    }
    return used;
}

function buildImportBlock(fromFile, symbols) {
    const byPath = new Map();
    for (const sym of symbols) {
        const p = SYMBOL_SOURCES[sym];
        if (!byPath.has(p)) byPath.set(p, []);
        byPath.get(p).push(sym);
    }
    const lines = [];
    for (const [featPath, syms] of [...byPath.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        syms.sort();
        const rel = relImportPath(fromFile, featPath);
        lines.push(`import { ${syms.join(', ')} } from '${rel}';`);
    }
    return lines.join('\n');
}

function patchSlice(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('codexCanvasSharedImports')) return false;

    content = content.replace(/\nimport\s+['"][^'"]*codexCanvasSharedImports\.js['"];\n/, '\n');

    const existing = parseExistingImports(content);
    const locals = collectLocalNames(content);
    const used = findUsedSymbols(content, locals);
    const missing = [...used].filter((sym) => !existing.has(sym));
    if (missing.length === 0 && !content.includes('codexCanvasSharedImports')) {
        fs.writeFileSync(filePath, content);
        return false;
    }

    const importBlock = buildImportBlock(filePath, missing);
    const anchor = /import \{ s \} from ['"][^'"]+canvasSession\.js['"];\n/;
    if (!anchor.test(content)) {
        console.warn('no anchor', filePath);
        return false;
    }
    content = content.replace(anchor, (m) => `${m}${importBlock ? `${importBlock}\n` : ''}`);
    fs.writeFileSync(filePath, content);
    console.log(path.relative(FEAT, filePath), 'added', missing.length, 'symbols');
    return true;
}

for (const rel of SLICE_GLOBS) {
    patchSlice(path.join(FEAT, rel));
}

console.log('done');
